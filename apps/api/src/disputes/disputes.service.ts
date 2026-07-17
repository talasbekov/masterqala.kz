import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { createReadStream } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorage, FILE_STORAGE } from '../storage/storage.interface';
import { PAYMENT_PROVIDER, PaymentProvider } from '../payments/payment.interface';
import { MasterPenaltyService } from '../common/master-penalty.service';
import { CompensationService } from '../common/compensation.service';
import { OpenDisputeDto, ResolveDisputeDto } from './dto';

const DISPUTE_WINDOW_AFTER_CLOSE_MS = 48 * 3600 * 1000;
const ALLOWED_MIME: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_FILE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
    private readonly penalties: MasterPenaltyService,
    private readonly compensation: CompensationService,
  ) {}

  async openForOrder(user: User, orderId: string, dto: OpenDisputeDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заявка не найдена');
    const role = this.resolveRole(user, order.clientId, order.masterId);
    this.assertWithinWindow(order.status, order.closedAt);
    return this.create(user.id, role, dto.reason, { orderId });
  }

  async openForPlannedOrder(user: User, plannedOrderId: string, dto: OpenDisputeDto) {
    const order = await this.prisma.plannedOrder.findUnique({ where: { id: plannedOrderId } });
    if (!order) throw new NotFoundException('Заявка не найдена');
    const role = this.resolveRole(user, order.clientId, order.masterId);
    this.assertWithinWindow(order.status, order.closedAt);
    return this.create(user.id, role, dto.reason, { plannedOrderId });
  }

  private resolveRole(user: User, clientId: string, masterId: string | null): 'CLIENT' | 'MASTER' {
    if (user.id === clientId) return 'CLIENT';
    if (user.id === masterId) return 'MASTER';
    throw new ForbiddenException('Нет доступа к заявке');
  }

  private assertWithinWindow(status: string, closedAt: Date | null): void {
    const allowed = ['DONE', 'IN_PROGRESS', 'CLOSED'];
    if (!allowed.includes(status)) {
      throw new ConflictException('Спор недоступен на этом этапе заявки');
    }
    if (status === 'CLOSED') {
      if (!closedAt || Date.now() - closedAt.getTime() > DISPUTE_WINDOW_AFTER_CLOSE_MS) {
        throw new ConflictException('Окно открытия спора истекло');
      }
    }
  }

  private async create(
    userId: string,
    role: 'CLIENT' | 'MASTER',
    reason: string,
    target: { orderId: string } | { plannedOrderId: string },
  ) {
    try {
      return await this.prisma.dispute.create({
        data: { openedByUserId: userId, openedByRole: role, reason, ...target },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('По заявке уже открыт спор');
      }
      throw e;
    }
  }

  async hasOpenDispute(target: { orderId?: string; plannedOrderId?: string }): Promise<boolean> {
    const count = await this.prisma.dispute.count({ where: { ...target, status: 'OPEN' } });
    return count > 0;
  }

  private async findOrThrow(disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException('Спор не найден');
    return dispute;
  }

  /** Кто из участников заявки не является открывшим спор — та сторона может добавить доказательства/пояснение. */
  private async guardParticipant(userId: string, dispute: { orderId: string | null; plannedOrderId: string | null }) {
    if (dispute.orderId) {
      const order = await this.prisma.order.findUniqueOrThrow({ where: { id: dispute.orderId } });
      if (userId !== order.clientId && userId !== order.masterId) throw new ForbiddenException('Нет доступа к спору');
      return;
    }
    const order = await this.prisma.plannedOrder.findUniqueOrThrow({ where: { id: dispute.plannedOrderId! } });
    if (userId !== order.clientId && userId !== order.masterId) throw new ForbiddenException('Нет доступа к спору');
  }

  async addEvidence(userId: string, disputeId: string, file: Express.Multer.File) {
    const dispute = await this.findOrThrow(disputeId);
    await this.guardParticipant(userId, dispute);
    if (dispute.status !== 'OPEN') throw new ConflictException('Спор уже закрыт');
    const ext = ALLOWED_MIME[file.mimetype];
    if (!ext) throw new BadRequestException('Допустимы только JPEG и PNG');
    if (file.size > MAX_FILE_BYTES) throw new BadRequestException('Файл больше 10 МБ');
    const relPath = await this.storage.save(file.buffer, ext);
    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: { evidenceDocIds: { push: relPath } },
    });
  }

  async addCounterStatement(userId: string, disputeId: string, counterStatement: string) {
    const dispute = await this.findOrThrow(disputeId);
    await this.guardParticipant(userId, dispute);
    if (dispute.status !== 'OPEN') throw new ConflictException('Спор уже закрыт');
    if (userId === dispute.openedByUserId) throw new ForbiddenException('Пояснение добавляет только вторая сторона');
    return this.prisma.dispute.update({ where: { id: disputeId }, data: { counterStatement } });
  }

  async listAll(status?: 'OPEN' | 'RESOLVED') {
    return this.prisma.dispute.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    return this.findOrThrow(id);
  }

  async resolve(operatorId: string, disputeId: string, dto: ResolveDisputeDto) {
    const dispute = await this.findOrThrow(disputeId);
    if (dispute.status !== 'OPEN') throw new ConflictException('Спор уже разрешён');

    const orderId = dispute.orderId;
    const plannedOrderId = dispute.plannedOrderId;
    // Возврат сервисного сбора физически возможен только для срочных заявок (PlannedOrder не имеет serviceFee) —
    // для планового спора флаг всегда игнорируется и сохраняется как false, независимо от запроса оператора.
    const refundServiceFee = orderId ? dto.refundServiceFee : false;

    await this.prisma.$transaction(async (tx) => {
      const gated = await tx.dispute.updateMany({
        where: { id: disputeId, status: 'OPEN' },
        data: {
          status: 'RESOLVED',
          refundServiceFee,
          penalizeMaster: dto.penalizeMaster,
          resolutionNote: dto.resolutionNote,
          resolvedByUserId: operatorId,
          resolvedAt: new Date(),
        },
      });
      if (gated.count === 0) throw new ConflictException('Спор уже разрешён');

      if (orderId) {
        const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
        if (dto.penalizeMaster && order.masterId) await this.penalties.applyPenalty(tx, order.masterId);
        if (order.status === 'DONE') {
          await tx.order.updateMany({ where: { id: orderId, status: 'DONE' }, data: { status: 'CLOSED', closedAt: new Date() } });
          // Компенсация начисляется всегда при фактическом закрытии срочной заявки через спор,
          // независимо от санкции (penalizeMaster) — это отдельное, независимое от штрафа начисление.
          await this.compensation.accrueCallout(tx, order);
        }
      } else if (plannedOrderId) {
        const order = await tx.plannedOrder.findUniqueOrThrow({ where: { id: plannedOrderId } });
        if (dto.penalizeMaster && order.masterId) await this.penalties.applyPenalty(tx, order.masterId);
        if (order.status === 'DONE') {
          await tx.plannedOrder.updateMany({ where: { id: plannedOrderId, status: 'DONE' }, data: { status: 'CLOSED', closedAt: new Date() } });
        }
      }
    });

    if (refundServiceFee && orderId) {
      const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      await this.payments.refund(orderId, order.serviceFee);
    }

    return this.findOrThrow(disputeId);
  }

  async getEvidenceStream(user: User, disputeId: string, docPath: string) {
    const dispute = await this.findOrThrow(disputeId);
    if (user.role !== 'OPERATOR') {
      await this.guardParticipant(user.id, dispute);
    }
    if (!dispute.evidenceDocIds.includes(docPath)) throw new NotFoundException('Документ не найден');
    return createReadStream(this.storage.absolutePath(docPath));
  }
}
