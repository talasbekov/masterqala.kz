import { IsNotEmpty, IsString } from 'class-validator';

export class BlockUserDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
