import { IsOptional, IsIn, IsString, MaxLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional() @IsIn(['ru','kk','en'])
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  defaultAddress?: string;
}
