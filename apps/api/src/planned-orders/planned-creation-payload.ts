import { createHash } from 'crypto';
import { CreatePlannedOrderDto } from './dto';

/** Hash the values persisted by creation; equivalent ISO instants are identical. */
export function plannedCreationPayloadHash(dto: CreatePlannedOrderDto): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        categoryId: dto.categoryId,
        description: dto.description,
        address: dto.address,
        district: dto.district,
        entrance: dto.entrance ?? null,
        floor: dto.floor ?? null,
        apartment: dto.apartment ?? null,
        addressComment: dto.addressComment ?? null,
        budget: dto.budget ?? null,
        slotStart: new Date(dto.slotStart).toISOString(),
        slotEnd: new Date(dto.slotEnd).toISOString(),
        photoPaths: dto.photoPaths ?? [],
      }),
    )
    .digest('hex');
}
