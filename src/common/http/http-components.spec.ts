import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { RequestLoggingMiddleware } from './request-logging.middleware.js';
import { ResponseTimeInterceptor } from './response-time.interceptor.js';
import { CourseNotFoundError } from '../../courses/domain/course.errors.js';
import { CreateCourseDto } from '../../courses/dto/create-course.dto.js';

@Controller('http-components-test')
class HttpComponentsTestController {
  @Get('bad-id/:id')
  badId(@Param('id', ParseIntPipe) id: number) {
    return { id };
  }

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

  @Get('slow')
  async slow() {
    await new Promise((resolve) => setTimeout(resolve, 15));
    return { ok: true };
  }

  @Post('invalid-body')
  invalidBody(@Body() body: CreateCourseDto) {
    return body;
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
    app.useGlobalInterceptors(new ResponseTimeInterceptor());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
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

  it('maps invalid path parameters to a consistent 400 response', async () => {
    await request(app.getHttpServer())
      .get('/http-components-test/bad-id/not-a-number')
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          statusCode: 400,
          error: 'Bad Request',
          path: '/http-components-test/bad-id/not-a-number',
        });
        expect(body.timestamp).toEqual(expect.any(String));
      });
  });

  it('validates request bodies through the global validation pipe', async () => {
    await request(app.getHttpServer())
      .post('/http-components-test/invalid-body')
      .send({ title: '', level: 'invalid' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.statusCode).toBe(400);
        expect(body.error).toBe('Bad Request');
        expect(body.message).toEqual(expect.any(Array));
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

  it('adds response duration and logs timing without query parameters', async () => {
    const logger = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => {});

    const response = await request(app.getHttpServer())
      .get('/http-components-test/ok?token=do-not-log')
      .expect(200);

    expect(response.headers['x-response-time-ms']).toMatch(/^\d+$/);
    const timingLog = logger.mock.calls
      .map(([message]) => String(message))
      .find((message) => message.includes('"durationMs"'));
    expect(timingLog).toContain('/http-components-test/ok');
    expect(timingLog).not.toContain('do-not-log');
  });

  it('measures a slow operation', async () => {
    const response = await request(app.getHttpServer())
      .get('/http-components-test/slow')
      .expect(200);

    expect(
      Number(response.headers['x-response-time-ms']),
    ).toBeGreaterThanOrEqual(10);
  });
});
