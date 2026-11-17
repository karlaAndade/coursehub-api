import { UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../auth/auth.controller.js';
import { AuthService } from '../auth/auth.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { createCorsOptions } from './cors-options.js';

describe('Security controls', () => {
  const allowedOrigin = 'http://localhost:5173';
  const authService = {
    login: vi.fn().mockResolvedValue({
      accessToken: 'test-access-token',
      user: { id: 1, email: 'user@example.test', role: 'student' },
    }),
    register: vi.fn(),
  };
  const jwtAuthGuard = {
    canActivate: vi.fn((context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest<{
        headers: Record<string, string | undefined>;
      }>();
      if (!request.headers.authorization) throw new UnauthorizedException();
      return true;
    }),
  };

  let app: INestApplication;

  beforeEach(async () => {
    vi.clearAllMocks();
    authService.login.mockResolvedValue({
      accessToken: 'test-access-token',
      user: { id: 1, email: 'user@example.test', role: 'student' },
    });

    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }])],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.enableCors(createCorsOptions(allowedOrigin));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows preflight only for configured browser origins', async () => {
    const allowed = await request(app.getHttpServer())
      .options('/auth/login')
      .set('Origin', allowedOrigin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization')
      .expect(204);

    expect(allowed.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(allowed.headers['access-control-allow-methods']).toContain('POST');
    expect(allowed.headers['access-control-allow-headers']).toContain(
      'Authorization',
    );

    const denied = await request(app.getHttpServer())
      .options('/auth/login')
      .set('Origin', 'https://untrusted.example')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);

    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not treat CORS as authorization and keeps protected routes behind JWT', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', 'https://untrusted.example')
      .send({ email: 'user@example.test', password: 'practice-only' })
      .expect(200);

    expect(login.headers['access-control-allow-origin']).toBeUndefined();
    expect(authService.login).toHaveBeenCalledOnce();

    const protectedResponse = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Origin', allowedOrigin)
      .expect(401);

    expect(protectedResponse.headers['access-control-allow-origin']).toBe(
      allowedOrigin,
    );
    expect(jwtAuthGuard.canActivate).toHaveBeenCalledOnce();
  });

  it('allows five login requests per minute and responds with 429 on the sixth', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.test', password: 'practice-only' })
        .expect(200);
    }

    const limited = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.test', password: 'practice-only' })
      .expect(429);

    expect(authService.login).toHaveBeenCalledTimes(5);
    expect(JSON.stringify(limited.body)).not.toContain('user@example.test');
    expect(JSON.stringify(limited.body)).not.toContain('practice-only');
  });
});
