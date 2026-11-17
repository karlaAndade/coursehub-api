import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Course } from './entities/course.entity.js';
import { CoursesService } from './courses.service.js';
import { CoursesQueryDto } from './dto/courses-query.dto.js';
import { UserRole } from '../users/user-role.enum.js';
import { ForbiddenException } from '@nestjs/common';

describe('CoursesService', () => {
  let service: CoursesService;
  let coursesRepository: {
    findAndCount: ReturnType<typeof vi.fn>;
    findOneBy: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    coursesRepository = {
      findAndCount: vi.fn(),
      findOneBy: vi.fn(),
      create: vi.fn((course) => course),
      save: vi.fn((course) => course),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        {
          provide: getRepositoryToken(Course),
          useValue: coursesRepository,
        },
      ],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('uses default pagination and returns a consistent response', async () => {
    const items = [{ id: 1, title: 'Nest Basics', level: 'beginner' }];
    coursesRepository.findAndCount.mockResolvedValue([items, 21]);

    await expect(service.findAll(new CoursesQueryDto())).resolves.toEqual({
      items,
      meta: { total: 21, page: 1, limit: 10, totalPages: 3 },
    });
    expect(coursesRepository.findAndCount).toHaveBeenCalledWith({
      where: {},
      order: { id: 'ASC' },
      skip: 0,
      take: 10,
    });
  });

  it('applies level filtering, page offset, and requested ordering', async () => {
    coursesRepository.findAndCount.mockResolvedValue([[], 8]);
    const query = Object.assign(new CoursesQueryDto(), {
      level: 'beginner',
      page: 2,
      limit: 3,
      sortBy: 'title' as const,
      order: 'DESC' as const,
    });

    await expect(service.findAll(query)).resolves.toEqual({
      items: [],
      meta: { total: 8, page: 2, limit: 3, totalPages: 3 },
    });
    expect(coursesRepository.findAndCount).toHaveBeenCalledWith({
      where: { level: 'beginner' },
      order: { title: 'DESC', id: 'ASC' },
      skip: 3,
      take: 3,
    });
  });

  it('assigns the authenticated creator when creating a course', async () => {
    const actor = {
      id: 12,
      email: 'teacher@example.test',
      role: UserRole.TEACHER,
    };
    const dto = { title: 'Nest Basics', level: 'beginner' };

    await service.create(dto, actor);

    expect(coursesRepository.create).toHaveBeenCalledWith({
      ...dto,
      createdByUserId: actor.id,
    });
  });

  it('allows the teacher who owns a course to update it', async () => {
    const course = { id: 4, title: 'Nest Basics', createdByUserId: 12 };
    coursesRepository.findOneBy.mockResolvedValue(course);
    const actor = {
      id: 12,
      email: 'teacher@example.test',
      role: UserRole.TEACHER,
    };

    await expect(
      service.update(4, { title: 'Updated course' }, actor),
    ).resolves.toEqual({ ...course, title: 'Updated course' });
  });

  it.each([
    ['another teacher', 13, UserRole.TEACHER],
    ['a student', 12, UserRole.STUDENT],
  ])(
    'forbids %s from updating a course they cannot manage',
    async (_label, actorId, role) => {
      coursesRepository.findOneBy.mockResolvedValue({
        id: 4,
        title: 'Nest Basics',
        createdByUserId: 12,
      });
      const actor = {
        id: actorId,
        email: 'user@example.test',
        role,
      };

      await expect(
        service.update(4, { title: 'Not allowed' }, actor),
      ).rejects.toThrow(ForbiddenException);
      expect(coursesRepository.save).not.toHaveBeenCalled();
    },
  );

  it('allows an administrator to update a course owned by someone else', async () => {
    const course = { id: 4, title: 'Nest Basics', createdByUserId: 12 };
    coursesRepository.findOneBy.mockResolvedValue(course);
    const admin = { id: 1, email: 'admin@example.test', role: UserRole.ADMIN };

    await expect(
      service.update(4, { title: 'Updated by admin' }, admin),
    ).resolves.toEqual({ ...course, title: 'Updated by admin' });
  });
});
