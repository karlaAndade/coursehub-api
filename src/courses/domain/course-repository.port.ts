import type {
  Course,
  CourseInput,
  CourseListQuery,
  CourseListResult,
} from './course.js';

export const COURSE_REPOSITORY = Symbol('COURSE_REPOSITORY');

export interface CourseRepository {
  findAll(query: CourseListQuery): Promise<CourseListResult>;
  findById(id: number): Promise<Course | null>;
  create(input: CourseInput, createdByUserId: number): Promise<Course>;
  save(course: Course): Promise<Course>;
  remove(course: Course): Promise<void>;
}
