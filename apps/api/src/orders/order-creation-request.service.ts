import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto';
export function creationPayloadHash(dto: CreateOrderDto): string {
  const submitted = {
    categoryId: dto.categoryId,
    description: dto.description,
    address: dto.address,
    district: dto.district,
    lat: dto.lat,
    lng: dto.lng,
    entrance: dto.entrance ?? null,
    floor: dto.floor ?? null,
    apartment: dto.apartment ?? null,
    addressComment: dto.addressComment ?? null,
    photoPaths: dto.photoPaths ?? [],
  };
  return createHash('sha256').update(JSON.stringify(submitted)).digest('hex');
}
export interface CreationRequestRecord {
  ownerId: string;
  requestKey: string;
  payloadHash: string;
  orderId: string;
  successfulResponse: unknown;
}
@Injectable()
export class OrderCreationRequestService {
  constructor(private readonly prisma: PrismaService) {}
  async lookup(
    ownerId: string,
    dto: CreateOrderDto,
  ): Promise<CreationRequestRecord | null> {
    if (!dto.clientRequestId) return null;
    const record = await this.prisma.orderCreationRequest.findUnique({
      where: {
        ownerId_requestKey: { ownerId, requestKey: dto.clientRequestId },
      },
    });
    if (record && record.payloadHash !== creationPayloadHash(dto))
      throw new ConflictException('IDEMPOTENCY_PAYLOAD_MISMATCH');
    return record;
  }
  async rememberResponse(
    ownerId: string,
    dto: CreateOrderDto,
    response: unknown,
  ): Promise<unknown> {
    if (!dto.clientRequestId) return response;
    const snapshot = JSON.parse(
      JSON.stringify(response),
    ) as Prisma.InputJsonValue;
    const saved = await this.prisma.orderCreationRequest.updateMany({
      where: {
        ownerId,
        requestKey: dto.clientRequestId,
        payloadHash: creationPayloadHash(dto),
        successfulResponse: { equals: Prisma.DbNull },
      },
      data: { successfulResponse: snapshot },
    });
    if (saved.count) return snapshot;
    const existing = await this.lookup(ownerId, dto);
    if (existing?.successfulResponse) return existing.successfulResponse;
    throw new Error('Committed creation identity unavailable for snapshot');
  }
}
