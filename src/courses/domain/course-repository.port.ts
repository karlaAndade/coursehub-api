import type {
  Course,
  CourseInput,
  CourseListQuery,
  CourseListResult,
} from './course.js';

export const COURSE_REPOSITORY = Symbol('COURSE_REPOSITORY');

export interface CourseRepository {
  findById(id: number): Promise<Course | null>;
  save(course: Course): Promise<Course>;
}

export interface CoursesRepository extends CourseRepository {
  findAll(query: CourseListQuery): Promise<CourseListResult>;
  create(input: CourseInput, createdByUserId: number): Promise<Course>;
  remove(course: Course): Promise<void>;
}
