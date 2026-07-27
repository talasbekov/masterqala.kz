import { Logger } from '@nestjs/common';
import { ConsoleSmsSender } from './console-sms.sender';

describe('ConsoleSmsSender', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  function loggerOf(sender: ConsoleSmsSender): Logger {
    return (sender as unknown as { logger: Logger }).logger;
  }

  it('вне production пишет текст с кодом в лог', async () => {
    process.env.NODE_ENV = 'development';
    const sender = new ConsoleSmsSender();
    const log = jest.spyOn(loggerOf(sender), 'log').mockImplementation(() => undefined);
    const error = jest.spyOn(loggerOf(sender), 'error').mockImplementation(() => undefined);

    await sender.send('+77070000001', 'Ваш код подтверждения: 123456');

    expect(log).toHaveBeenCalledWith(expect.stringContaining('123456'));
    expect(error).not.toHaveBeenCalled();
  });

  it('в production скрывает текст сообщения и код', async () => {
    process.env.NODE_ENV = 'production';
    const sender = new ConsoleSmsSender();
    const log = jest.spyOn(loggerOf(sender), 'log').mockImplementation(() => undefined);
    const error = jest.spyOn(loggerOf(sender), 'error').mockImplementation(() => undefined);

    await sender.send('+77070000001', 'Ваш код подтверждения: 123456');

    expect(log).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    const message = error.mock.calls[0][0] as string;
    expect(message).toContain('+77070000001');
    expect(message).not.toContain('123456');
  });
});
