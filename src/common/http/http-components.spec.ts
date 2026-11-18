import { Controller, Get, Logger } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { RequestLoggingMiddleware } from './request-logging.middleware.js';
import { CourseNotFoundError } from '../../courses/domain/course.errors.js';

@Controller('http-components-test')
class HttpComponentsTestController {
  @Get('domain-error')
  throwDomainError(): never {
    throw new CourseNotFoundError();
  }

  @Get('unexpected-error')
  throwUnexpectedError(): never {
    throw new Error('database connection secret');
  }

  @Get('ok')
  ok() {
    return { ok: true };
  }
}

describe('Global HTTP components', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HttpComponentsTestController],
    }).compile();
    app = moduleRef.createNestApplication();
    const requestLogging = new RequestLoggingMiddleware();
    app.use(requestLogging.use.bind(requestLogging));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('returns a consistent error response for domain errors', async () => {
    await request(app.getHttpServer())
      .get('/http-components-test/domain-error')
      .expect(404)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          statusCode: 404,
          error: 'Not Found',
          message: 'Course not found',
          path: '/http-components-test/domain-error',
        });
        expect(body.timestamp).toEqual(expect.any(String));
      });
  });

  it('does not expose unexpected internal error messages', async () => {
    const logger = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});

    await request(app.getHttpServer())
      .get('/http-components-test/unexpected-error')
      .expect(500)
      .expect(({ body }) => {
        expect(body.message).toBe('Internal server error');
        expect(JSON.stringify(body)).not.toContain(
          'database connection secret',
        );
      });

    expect(logger).toHaveBeenCalledOnce();
  });

  it('assigns a request ID and logs only request metadata, not query secrets', async () => {
    const logger = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => {});

    const response = await request(app.getHttpServer())
      .get('/http-components-test/ok?token=do-not-log')
      .expect(200);

    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
    const logMessage = String(logger.mock.calls[0]?.[0]);
    expect(logMessage).toContain('/http-components-test/ok');
    expect(logMessage).not.toContain('do-not-log');
  });
});
