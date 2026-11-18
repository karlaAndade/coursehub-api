import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggingMiddleware {
  private readonly logger = new Logger(RequestLoggingMiddleware.name);

  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = randomUUID();
    const startedAt = performance.now();
    response.setHeader('x-request-id', requestId);

    response.on('finish', () => {
      this.logger.log(
        JSON.stringify({
          requestId,
          method: request.method,
          path: request.path,
          statusCode: response.statusCode,
          durationMs: Math.round(performance.now() - startedAt),
        }),
      );
    });

    next();
  }
}
