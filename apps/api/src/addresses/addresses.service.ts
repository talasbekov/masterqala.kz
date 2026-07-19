import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  listMine(userId: string) {
    return this.prisma.address.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }

  async create(userId: string, dto: CreateAddressDto) {
    if (dto.isDefault) await this.clearDefault(userId);
    return this.prisma.address.create({
      data: {
        userId,
        label: dto.label,
        address: dto.address,
        entrance: dto.entrance ?? null,
        floor: dto.floor ?? null,
        apartment: dto.apartment ?? null,
        comment: dto.comment ?? null,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    await this.guardOwner(userId, id);
    if (dto.isDefault) await this.clearDefault(userId);
    return this.prisma.address.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.guardOwner(userId, id);
    await this.prisma.address.delete({ where: { id } });
  }

  private async guardOwner(userId: string, id: string): Promise<void> {
    const address = await this.prisma.address.findUnique({ where: { id } });
    if (!address) throw new NotFoundException('Адрес не найден');
    if (address.userId !== userId) throw new ForbiddenException('Нет доступа к адресу');
  }

  private async clearDefault(userId: string): Promise<void> {
    await this.prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
  }
}
