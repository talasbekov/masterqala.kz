import { Body, Controller, Get, Param, Patch, Post, StreamableFile, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DisputesService } from './disputes.service';
import { OpenDisputeDto, CounterStatementDto } from './dto';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

@Controller()
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post('orders/:id/disputes')
  openForOrder(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: OpenDisputeDto) {
    return this.disputes.openForOrder(user, id, dto);
  }

  @Post('planned-orders/:id/disputes')
  openForPlannedOrder(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: OpenDisputeDto) {
    return this.disputes.openForPlannedOrder(user, id, dto);
  }

  @Post('disputes/:id/evidence')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  addEvidence(@CurrentUser() user: User, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл обязателен');
    return this.disputes.addEvidence(user.id, id, file);
  }

  @Patch('disputes/:id')
  addCounterStatement(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: CounterStatementDto) {
    return this.disputes.addCounterStatement(user.id, id, dto.counterStatement);
  }

  @Get('disputes/:id/evidence/:docPath')
  async evidence(@Param('id') id: string, @Param('docPath') docPath: string) {
    const stream = await this.disputes.getEvidenceStream(id, docPath);
    return new StreamableFile(stream, { type: 'image/jpeg', disposition: 'inline' });
  }
}
