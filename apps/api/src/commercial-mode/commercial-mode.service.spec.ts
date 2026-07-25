import { ConfigService } from '@nestjs/config';
import { CommercialModeService } from './commercial-mode.service';

function service(mode?: string) {
  const config = {
    get: jest.fn().mockReturnValue(mode),
  } as unknown as ConfigService;
  return new CommercialModeService(config);
}

describe('CommercialModeService', () => {
  it('по умолчанию сохраняет PAID_MOCK', () => {
    expect(service().publicConfig()).toEqual({
      commercialMode: 'PAID_MOCK',
      paymentsEnabled: true,
      leadCreditsEnabled: true,
      payoutsEnabled: true,
    });
  });

  it('отключает финансовые возможности в FREE_PILOT', () => {
    expect(service('FREE_PILOT').publicConfig()).toEqual({
      commercialMode: 'FREE_PILOT',
      paymentsEnabled: false,
      leadCreditsEnabled: false,
      payoutsEnabled: false,
    });
  });

  it('останавливает запуск при неизвестном значении', () => {
    expect(() => service('FREE')).toThrow('Недопустимый COMMERCIAL_MODE=FREE');
  });

  it('не позволяет PAID_LIVE тихо работать через mock-провайдер', () => {
    expect(() => service('PAID_LIVE')).toThrow('реальный платёжный провайдер не подключён');
  });
});
