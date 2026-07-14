import { Injectable, Logger } from '@nestjs/common';
import { SmsSender } from './sms.interface';

@Injectable()
export class ConsoleSmsSender implements SmsSender {
  private readonly logger = new Logger('SMS');

  async send(phone: string, text: string): Promise<void> {
    this.logger.log(`→ ${phone}: ${text}`);
  }
}
