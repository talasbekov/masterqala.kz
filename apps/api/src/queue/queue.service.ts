import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PgBoss = require('pg-boss');

type JobHandler = (data: any) => Promise<void>;

export type QueueHealth =
  | {
      status: 'UP';
      enabled: true;
      startedAt: Date;
      registeredHandlers: number;
      scheduledJobs: number;
      lastErrorAt: Date | null;
      lastError: string | null;
    }
  | {
      status: 'DOWN';
      enabled: true;
      startedAt: Date | null;
      registeredHandlers: number;
      scheduledJobs: number;
      lastErrorAt: Date | null;
      lastError: string | null;
    }
  | {
      status: 'DISABLED';
      enabled: false;
      startedAt: null;
      registeredHandlers: number;
      scheduledJobs: number;
      lastErrorAt: null;
      lastError: null;
    };

@Injectable()
export class QueueService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(QueueService.name);
  private boss: PgBoss | null = null;
  private readonly handlers = new Map<string, JobHandler>();
  private readonly crons: { name: string; cron: string }[] = [];
  private readonly enabled: boolean;
  private startedAt: Date | null = null;
  private lastErrorAt: Date | null = null;
  private lastError: string | null = null;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get('PGBOSS_DISABLED') !== '1';
  }

  register(name: string, handler: JobHandler): void {
    this.handlers.set(name, handler);
  }

  registerCron(name: string, cron: string, handler: JobHandler): void {
    this.register(name, handler);
    this.crons.push({ name, cron });
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) return;
    this.boss = new PgBoss(this.config.get<string>('DATABASE_URL')!);
    this.boss.on('error', (error) => {
      this.lastErrorAt = new Date();
      this.lastError = error.message.slice(0, 500);
      this.logger.error(error);
    });
    await this.boss.start();
    this.startedAt = new Date();
    this.lastError = null;

    for (const [name, handler] of this.handlers) {
      await this.boss
        .createQueue(name)
        .catch((error) => this.logger.warn(`createQueue(${name}): ${error.message}`));
      await this.boss.work(name, async (jobs) => {
        for (const job of jobs) await handler(job.data);
      });
    }
    for (const { name, cron } of this.crons) {
      await this.boss.schedule(name, cron);
    }
  }

  /** Поставить джобу; afterSeconds — задержка. No-op, если pg-boss отключён (e2e). */
  async send(name: string, data: object, afterSeconds = 0): Promise<void> {
    if (!this.boss) return;
    await this.boss.send(name, data, afterSeconds > 0 ? { startAfter: afterSeconds } : {});
  }

  healthCheck(): QueueHealth {
    const base = {
      registeredHandlers: this.handlers.size,
      scheduledJobs: this.crons.length,
    };
    if (!this.enabled) {
      return {
        status: 'DISABLED',
        enabled: false,
        startedAt: null,
        ...base,
        lastErrorAt: null,
        lastError: null,
      };
    }
    if (!this.boss || !this.startedAt) {
      return {
        status: 'DOWN',
        enabled: true,
        startedAt: this.startedAt,
        ...base,
        lastErrorAt: this.lastErrorAt,
        lastError: this.lastError,
      };
    }
    return {
      status: 'UP',
      enabled: true,
      startedAt: this.startedAt,
      ...base,
      lastErrorAt: this.lastErrorAt,
      lastError: this.lastError,
    };
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.boss) await this.boss.stop({ graceful: false, wait: false });
    this.boss = null;
    this.startedAt = null;
  }
}
