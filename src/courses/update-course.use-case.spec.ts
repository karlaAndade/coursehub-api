import { UserRole } from '../users/user-role.enum.js';
import {
  CourseAccessDeniedError,
  CourseNotFoundError,
} from './domain/course.errors.js';
import type { Course } from './domain/course.js';
import type { CourseRepository } from './domain/course-repository.port.js';
import { UpdateCourseUseCase } from './application/update-course.use-case.js';

describe('UpdateCourseUseCase', () => {
  let useCase: UpdateCourseUseCase;
  let repository: CourseRepository;

  beforeEach(() => {
    repository = {
      findById: vi.fn(),
      save: vi.fn(),
    };
    useCase = new UpdateCourseUseCase(repository);
  });

  it('updates a course for its owning teacher', async () => {
    const course: Course = {
      id: 4,
      title: 'Nest Basics',
      level: 'beginner',
      createdByUserId: 12,
    };
    vi.mocked(repository.findById).mockResolvedValue(course);
    vi.mocked(repository.save).mockImplementation(async (value) => value);

    await expect(
      useCase.execute(
        4,
        { title: 'Updated course' },
        { id: 12, role: UserRole.TEACHER },
      ),
    ).resolves.toEqual({ ...course, title: 'Updated course' });
    expect(repository.save).toHaveBeenCalledWith({
      ...course,
      title: 'Updated course',
    });
  });

  it.each([
    ['a different teacher', 13, UserRole.TEACHER],
    ['a student who is not the owner', 12, UserRole.STUDENT],
  ])('rejects %s without writing to the repository', async (_, id, role) => {
    vi.mocked(repository.findById).mockResolvedValue({
      id: 4,
      title: 'Nest Basics',
      level: 'beginner',
      createdByUserId: 12,
    });

    await expect(
      useCase.execute(4, { title: 'Not allowed' }, { id, role }),
    ).rejects.toThrow(CourseAccessDeniedError);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('allows an administrator to update a course they do not own', async () => {
    const course: Course = {
      id: 4,
      title: 'Nest Basics',
      level: 'beginner',
      createdByUserId: 12,
    };
    vi.mocked(repository.findById).mockResolvedValue(course);
    vi.mocked(repository.save).mockImplementation(async (value) => value);

    await expect(
      useCase.execute(
        4,
        { title: 'Admin update' },
        { id: 1, role: UserRole.ADMIN },
      ),
    ).resolves.toEqual({ ...course, title: 'Admin update' });
  });

  it('reports a missing course without attempting a save', async () => {
    vi.mocked(repository.findById).mockResolvedValue(null);

    await expect(
      useCase.execute(
        404,
        { title: 'Updated course' },
        { id: 12, role: UserRole.TEACHER },
      ),
    ).rejects.toThrow(CourseNotFoundError);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
