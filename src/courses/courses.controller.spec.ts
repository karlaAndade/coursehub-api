import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { CoursesController } from './courses.controller.js';
import { CoursesUseCases } from './application/courses.use-cases.js';
import { UpdateCourseUseCase } from './application/update-course.use-case.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/user-role.enum.js';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';

describe('CoursesController', () => {
  let controller: CoursesController;
  let courses: { findAll: ReturnType<typeof jest.fn> };
  let updateCourse: { execute: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    courses = { findAll: jest.fn() };
    updateCourse = { execute: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [
        { provide: CoursesUseCases, useValue: courses },
        { provide: UpdateCourseUseCase, useValue: updateCourse },
      ],
    }).compile();

    controller = module.get<CoursesController>(CoursesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes the query DTO to the courses service', () => {
    const query = { level: 'beginner', page: 2 };

    controller.findAll(query);

    expect(courses.findAll).toHaveBeenCalledWith(query);
  });

  it('delegates course ID, update DTO, and authenticated identity to the use case', () => {
    const id = 42;
    const dto = { title: 'Updated course' };
    const actor: AuthenticatedUser = {
      id: 12,
      email: 'teacher@example.test',
      role: UserRole.TEACHER,
    };

    const request = { user: actor } as Request & { user: AuthenticatedUser };
    controller.update(id, dto, request);

    expect(updateCourse.execute).toHaveBeenCalledWith(id, dto, actor);
  });

  it('requires an admin role and authentication to delete courses', () => {
    const reflector = new Reflector();
    const remove = CoursesController.prototype.remove;

    expect(
      reflector.getAllAndOverride(ROLES_KEY, [remove, CoursesController]),
    ).toEqual([UserRole.ADMIN]);
    expect(Reflect.getMetadata(GUARDS_METADATA, remove)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
  });

  it('allows admins and teachers to patch courses before checking ownership', () => {
    const reflector = new Reflector();
    const update = CoursesController.prototype.update;

    expect(
      reflector.getAllAndOverride(ROLES_KEY, [update, CoursesController]),
    ).toEqual([UserRole.ADMIN, UserRole.TEACHER]);
    expect(Reflect.getMetadata(GUARDS_METADATA, update)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
  });
});
