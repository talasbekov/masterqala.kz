import { ArrayMaxSize, IsISO8601, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreatePlannedOrderDto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  district!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  entrance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  floor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  apartment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressComment?: string;

  @IsISO8601()
  slotStart!: string;

  @IsISO8601()
  slotEnd!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  budget?: number;

  @IsOptional()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  photoPaths?: string[];
}

export class PlaceBidDto {
  @IsInt()
  @Min(1)
  price!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  term!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class SelectBidDto {
  @IsUUID()
  bidId!: string;
}
