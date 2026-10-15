import { ConflictException } from '@nestjs/common';

/** Commercial mode is not a lifecycle discriminator. Missing/unknown is unsafe. */
export function isLegacyPlannedOrder(order: {
  lifecycleModel?: unknown;
}): boolean {
  return order.lifecycleModel === 'LEGACY';
}

export function requireLegacyPlannedOrder(order: {
  lifecycleModel?: unknown;
}): void {
  if (!isLegacyPlannedOrder(order)) {
    throw new ConflictException(
      'Этот процесс планового заказа ещё не поддерживается',
    );
  }
}
