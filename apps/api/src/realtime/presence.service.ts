import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { JOBS } from '../queue/queue.constants';

export const PRESENCE_OFFLINE_MINUTES = 2;

@Injectable()
export class PresenceService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  onModuleInit(): void {
    this.queue.registerCron(JOBS.PRESENCE_SWEEP, '* * * * *', () => this.sweepOffline());
  }

  async setOnline(userId: string, lat: number, lng: number): Promise<void> {
    await this.prisma.masterPresence.upsert({
      where: { masterUserId: userId },
      create: { masterUserId: userId, isOnline: true },
      update: { isOnline: true, lastSeenAt: new Date() },
    });
    await this.setLocation(userId, lat, lng);
  }

  async updateGeo(userId: string, lat: number, lng: number): Promise<void> {
    await this.setLocation(userId, lat, lng);
  }

  async setOffline(userId: string): Promise<void> {
    await this.prisma.masterPresence.updateMany({
      where: { masterUserId: userId },
      data: { isOnline: false },
    });
  }

  async sweepOffline(): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "MasterPresence" SET "isOnline" = false
      WHERE "isOnline" = true AND "lastSeenAt" < now() - make_interval(mins => ${PRESENCE_OFFLINE_MINUTES}::int)`;
  }

  private async setLocation(userId: string, lat: number, lng: number): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "MasterPresence"
      SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          "lastSeenAt" = now(), "isOnline" = true
      WHERE "masterUserId" = ${userId}`;
  }
}
