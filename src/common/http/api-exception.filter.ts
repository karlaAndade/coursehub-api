import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApplicationError } from '../errors/application-error.js';

type ErrorResponseBody = {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const mapped = this.mapException(exception);

    if (mapped.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.path} returned ${mapped.statusCode}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(mapped.statusCode).json({
      ...mapped,
      timestamp: new Date().toISOString(),
      path: request.path,
    } satisfies ErrorResponseBody);
  }

  private mapException(
    exception: unknown,
  ): Pick<ErrorResponseBody, 'statusCode' | 'error' | 'message'> {
    if (exception instanceof ApplicationError) {
      switch (exception.kind) {
        case 'not_found':
          return {
            statusCode: HttpStatus.NOT_FOUND,
            error: 'Not Found',
            message: exception.message,
          };
        case 'forbidden':
          return {
            statusCode: HttpStatus.FORBIDDEN,
            error: 'Forbidden',
            message: exception.message,
          };
        case 'conflict':
          return {
            statusCode: HttpStatus.CONFLICT,
            error: 'Conflict',
            message: exception.message,
          };
      }
    }
    if (exception instanceof HttpException) {
      return this.mapHttpException(exception);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
    };
  }

  private mapHttpException(
    exception: HttpException,
  ): Pick<ErrorResponseBody, 'statusCode' | 'error' | 'message'> {
    const statusCode = exception.getStatus();
    const payload = exception.getResponse();
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return {
        statusCode,
        error: 'Internal Server Error',
        message: 'Internal server error',
      };
    }

    return {
      statusCode,
      error:
        typeof payload === 'object' &&
        payload !== null &&
        'error' in payload &&
        typeof payload.error === 'string'
          ? payload.error
          : exception.name.replace(/Exception$/, ''),
      message: this.getSafeHttpMessage(payload),
    };
  }

  private getSafeHttpMessage(payload: string | object): string | string[] {
    if (typeof payload === 'string') return payload;
    if ('message' in payload) {
      const message = payload.message;
      if (
        typeof message === 'string' ||
        (Array.isArray(message) &&
          message.every((item) => typeof item === 'string'))
      ) {
        return message;
      }
    }
    return 'Request failed';
  }
}
