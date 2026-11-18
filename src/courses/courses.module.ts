import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from './entities/course.entity.js';
import { CoursesController } from './courses.controller.js';
import { CoursesUseCases } from './application/courses.use-cases.js';
import { COURSE_REPOSITORY } from './domain/course-repository.port.js';
import { TypeOrmCourseRepository } from './infrastructure/typeorm-course.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([Course])],
  controllers: [CoursesController],
  providers: [
    CoursesUseCases,
    TypeOrmCourseRepository,
    { provide: COURSE_REPOSITORY, useExisting: TypeOrmCourseRepository },
  ],
  exports: [CoursesUseCases],
})
export class CoursesModule {}
