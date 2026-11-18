import { Inject, Injectable } from '@nestjs/common';
import type { Course, CourseActor, CourseUpdate } from '../domain/course.js';
import {
  CourseAccessDeniedError,
  CourseNotFoundError,
} from '../domain/course.errors.js';
import { COURSE_REPOSITORY } from '../domain/course-repository.port.js';
import type { CourseRepository } from '../domain/course-repository.port.js';
import { UserRole } from '../../users/user-role.enum.js';

@Injectable()
export class UpdateCourseUseCase {
  constructor(
    @Inject(COURSE_REPOSITORY)
    private readonly courses: CourseRepository,
  ) {}

  async execute(
    id: number,
    changes: CourseUpdate,
    actor: CourseActor,
  ): Promise<Course> {
    const course = await this.courses.findById(id);
    if (!course) throw new CourseNotFoundError();

    const isAdmin = actor.role === UserRole.ADMIN;
    const isOwner = course.createdByUserId === actor.id;
    if (!isAdmin && (actor.role !== UserRole.TEACHER || !isOwner)) {
      throw new CourseAccessDeniedError();
    }

    return this.courses.save({ ...course, ...changes });
  }
}
