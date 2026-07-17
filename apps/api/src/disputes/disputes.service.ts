import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorage, FILE_STORAGE } from '../storage/storage.interface';
import { OpenDisputeDto } from './dto';

const DISPUTE_WINDOW_AFTER_CLOSE_MS = 48 * 3600 * 1000;
const ALLOWED_MIME: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_FILE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
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
}
