import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExceptionFilter } from './common/http/api-exception.filter.js';
import { RequestLoggingMiddleware } from './common/http/request-logging.middleware.js';
import { ResponseTimeInterceptor } from './common/http/response-time.interceptor.js';
import { createCorsOptions } from './security/cors-options.js';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const requestLogging = new RequestLoggingMiddleware();

  app.enableCors(createCorsOptions(config.getOrThrow<string>('CORS_ORIGINS')));
  app.use(requestLogging.use.bind(requestLogging));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ResponseTimeInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
