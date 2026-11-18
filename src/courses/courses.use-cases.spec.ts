import { UserRole } from '../users/user-role.enum.js';
import {
  CourseAccessDeniedError,
  CourseNotFoundError,
} from './domain/course.errors.js';
import type { Course } from './domain/course.js';
import type { CourseRepository } from './domain/course-repository.port.js';
import { CoursesUseCases } from './application/courses.use-cases.js';

describe('CoursesUseCases', () => {
  let useCases: CoursesUseCases;
  let repository: CourseRepository;

  beforeEach(() => {
    repository = {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      remove: vi.fn(),
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
    vi.mocked(repository.findAll).mockResolvedValue(result);

    await expect(useCases.findAll(query)).resolves.toEqual(result);
    expect(repository.findAll).toHaveBeenCalledWith(query);
  });

  it('raises a domain not-found error when the course does not exist', async () => {
    vi.mocked(repository.findById).mockResolvedValue(null);

    await expect(useCases.findOne(404)).rejects.toThrow(CourseNotFoundError);
  });

  it('assigns the authenticated creator when creating a course', async () => {
    const input = { title: 'Nest Basics', level: 'beginner' };
    const owner = { id: 12, role: UserRole.TEACHER };
    const created: Course = { id: 4, ...input, createdByUserId: owner.id };
    vi.mocked(repository.create).mockResolvedValue(created);

    await expect(useCases.create(input, owner)).resolves.toEqual(created);
    expect(repository.create).toHaveBeenCalledWith(input, owner.id);
  });

  it('allows the teacher who owns a course to update it', async () => {
    const course: Course = {
      id: 4,
      title: 'Nest Basics',
      level: 'beginner',
      createdByUserId: 12,
    };
    vi.mocked(repository.findById).mockResolvedValue(course);
    vi.mocked(repository.save).mockImplementation(async (value) => value);

    await expect(
      useCases.update(
        4,
        { title: 'Updated course' },
        { id: 12, role: UserRole.TEACHER },
      ),
    ).resolves.toEqual({ ...course, title: 'Updated course' });
  });

  it.each([
    ['another teacher', 13, UserRole.TEACHER],
    ['a student', 12, UserRole.STUDENT],
  ])(
    'denies %s from updating a course they cannot manage',
    async (_, id, role) => {
      vi.mocked(repository.findById).mockResolvedValue({
        id: 4,
        title: 'Nest Basics',
        level: 'beginner',
        createdByUserId: 12,
      });

      await expect(
        useCases.update(4, { title: 'Not allowed' }, { id, role }),
      ).rejects.toThrow(CourseAccessDeniedError);
      expect(repository.save).not.toHaveBeenCalled();
    },
  );

  it('allows an administrator to update a course owned by someone else', async () => {
    const course: Course = {
      id: 4,
      title: 'Nest Basics',
      level: 'beginner',
      createdByUserId: 12,
    };
    vi.mocked(repository.findById).mockResolvedValue(course);
    vi.mocked(repository.save).mockImplementation(async (value) => value);

    await expect(
      useCases.update(
        4,
        { title: 'Updated by admin' },
        { id: 1, role: UserRole.ADMIN },
      ),
    ).resolves.toEqual({ ...course, title: 'Updated by admin' });
  });

  it('removes only a found course through the repository port', async () => {
    const course: Course = {
      id: 4,
      title: 'Nest Basics',
      level: 'beginner',
      createdByUserId: 12,
    };
    vi.mocked(repository.findById).mockResolvedValue(course);

    await expect(useCases.remove(4)).resolves.toEqual(course);
    expect(repository.remove).toHaveBeenCalledWith(course);
  });
});
