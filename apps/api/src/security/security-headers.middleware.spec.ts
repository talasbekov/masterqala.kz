import type { NextFunction, Request, Response } from 'express';
import { createSecurityHeadersMiddleware } from './security-headers.middleware';

function responseMock() {
  const headers = new Map<string, string>();
  const response = {
    setHeader: jest.fn((name: string, value: string) => headers.set(name, value)),
  } as unknown as Response;
  return { response, headers };
}

describe('security headers middleware', () => {
  it('добавляет базовые защитные заголовки', () => {
    const { response, headers } = responseMock();
    const next = jest.fn() as NextFunction;

    createSecurityHeadersMiddleware('test')({} as Request, response, next);

    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(headers.get('Permissions-Policy')).toContain('camera=()');
    expect(headers.has('Strict-Transport-Security')).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('добавляет HSTS только в production', () => {
    const { response, headers } = responseMock();

    createSecurityHeadersMiddleware('production')({} as Request, response, jest.fn());

    expect(headers.get('Strict-Transport-Security')).toBe('max-age=15552000');
  });
});
