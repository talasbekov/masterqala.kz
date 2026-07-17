import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class OpenDisputeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}
