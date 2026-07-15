import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PreviewOrderDto {
  @IsUUID()
  categoryId!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class CreateOrderDto extends PreviewOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;
}

export class ProposePriceDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
