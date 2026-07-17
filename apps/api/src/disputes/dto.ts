import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class OpenDisputeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class CounterStatementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  counterStatement!: string;
}
