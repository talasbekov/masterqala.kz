import { IsNotEmpty, IsString, Length } from 'class-validator';

export class RequestCodeDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;
}

export class VerifyCodeDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
