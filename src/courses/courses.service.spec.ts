import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Course } from './entities/course.entity.js';
import { CoursesService } from './courses.service.js';
import { CoursesQueryDto } from './dto/courses-query.dto.js';

describe('CoursesService', () => {
  let service: CoursesService;
  let coursesRepository: { findAndCount: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    coursesRepository = { findAndCount: vi.fn() };
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
});
