import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, In } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { Course } from '../src/courses/entities/course.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { UserRole } from '../src/users/user-role.enum.js';

describe('CourseHub API (e2e)', () => {
  let app: INestApplication;
  let teacherId: number;
  let teacherToken: string;
  let studentToken: string;
  const runId = randomUUID();
  const teacherEmail = `e2e-teacher-${runId}@example.com`;
  const studentEmail = `e2e-student-${runId}@example.com`;
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
      .send({ email: teacherEmail, password })
      .expect(201)
      .then(({ body }) => {
        teacherId = body.id;
      });

    const dataSource = app.get(DataSource);
    await dataSource
      .getRepository(User)
      .update({ id: teacherId }, { role: UserRole.TEACHER });

    const teacherLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: teacherEmail, password })
      .expect(200);
    teacherToken = teacherLogin.body.accessToken;

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: studentEmail, password })
      .expect(201);

    const studentLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: studentEmail, password })
      .expect(200);
    studentToken = studentLogin.body.accessToken;
  });

  afterEach(async () => {
    if (!app || !teacherId) return;

    await app
      .get(DataSource)
      .getRepository(Course)
      .delete({ createdByUserId: teacherId });
  });

  afterAll(async () => {
    if (!app) return;

    try {
      const dataSource = app.get(DataSource);
      if (dataSource.isInitialized) {
        if (teacherId) {
          await dataSource
            .getRepository(Course)
            .delete({ createdByUserId: teacherId });
        }
        await dataSource
          .getRepository(User)
          .delete({ email: In([teacherEmail, studentEmail]) });
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
      .set('Authorization', 'Bearer ' + studentToken)
      .expect(200);

    expect(response.body).toMatchObject({
      id: expect.any(Number),
      email: studentEmail,
      role: 'student',
    });
  });

  it('allows a teacher to create a course owned by their account', async () => {
    const title = `e2e-course-${runId}`;
    const response = await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', 'Bearer ' + teacherToken)
      .send({ title, level: 'beginner' })
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(Number),
      title,
      level: 'beginner',
      createdByUserId: teacherId,
    });

    await request(app.getHttpServer())
      .get(`/courses/${response.body.id}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: response.body.id,
          title,
          createdByUserId: teacherId,
        });
      });
  });

  it('rejects course creation without an access token', () => {
    return request(app.getHttpServer())
      .post('/courses')
      .send({ title: `unauthenticated-${runId}`, level: 'beginner' })
      .expect(401);
  });

  it('forbids a student from creating a course', () => {
    return request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', 'Bearer ' + studentToken)
      .send({ title: `forbidden-${runId}`, level: 'beginner' })
      .expect(403);
  });
});
