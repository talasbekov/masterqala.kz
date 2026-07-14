import { ArrayMinSize, IsArray, IsInt, IsString, Matches, Max, MaxLength, Min, MinLength, IsEnum } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class SubmitApplicationDto {
  @IsString()
  @MinLength(5)
  @MaxLength(150)
  fullName!: string;

  @Matches(/^\d{12}$/, { message: 'ИИН должен состоять из 12 цифр' })
  iin!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  district!: string;

  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  categoryIds!: string[];
}

export class UploadDocumentDto {
  @IsEnum(DocumentType)
  type!: DocumentType;
}
