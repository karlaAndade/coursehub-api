import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CourseHasEnrollmentsError } from '../domain/course.errors.js';
import type {
  Course,
  CourseInput,
  CourseListQuery,
  CourseListResult,
} from '../domain/course.js';
import type { CourseRepository } from '../domain/course-repository.port.js';
import { Course as CourseEntity } from '../entities/course.entity.js';

@Injectable()
export class TypeOrmCourseRepository implements CourseRepository {
  constructor(
    @InjectRepository(CourseEntity)
    private readonly repository: Repository<CourseEntity>,
  ) {}

  async findAll(query: CourseListQuery): Promise<CourseListResult> {
    const { level, page, limit, sortBy, order } = query;
    const [entities, total] = await this.repository.findAndCount({
      where: level ? { level } : {},
      order: sortBy === 'id' ? { id: order } : { [sortBy]: order, id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: entities.map((entity) => this.toDomain(entity)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: number): Promise<Course | null> {
    const entity = await this.repository.findOneBy({ id });
    return entity ? this.toDomain(entity) : null;
  }

  async create(input: CourseInput, createdByUserId: number): Promise<Course> {
    const entity = this.repository.create({ ...input, createdByUserId });
    return this.toDomain(await this.repository.save(entity));
  }

  async save(course: Course): Promise<Course> {
    return this.toDomain(
      await this.repository.save(this.repository.create(course)),
    );
  }

  async remove(course: Course): Promise<void> {
    try {
      await this.repository.remove(this.repository.create(course));
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23503'
      ) {
        throw new CourseHasEnrollmentsError();
      }
      throw error;
    }
  }

  private toDomain(entity: CourseEntity): Course {
    return {
      id: entity.id,
      title: entity.title,
      level: entity.level,
      createdByUserId: entity.createdByUserId,
    };
  }
}
