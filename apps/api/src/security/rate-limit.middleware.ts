import type { NextFunction, Request, Response } from 'express';

interface RateLimitPolicy {
  name: string;
  max: number;
  windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

interface ConsumeResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const GLOBAL_POLICY: RateLimitPolicy = { name: 'global', max: 180, windowMs: 60_000 };
const AUTH_REQUEST_POLICY: RateLimitPolicy = { name: 'auth-request', max: 10, windowMs: 10 * 60_000 };
const AUTH_VERIFY_POLICY: RateLimitPolicy = { name: 'auth-verify', max: 30, windowMs: 10 * 60_000 };
const UPLOAD_POLICY: RateLimitPolicy = { name: 'upload', max: 30, windowMs: 60_000 };

function policyFor(request: Request): RateLimitPolicy {
  if (request.method === 'POST' && request.path.endsWith('/auth/request-code')) return AUTH_REQUEST_POLICY;
  if (request.method === 'POST' && request.path.endsWith('/auth/verify-code')) return AUTH_VERIFY_POLICY;
  if (
    request.method === 'POST' &&
    (request.path.endsWith('/uploads') ||
      request.path.endsWith('/masters/application/documents') ||
      /\/disputes\/[^/]+\/evidence$/.test(request.path))
  ) {
    return UPLOAD_POLICY;
  }
  return GLOBAL_POLICY;
}

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private operations = 0;

  constructor(private readonly now: () => number = Date.now) {}

  consume(key: string, policy: RateLimitPolicy): ConsumeResult {
    const currentTime = this.now();
    const bucketKey = `${policy.name}:${key}`;
    const existing = this.buckets.get(bucketKey);

    const bucket = !existing || existing.resetAt <= currentTime
      ? { count: 0, resetAt: currentTime + policy.windowMs }
      : existing;

    bucket.count += 1;
    this.buckets.set(bucketKey, bucket);

    this.operations += 1;
    if (this.operations % 1000 === 0) this.sweep(currentTime);

    return {
      allowed: bucket.count <= policy.max,
      remaining: Math.max(0, policy.max - bucket.count),
      resetAt: bucket.resetAt,
    };
  }

  private sweep(currentTime: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= currentTime) this.buckets.delete(key);
    }
  }
}

function requestIp(request: Request): string {
  return request.ip || request.socket.remoteAddress || 'unknown';
}

export function createRateLimitMiddleware(limiter = new InMemoryRateLimiter()) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (request.method === 'OPTIONS' || request.path.endsWith('/health')) {
      next();
      return;
    }

    const policy = policyFor(request);
    const result = limiter.consume(requestIp(request), policy);
    const resetSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));

    response.setHeader('RateLimit-Limit', String(policy.max));
    response.setHeader('RateLimit-Remaining', String(result.remaining));
    response.setHeader('RateLimit-Reset', String(resetSeconds));

    if (!result.allowed) {
      response.setHeader('Retry-After', String(resetSeconds));
      response.status(429).json({
        statusCode: 429,
        message: 'Слишком много запросов. Повторите позже',
      });
      return;
    }

    next();
  };
}
