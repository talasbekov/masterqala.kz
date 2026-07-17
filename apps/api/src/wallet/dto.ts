import { IsInt, Min } from 'class-validator';
import { MIN_WITHDRAWAL_TENGE } from './wallet.constants';

export class CreateWithdrawalDto {
  @IsInt()
  @Min(MIN_WITHDRAWAL_TENGE)
  amount!: number;
}
