import type { NextFunction, Request, Response } from 'express';

const BASE_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Cross-Origin-Resource-Policy': 'same-site',
};

export function createSecurityHeadersMiddleware(nodeEnv: string) {
  return (_request: Request, response: Response, next: NextFunction): void => {
    for (const [name, value] of Object.entries(BASE_HEADERS)) {
      response.setHeader(name, value);
    }

    if (nodeEnv === 'production') {
      response.setHeader('Strict-Transport-Security', 'max-age=15552000');
    }

    next();
  };
}
