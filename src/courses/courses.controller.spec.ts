import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/user-role.enum.js';
import { GUARDS_METADATA } from '@nestjs/common/constants';

describe('CoursesController', () => {
  let controller: CoursesController;
  let coursesService: { findAll: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    coursesService = { findAll: vi.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [{ provide: CoursesService, useValue: coursesService }],
    }).compile();

    controller = module.get<CoursesController>(CoursesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes the query DTO to the courses service', () => {
    const query = { level: 'beginner', page: 2 };

    controller.findAll(query);

    expect(coursesService.findAll).toHaveBeenCalledWith(query);
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
