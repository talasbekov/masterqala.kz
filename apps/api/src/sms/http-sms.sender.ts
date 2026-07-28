import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsSender } from './sms.interface';

function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (!(key in values)) {
      throw new Error(`Неизвестный плейсхолдер {{${key}}} в шаблоне SMS HTTP provider`);
    }
    return values[key];
  });
}

/**
 * Универсальный HTTP-адаптер для любого SMS-шлюза, настраиваемый через ENV
 * (SMS_HTTP_URL/SMS_HTTP_METHOD/SMS_HTTP_BODY_TEMPLATE) без правки кода.
 * Плейсхолдеры {{phone}}/{{text}}/{{secret}} подставляются в URL (query-safe,
 * encodeURIComponent) и в тело запроса (JSON-safe, кавычки в шаблоне уже есть).
 */
@Injectable()
export class HttpSmsSender implements SmsSender {
  private readonly logger = new Logger('SMS');
  private readonly url: string;
  private readonly method: 'GET' | 'POST';
  private readonly bodyTemplate: string;
  private readonly contentType: string;
  private readonly secret: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.url = config.getOrThrow<string>('SMS_HTTP_URL');
    this.method = config.getOrThrow<'GET' | 'POST'>('SMS_HTTP_METHOD');
    this.bodyTemplate = config.get<string>('SMS_HTTP_BODY_TEMPLATE') ?? '';
    this.contentType = config.get<string>('SMS_HTTP_CONTENT_TYPE') ?? 'application/json';
    this.secret = config.get<string>('SMS_HTTP_SECRET') ?? '';
    this.timeoutMs = config.getOrThrow<number>('SMS_HTTP_TIMEOUT_MS');
  }

  async send(phone: string, text: string): Promise<void> {
    const url = renderTemplate(this.url, {
      phone: encodeURIComponent(phone),
      text: encodeURIComponent(text),
      secret: encodeURIComponent(this.secret),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const init: RequestInit = { method: this.method, signal: controller.signal };

      if (this.method === 'POST' && this.bodyTemplate) {
        const jsonEscape = (value: string) => JSON.stringify(value).slice(1, -1);
        init.body = renderTemplate(this.bodyTemplate, {
          phone: jsonEscape(phone),
          text: jsonEscape(text),
          secret: jsonEscape(this.secret),
        });
        init.headers = { 'Content-Type': this.contentType };
      }

      const response = await fetch(url, init);
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`SMS provider ответил ${response.status}: ${body.slice(0, 300)}`);
      }
      this.logger.log(`→ ${phone}: отправлено через HTTP provider (${response.status})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Не удалось отправить SMS на ${phone}: ${message}`);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
