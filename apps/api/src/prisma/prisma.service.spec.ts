import { currentCommercialMode, stampCommercialMode } from './prisma.service';

describe('Prisma commercial mode stamp', () => {
  const previousMode = process.env.COMMERCIAL_MODE;

  afterEach(() => {
    if (previousMode === undefined) delete process.env.COMMERCIAL_MODE;
    else process.env.COMMERCIAL_MODE = previousMode;
  });

  it('фиксирует FREE_PILOT при создании срочной заявки', () => {
    process.env.COMMERCIAL_MODE = 'FREE_PILOT';
    const params = { model: 'Order', action: 'create', args: { data: { clientId: 'client-1' } } };

    stampCommercialMode(params);

    expect(params.args.data).toEqual({ clientId: 'client-1', commercialMode: 'FREE_PILOT' });
  });

  it('stamps a new direct urgent order as lifecycle v2 without rewriting legacy records', () => {
    process.env.COMMERCIAL_MODE = 'DIRECT_PAYMENT';
    const params = { model: 'Order', action: 'create', args: { data: {} as Record<string, unknown> } };
    stampCommercialMode(params);
    expect(params.args.data).toEqual({commercialMode: 'DIRECT_PAYMENT', lifecycleVersion: 2, dispatchMode: 'SEQUENTIAL'});
    const legacy = {model: 'Order', action: 'update', args: {data: {status: 'DONE'} as Record<string, unknown>}};
    stampCommercialMode(legacy);
    expect(legacy.args.data).toEqual({status: 'DONE'});
  });

  it('фиксирует режим и для плановой заявки', () => {
    process.env.COMMERCIAL_MODE = 'PAID_MOCK';
    const params = { model: 'PlannedOrder', action: 'create', args: { data: {} as Record<string, unknown> } };

    stampCommercialMode(params);

    expect(params.args.data.commercialMode).toBe('PAID_MOCK');
  });

  it('не перезаписывает явно переданный режим', () => {
    process.env.COMMERCIAL_MODE = 'FREE_PILOT';
    const params = {
      model: 'Order',
      action: 'create',
      args: { data: { commercialMode: 'PAID_MOCK' } as Record<string, unknown> },
    };

    stampCommercialMode(params);

    expect(params.args.data.commercialMode).toBe('PAID_MOCK');
  });

  it('не изменяет другие модели и использует безопасный fallback', () => {
    process.env.COMMERCIAL_MODE = 'UNKNOWN';
    const params = { model: 'User', action: 'create', args: { data: {} as Record<string, unknown> } };

    stampCommercialMode(params);

    expect(params.args.data).toEqual({});
    expect(currentCommercialMode()).toBe('PAID_MOCK');
  });
});
