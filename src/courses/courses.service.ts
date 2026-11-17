import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { CoursesQueryDto } from './dto/courses-query.dto.js';
import { Course } from './entities/course.entity.js';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';
import { UserRole } from '../users/user-role.enum.js';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course) private readonly courses: Repository<Course>,
  ) {}

  async findAll(query: CoursesQueryDto) {
    const { level, page, limit, sortBy, order } = query;
    const [items, total] = await this.courses.findAndCount({
      where: level ? { level } : {},
      order: sortBy === 'id' ? { id: order } : { [sortBy]: order, id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number): Promise<Course> {
    const course = await this.courses.findOneBy({ id });
    if (!course) throw new NotFoundException(`Course ${id} not found`);
    return course;
  }

  create(dto: CreateCourseDto, actor: AuthenticatedUser) {
    return this.courses.save(
      this.courses.create({ ...dto, createdByUserId: actor.id }),
    );
  }

  async update(id: number, dto: UpdateCourseDto, actor: AuthenticatedUser) {
    const course = await this.findOne(id);
    const isAdmin = actor.role === UserRole.ADMIN;
    const isOwner = course.createdByUserId === actor.id;
    if (!isAdmin && (actor.role !== UserRole.TEACHER || !isOwner)) {
      throw new ForbiddenException('You cannot modify this course');
    }

    return this.courses.save(Object.assign(course, dto));
  }

  async remove(id: number) {
    const course = await this.findOne(id);
    try {
      await this.courses.remove(course);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23503'
      ) {
        throw new ConflictException(
          'No se puede eliminar un curso con matrículas asociadas',
        );
      }
      throw error;
    }
    return course;
  }
}
