import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { ApiExceptionFilter } from '../common/http/api-exception.filter.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';
import { UserRole } from '../users/user-role.enum.js';
import { COURSE_REPOSITORY } from './domain/course-repository.port.js';
import type { Course } from './domain/course.js';
import type { CourseRepository } from './domain/course-repository.port.js';
import { CoursesUseCases } from './application/courses.use-cases.js';
import { CoursesController } from './courses.controller.js';

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

describe('Course authorization over HTTP', () => {
  const identities: Record<string, AuthenticatedUser> = {
    student: { id: 30, email: 'student@example.test', role: UserRole.STUDENT },
    otherTeacher: {
      id: 21,
      email: 'other-teacher@example.test',
      role: UserRole.TEACHER,
    },
    ownerTeacher: {
      id: 20,
      email: 'owner-teacher@example.test',
      role: UserRole.TEACHER,
    },
    admin: { id: 1, email: 'admin@example.test', role: UserRole.ADMIN },
  };
  const jwtAuthGuard = {
    canActivate(context: ExecutionContext) {
      const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
      const token = request.headers.authorization?.replace(/^Bearer /, '');
      const user = token ? identities[token] : undefined;
      if (!user) throw new UnauthorizedException();
      request.user = user;
      return true;
    },
  };

  let app: INestApplication;
  let repository: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    repository = {
      findAll: vi.fn(),
      findById: vi.fn().mockResolvedValue({
        id: 4,
        title: 'Original course',
        level: 'beginner',
        createdByUserId: 20,
      }),
      create: vi.fn(),
      save: vi.fn((course: Course) => Promise.resolve(course)),
      remove: vi.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [
        CoursesUseCases,
        {
          provide: COURSE_REPOSITORY,
          useValue: repository satisfies CourseRepository,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const patchCourse = () =>
    request(app.getHttpServer())
      .patch('/courses/4')
      .send({ title: 'Updated course' });

  it('demonstrates 401, 403, owner access, and admin access on one route', async () => {
    await patchCourse().expect(401);

    await patchCourse().set('Authorization', 'Bearer student').expect(403);

    await patchCourse().set('Authorization', 'Bearer otherTeacher').expect(403);

    await patchCourse()
      .set('Authorization', 'Bearer ownerTeacher')
      .expect(200, {
        id: 4,
        title: 'Updated course',
        level: 'beginner',
        createdByUserId: 20,
      });

    await patchCourse().set('Authorization', 'Bearer admin').expect(200, {
      id: 4,
      title: 'Updated course',
      level: 'beginner',
      createdByUserId: 20,
    });
  });

  it('restricts course deletion to authenticated administrators', async () => {
    await request(app.getHttpServer()).delete('/courses/4').expect(401);

    await request(app.getHttpServer())
      .delete('/courses/4')
      .set('Authorization', 'Bearer student')
      .expect(403);

    await request(app.getHttpServer())
      .delete('/courses/4')
      .set('Authorization', 'Bearer admin')
      .expect(200);
  });
});
