import type { NextFunction, Request, Response } from 'express';
import { createRateLimitMiddleware, InMemoryRateLimiter } from './rate-limit.middleware';

function request(path: string, ip = '203.0.113.10', method = 'POST'): Request {
  return {
    path,
    ip,
    method,
    socket: { remoteAddress: ip },
  } as unknown as Request;
}

function responseMock() {
  const headers = new Map<string, string>();
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = {
    setHeader: jest.fn((name: string, value: string) => headers.set(name, value)),
    status,
  } as unknown as Response;
  return { response, headers, status, json };
}

describe('API rate limit middleware', () => {
  it('ограничивает запросы SMS-кода по IP', () => {
    const limiter = new InMemoryRateLimiter(() => 1_000);
    const middleware = createRateLimitMiddleware(limiter);
    const req = request('/api/v1/auth/request-code');

    for (let index = 0; index < 10; index += 1) {
      middleware(req, responseMock().response, jest.fn());
    }

    const blocked = responseMock();
    const next = jest.fn() as NextFunction;
    middleware(req, blocked.response, next);

    expect(blocked.status).toHaveBeenCalledWith(429);
    expect(blocked.json).toHaveBeenCalledWith({
      statusCode: 429,
      message: 'Слишком много запросов. Повторите позже',
    });
    expect(blocked.headers.get('Retry-After')).toBeDefined();
    expect(next).not.toHaveBeenCalled();
  });

  it('ведёт независимые buckets для разных IP', () => {
    const middleware = createRateLimitMiddleware(new InMemoryRateLimiter(() => 1_000));

    for (let index = 0; index < 10; index += 1) {
      middleware(request('/api/v1/auth/request-code', '203.0.113.10'), responseMock().response, jest.fn());
    }

    const other = responseMock();
    const next = jest.fn() as NextFunction;
    middleware(request('/api/v1/auth/request-code', '203.0.113.11'), other.response, next);

    expect(other.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('сбрасывает bucket после окончания окна', () => {
    let now = 1_000;
    const middleware = createRateLimitMiddleware(new InMemoryRateLimiter(() => now));
    const req = request('/api/v1/auth/request-code');

    for (let index = 0; index < 11; index += 1) {
      middleware(req, responseMock().response, jest.fn());
    }

    now += 10 * 60_000 + 1;
    const fresh = responseMock();
    const next = jest.fn() as NextFunction;
    middleware(req, fresh.response, next);

    expect(fresh.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(fresh.headers.get('RateLimit-Remaining')).toBe('9');
  });

  it('не ограничивает preflight и health-check', () => {
    const middleware = createRateLimitMiddleware(new InMemoryRateLimiter(() => 1_000));

    for (const req of [request('/api/v1/health', '127.0.0.1', 'GET'), request('/api/v1/orders', '127.0.0.1', 'OPTIONS')]) {
      const result = responseMock();
      const next = jest.fn() as NextFunction;
      middleware(req, result.response, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(result.response.setHeader).not.toHaveBeenCalled();
    }
  });
});
