import { jest } from '@jest/globals';
import { UserRole } from '../users/user-role.enum.js';
import { CourseNotFoundError } from './domain/course.errors.js';
import type { Course } from './domain/course.js';
import type { CoursesRepository } from './domain/course-repository.port.js';
import { CoursesUseCases } from './application/courses.use-cases.js';

describe('CoursesUseCases', () => {
  let useCases: CoursesUseCases;
  let repository: CoursesRepository;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    useCases = new CoursesUseCases(repository);
  });

  it('delegates listing and pagination to the repository port', async () => {
    const query = {
      page: 2,
      limit: 3,
      sortBy: 'title' as const,
      order: 'DESC' as const,
      level: 'beginner',
    };
    const result = {
      items: [],
      meta: { total: 8, page: 2, limit: 3, totalPages: 3 },
    };
    jest.mocked(repository.findAll).mockResolvedValue(result);

    await expect(useCases.findAll(query)).resolves.toEqual(result);
    expect(repository.findAll).toHaveBeenCalledWith(query);
  });

  it('raises a domain not-found error when the course does not exist', async () => {
    jest.mocked(repository.findById).mockResolvedValue(null);

    await expect(useCases.findOne(404)).rejects.toThrow(CourseNotFoundError);
  });

  it('assigns the authenticated creator when creating a course', async () => {
    const input = { title: 'Nest Basics', level: 'beginner' };
    const owner = { id: 12, role: UserRole.TEACHER };
    const created: Course = { id: 4, ...input, createdByUserId: owner.id };
    jest.mocked(repository.create).mockResolvedValue(created);

    await expect(useCases.create(input, owner)).resolves.toEqual(created);
    expect(repository.create).toHaveBeenCalledWith(input, owner.id);
  });

  it('removes only a found course through the repository port', async () => {
    const course: Course = {
      id: 4,
      title: 'Nest Basics',
      level: 'beginner',
      createdByUserId: 12,
    };
    jest.mocked(repository.findById).mockResolvedValue(course);

    await expect(useCases.remove(4)).resolves.toEqual(course);
    expect(repository.remove).toHaveBeenCalledWith(course);
  });
});
