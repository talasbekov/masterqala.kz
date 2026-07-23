import { Controller, Get } from '@nestjs/common';
import { CommercialModeService } from './commercial-mode.service';

@Controller('config')
export class CommercialModeController {
  constructor(private readonly commercialMode: CommercialModeService) {}

  @Get('public')
  getPublicConfig() {
    return this.commercialMode.publicConfig();
  }
}
