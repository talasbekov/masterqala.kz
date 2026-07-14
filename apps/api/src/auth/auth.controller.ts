import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RequestCodeDto, VerifyCodeDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('request-code')
  @HttpCode(204)
  async requestCode(@Body() dto: RequestCodeDto): Promise<void> {
    await this.auth.requestCode(dto.phone);
  }

  @Post('verify-code')
  @HttpCode(200)
  verifyCode(@Body() dto: VerifyCodeDto) {
    return this.auth.verifyCode(dto.phone, dto.code);
  }
}
