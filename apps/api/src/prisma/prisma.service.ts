import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CommercialMode, PrismaClient } from '@prisma/client';

const COMMERCIAL_MODES: CommercialMode[] = ['FREE_PILOT', 'PAID_MOCK', 'PAID_LIVE'];

export function currentCommercialMode(): CommercialMode {
  const configured = process.env.COMMERCIAL_MODE as CommercialMode | undefined;
  return configured && COMMERCIAL_MODES.includes(configured) ? configured : 'PAID_MOCK';
}

interface CreateParams {
  model?: string;
  action: string;
  args?: { data?: Record<string, unknown> };
}

export function stampCommercialMode(params: CreateParams): void {
  if ((params.model !== 'Order' && params.model !== 'PlannedOrder') || params.action !== 'create') return;
  if (!params.args?.data) return;
  params.args.data.commercialMode ??= currentCommercialMode();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    this.$use(async (params, next) => {
      stampCommercialMode(params);
      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
