import { ConfigService } from '@nestjs/config';
import { HttpSmsSender } from './http-sms.sender';

function configFrom(values: Record<string, unknown>): ConfigService {
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      if (!(key in values)) throw new Error(`missing ${key}`);
      return values[key];
    },
  } as unknown as ConfigService;
}

describe('HttpSmsSender', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('подставляет плейсхолдеры в URL query-safe для GET-провайдера', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const sender = new HttpSmsSender(
      configFrom({
        SMS_HTTP_URL: 'https://gate.example.kz/send?to={{phone}}&text={{text}}&key={{secret}}',
        SMS_HTTP_METHOD: 'GET',
        SMS_HTTP_TIMEOUT_MS: 5000,
        SMS_HTTP_SECRET: 'top-secret',
      }),
    );

    await sender.send('+77010000001', 'Ваш код подтверждения: 123456');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://gate.example.kz/send?to=%2B77010000001&text=%D0%92%D0%B0%D1%88%20%D0%BA%D0%BE%D0%B4%20%D0%BF%D0%BE%D0%B4%D1%82%D0%B2%D0%B5%D1%80%D0%B6%D0%B4%D0%B5%D0%BD%D0%B8%D1%8F%3A%20123456&key=top-secret',
    );
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  it('подставляет плейсхолдеры JSON-safe в тело POST-запроса', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 201 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const sender = new HttpSmsSender(
      configFrom({
        SMS_HTTP_URL: 'https://gate.example.kz/send',
        SMS_HTTP_METHOD: 'POST',
        SMS_HTTP_BODY_TEMPLATE: '{"to":"{{phone}}","text":"{{text}}","apiKey":"{{secret}}"}',
        SMS_HTTP_CONTENT_TYPE: 'application/json',
        SMS_HTTP_TIMEOUT_MS: 5000,
        SMS_HTTP_SECRET: 'top "quoted" secret',
      }),
    );

    await sender.send('+77010000001', 'код: "123456"');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://gate.example.kz/send');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({
      to: '+77010000001',
      text: 'код: "123456"',
      apiKey: 'top "quoted" secret',
    });
  });

  it('бросает ошибку с телом ответа при не-2xx статусе', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve('gateway error'),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const sender = new HttpSmsSender(
      configFrom({
        SMS_HTTP_URL: 'https://gate.example.kz/send',
        SMS_HTTP_METHOD: 'GET',
        SMS_HTTP_TIMEOUT_MS: 5000,
      }),
    );

    await expect(sender.send('+77010000001', 'text')).rejects.toThrow('502');
  });

  it('бросает ошибку на неизвестный плейсхолдер в шаблоне', async () => {
    const sender = new HttpSmsSender(
      configFrom({
        SMS_HTTP_URL: 'https://gate.example.kz/send?token={{unknown}}',
        SMS_HTTP_METHOD: 'GET',
        SMS_HTTP_TIMEOUT_MS: 5000,
      }),
    );

    await expect(sender.send('+77010000001', 'text')).rejects.toThrow('unknown');
  });
});
