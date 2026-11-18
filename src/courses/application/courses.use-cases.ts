import { Inject, Injectable } from '@nestjs/common';
import type {
  Course,
  CourseActor,
  CourseInput,
  CourseListQuery,
  CourseListResult,
} from '../domain/course.js';
import { CourseNotFoundError } from '../domain/course.errors.js';
import { COURSE_REPOSITORY } from '../domain/course-repository.port.js';
import type { CoursesRepository } from '../domain/course-repository.port.js';

@Injectable()
export class CoursesUseCases {
  constructor(
    @Inject(COURSE_REPOSITORY)
    private readonly courses: CoursesRepository,
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

  async remove(id: number): Promise<Course> {
    const course = await this.findOne(id);
    await this.courses.remove(course);
    return course;
  }
}
