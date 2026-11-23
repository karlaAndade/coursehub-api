import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { User } from '../src/users/entities/user.entity.js';

describe('CourseHub API (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  const email = `e2e-${randomUUID()}@example.com`;
  const password = 'e2e-only-password';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    accessToken = login.body.accessToken;
  });

  afterAll(async () => {
    if (!app) return;

    try {
      const dataSource = app.get(DataSource);
      if (dataSource.isInitialized) {
        await dataSource.getRepository(User).delete({ email });
      }
    } finally {
      await app.close();
    }
  });

  it('serves the public course list from the test database', async () => {
    const response = await request(app.getHttpServer())
      .get('/courses')
      .expect(200);

    expect(response.body.items).toEqual(expect.any(Array));
    expect(response.body.meta).toMatchObject({
      page: 1,
      limit: 10,
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
  });

  it('serves the public welcome route over HTTP', () => {
    return request(app.getHttpServer())
      .get('/welcome')
      .expect(200)
      .expect({ message: 'Bienvenido a coursehub API' });
  });

  it('authenticates a persisted test user on a protected route', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: expect.any(Number),
      email,
      role: 'student',
    });
  });
});
