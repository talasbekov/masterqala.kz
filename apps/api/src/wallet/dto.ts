import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
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
