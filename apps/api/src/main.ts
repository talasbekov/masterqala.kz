import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfiguredIoAdapter } from './config/configured-io.adapter';
import { corsOriginsFromValue } from './config/environment';
import { createRateLimitMiddleware } from './security/rate-limit.middleware';
import { createSecurityHeadersMiddleware } from './security/security-headers.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const corsOrigins = corsOriginsFromValue(config.getOrThrow<string>('CORS_ORIGINS'));
  const nodeEnv = config.getOrThrow<string>('NODE_ENV');
  const trustProxyHops = config.getOrThrow<number>('TRUST_PROXY_HOPS');
  const express = app.getHttpAdapter().getInstance();

  express.disable('x-powered-by');
  if (trustProxyHops > 0) express.set('trust proxy', trustProxyHops);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.use(createSecurityHeadersMiddleware(nodeEnv));
  app.use(createRateLimitMiddleware());
  app.useWebSocketAdapter(new ConfiguredIoAdapter(app, corsOrigins));

  await app.listen(config.getOrThrow<number>('PORT'));
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  new Logger('Bootstrap').error(`API не запущен: ${message}`);
  process.exit(1);
});
