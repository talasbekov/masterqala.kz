import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorage, FILE_STORAGE } from '../storage/storage.interface';
import { PersistentFileScansService, PersistentScanStatus } from '../storage/persistent-file-scans.service';
import { validateUploadedFile } from '../storage/upload-security';
import { PAYMENT_PROVIDER, PaymentProvider } from '../payments/payment.interface';
import { MasterPenaltyService } from '../common/master-penalty.service';
import { CompensationService } from '../common/compensation.service';
import { OpenDisputeDto, ResolveDisputeDto } from './dto';

const DISPUTE_WINDOW_AFTER_CLOSE_MS = 48 * 3600 * 1000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

type EvidenceSecurityRow = {
  id: string;
  disputeId: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: PersistentScanStatus;
  scannedAt: Date | null;
};

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly fileScans: PersistentFileScansService,
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

    const validated = validateUploadedFile(file, ['jpeg', 'png'], MAX_FILE_BYTES);
    const relPath = await this.storage.save(file.buffer, validated.extension);
    const evidenceId = randomUUID();

    try {
      await this.prisma.$executeRaw`
        INSERT INTO "DisputeEvidence" (
          "id", "disputeId", "uploadedByUserId", "path", "mimeType", "sizeBytes"
        ) VALUES (
          ${evidenceId}, ${disputeId}, ${userId}, ${relPath}, ${validated.mimeType}, ${validated.sizeBytes}
        )
      `;
    } catch (error) {
      await this.removeOrphan(relPath, 'dispute evidence');
      throw error;
    }

    await this.fileScans.enqueueDisputeEvidence(evidenceId);
    return this.getEvidenceStatus(userId, disputeId, evidenceId);
  }

  async getEvidenceStatus(userId: string, disputeId: string, evidenceId: string) {
    const dispute = await this.findOrThrow(disputeId);
    await this.guardParticipant(userId, dispute);
    const rows = await this.prisma.$queryRaw<EvidenceSecurityRow[]>`
      SELECT "id", "disputeId", "path", "mimeType", "sizeBytes", "scanStatus", "scannedAt"
      FROM "DisputeEvidence"
      WHERE "id" = ${evidenceId} AND "disputeId" = ${disputeId}
      LIMIT 1
    `;
    const evidence = rows[0];
    if (!evidence) throw new NotFoundException('Доказательство не найдено');
    return {
      id: evidence.id,
      path: evidence.path,
      mimeType: evidence.mimeType,
      sizeBytes: evidence.sizeBytes,
      scanStatus: evidence.scanStatus,
      scannedAt: evidence.scannedAt,
      statusPath: `/disputes/${disputeId}/evidence/${evidence.id}/status`,
    };
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
    const urgentOrder = orderId
      ? await this.prisma.order.findUniqueOrThrow({
          where: { id: orderId },
          select: { commercialMode: true, serviceFee: true },
        })
      : null;
    const refundServiceFee = Boolean(
      urgentOrder && urgentOrder.commercialMode !== 'FREE_PILOT' && dto.refundServiceFee,
    );

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

    if (refundServiceFee && orderId && urgentOrder) {
      try {
        await this.payments.refund(orderId, urgentOrder.serviceFee);
      } catch (e) {
        this.logger.error(
          `refund() упал для disputeId=${disputeId} orderId=${orderId} amount=${urgentOrder.serviceFee}: ${(e as Error).message}`,
        );
        throw new ServiceUnavailableException('Спор разрешён, но возврат сбора не удался — требуется ручная сверка');
      }
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

  private async removeOrphan(relPath: string, context: string): Promise<void> {
    try {
      await this.storage.remove(relPath);
    } catch (error) {
      this.logger.error(`Не удалось удалить orphan ${context} ${relPath}: ${(error as Error).message}`);
    }
  }
}
