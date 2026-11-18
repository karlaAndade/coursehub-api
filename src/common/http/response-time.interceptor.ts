import { Injectable, Logger } from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { finalize, tap } from 'rxjs';

@Injectable()
export class ResponseTimeInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResponseTimeInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = performance.now();
    let durationMs = 0;

    return next.handle().pipe(
      tap({
        next: () => {
          durationMs = Math.round(performance.now() - startedAt);
          response.setHeader('x-response-time-ms', String(durationMs));
        },
        error: () => {
          durationMs = Math.round(performance.now() - startedAt);
          response.setHeader('x-response-time-ms', String(durationMs));
        },
      }),
      finalize(() => {
        this.logger.log(
          JSON.stringify({
            method: request.method,
            path: request.path,
            durationMs,
          }),
        );
      }),
    );
  }
}
