import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';

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

export class ResolveDisputeDto {
  @IsBoolean()
  refundServiceFee!: boolean;

  @IsBoolean()
  penalizeMaster!: boolean;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  resolutionNote!: string;
}
