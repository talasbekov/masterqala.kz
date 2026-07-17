import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PgBoss = require('pg-boss');

type JobHandler = (data: any) => Promise<void>;

@Injectable()
export class QueueService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(QueueService.name);
  private boss: PgBoss | null = null;
  private readonly handlers = new Map<string, JobHandler>();
  private readonly crons: { name: string; cron: string }[] = [];
  private readonly enabled: boolean;

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
    this.boss.on('error', (err) => this.logger.error(err));
    await this.boss.start();
    for (const [name, handler] of this.handlers) {
      await this.boss
        .createQueue(name)
        .catch((err) => this.logger.warn(`createQueue(${name}): ${err.message}`));
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

  async onApplicationShutdown(): Promise<void> {
    if (this.boss) await this.boss.stop({ graceful: false, wait: false });
    this.boss = null;
  }
}
