import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HealthService } from './health.service';
import { PrismaService } from './prisma/prisma.service';
import { JOBS } from './queue/queue.constants';
import { QueueService } from './queue/queue.service';

type DependencyName = 'database' | 'queue' | 'scanner';

const WATCHED_DEPENDENCIES: DependencyName[] = ['database', 'queue', 'scanner'];

/**
 * Продюсер событий `SECURITY_DEPENDENCY_DOWN`: триггер БД превращает их в alert
 * `DEPENDENCY_UNAVAILABLE`. Событие пишется один раз на переход UP→DOWN, чтобы
 * ежеминутный sweep не заспамил аудит; после восстановления следующая деградация
 * даёт новое событие.
 *
 * Предел: при недоступной БД или остановленном pg-boss событие записать нечем —
 * этот случай обязан ловить внешний мониторинг (см. SECURITY_OBSERVABILITY.md).
 */
@Injectable()
export class SecurityDependencyMonitorService implements OnModuleInit {
  private readonly logger = new Logger(SecurityDependencyMonitorService.name);
  private readonly currentlyDown = new Set<DependencyName>();

  constructor(
    private readonly health: HealthService,
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  onModuleInit(): void {
    this.queue.registerCron(JOBS.SECURITY_DEPENDENCY_SWEEP, '* * * * *', () => this.sweep());
  }

  async sweep(): Promise<void> {
    const readiness = await this.health.readiness();
    for (const name of WATCHED_DEPENDENCIES) {
      const status = readiness.dependencies[name]?.status;
      const isDown = status === 'DOWN';
      if (isDown && !this.currentlyDown.has(name)) {
        this.currentlyDown.add(name);
        await this.recordDown(name);
      } else if (!isDown) {
        this.currentlyDown.delete(name);
      }
    }
  }

  private async recordDown(name: DependencyName): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO "SecurityAuditEvent" (
          "action", "severity", "outcome", "resourceType", "resourceId", "metadata"
        ) VALUES (
          'SECURITY_DEPENDENCY_DOWN', 'CRITICAL', 'ERROR', 'SYSTEM', ${`dependency:${name}`},
          jsonb_build_object('dependency', ${name})
        )
      `;
    } catch (error) {
      this.logger.error(
        `Не удалось записать SECURITY_DEPENDENCY_DOWN (${name}): ${(error as Error).message}`,
      );
    }
  }
}
