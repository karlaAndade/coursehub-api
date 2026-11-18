import { Inject, Injectable } from '@nestjs/common';
import type {
  Course,
  CourseActor,
  CourseInput,
  CourseListQuery,
  CourseListResult,
  CourseUpdate,
} from '../domain/course.js';
import {
  CourseAccessDeniedError,
  CourseNotFoundError,
} from '../domain/course.errors.js';
import { COURSE_REPOSITORY } from '../domain/course-repository.port.js';
import type { CourseRepository } from '../domain/course-repository.port.js';
import { UserRole } from '../../users/user-role.enum.js';

@Injectable()
export class CoursesUseCases {
  constructor(
    @Inject(COURSE_REPOSITORY)
    private readonly courses: CourseRepository,
  ) {}

  findAll(query: CourseListQuery): Promise<CourseListResult> {
    return this.courses.findAll(query);
  }

  async findOne(id: number): Promise<Course> {
    const course = await this.courses.findById(id);
    if (!course) throw new CourseNotFoundError();
    return course;
  }

  create(input: CourseInput, actor: CourseActor): Promise<Course> {
    return this.courses.create(input, actor.id);
  }

  async update(
    id: number,
    changes: CourseUpdate,
    actor: CourseActor,
  ): Promise<Course> {
    const course = await this.findOne(id);
    const isAdmin = actor.role === UserRole.ADMIN;
    const isOwner = course.createdByUserId === actor.id;
    if (!isAdmin && (actor.role !== UserRole.TEACHER || !isOwner)) {
      throw new CourseAccessDeniedError();
    }

    return this.courses.save({ ...course, ...changes });
  }

  async remove(id: number): Promise<Course> {
    const course = await this.findOne(id);
    await this.courses.remove(course);
    return course;
  }
}
