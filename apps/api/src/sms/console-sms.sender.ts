import { Injectable, Logger } from '@nestjs/common';
import { SmsSender } from './sms.interface';

@Injectable()
export class ConsoleSmsSender implements SmsSender {
  private readonly logger = new Logger('SMS');

  async send(phone: string, text: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      // Реального шлюза нет: текст с кодом в production-лог не попадает.
      this.logger.error(`→ ${phone}: SMS-провайдер не подключён, сообщение не доставлено (текст скрыт)`);
      return;
    }
    this.logger.log(`→ ${phone}: ${text}`);
  }
}
