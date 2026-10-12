import {
  ArrayMaxSize,
  ArrayUnique,
  IsInt,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { STORED_PHOTO_PATH_PATTERN } from '../storage/upload-security';

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

  @IsOptional()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(STORED_PHOTO_PATH_PATTERN, { each: true, message: 'Некорректная ссылка на фото' })
  photoPaths?: string[];
}

export class ProposePriceDto {
  @IsOptional() @IsInt() @Min(0) @Max(2147483647)
  materialsPrice?: number;
  @IsOptional() @IsInt() @Min(0) @Max(2147483647)
  calloutPrice?: number;
  @IsOptional() @IsInt() @Min(0) @Max(2147483647)
  expectedQuoteVersion?: number;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class QuoteVersionDto {
  @IsOptional() @IsInt() @Min(1) @Max(2147483647)
  quoteVersion?: number;
}

export class CancelOrderDto {
  @IsOptional() @IsInt() @Min(0) @Max(2500)
  expectedAmount?: number;
  @IsOptional() @IsDateString()
  expectedUpdatedAt?: string;
  @IsOptional() @IsString() @MaxLength(1000)
  reason?: string;
}
