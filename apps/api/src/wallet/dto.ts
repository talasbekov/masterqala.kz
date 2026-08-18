import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { MIN_WITHDRAWAL_TENGE } from './wallet.constants';

export class CreateWithdrawalDto {
  @IsInt()
  @Min(MIN_WITHDRAWAL_TENGE)
  amount!: number;
}

export class SetPayoutAccountDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;
}

export class ResolveWithdrawalDto {
  @IsIn(['PAID', 'FAILED'])
  outcome!: 'PAID' | 'FAILED';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note!: string;
}
