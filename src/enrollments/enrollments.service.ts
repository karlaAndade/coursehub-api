import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Enrollment } from './entities/enrollment.entity.js';
import { Student } from '../students/entities/student.entity.js';
import { Course } from '../courses/entities/course.entity.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { QueryEnrollmentsDto } from './dto/query-enrollments.dto.js';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(Student)
    private readonly studentsRepository: Repository<Student>,
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
  ) {}

  async create(dto: CreateEnrollmentDto): Promise<Enrollment> {
    // 1. El estudiante existe
    const student = await this.studentsRepository.findOneBy({
      id: dto.studentId,
    });
    if (!student) {
      throw new NotFoundException(
        `No existe el estudiante con id ${dto.studentId}`,
      );
    }

    // 2. El curso existe
    const course = await this.coursesRepository.findOneBy({
      id: dto.courseId,
    });
    if (!course) {
      throw new NotFoundException(`No existe el curso con id ${dto.courseId}`);
    }

    // 3. El estudiante está activo
    if (!student.isActive) {
      throw new BadRequestException(
        'No se puede matricular a un estudiante inactivo',
      );
    }

    // 4. No existe ya la pareja estudiante-curso
    const duplicate = await this.enrollmentsRepository.findOne({
      where: { student: { id: student.id }, course: { id: course.id } },
    });
    if (duplicate) {
      throw new ConflictException(
        'El estudiante ya está matriculado en este curso',
      );
    }

    const enrollment = this.enrollmentsRepository.create({ student, course });
    try {
      return await this.enrollmentsRepository.save(enrollment);
    } catch (error) {
      // Respaldo: la restricción única de PostgreSQL también responde 409
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          'El estudiante ya está matriculado en este curso',
        );
      }
      throw error;
    }
  }

  async findAll(filters: QueryEnrollmentsDto = {}): Promise<Enrollment[]> {
    const where: Record<string, unknown> = {};
    if (filters.studentId !== undefined) {
      where.student = { id: filters.studentId };
    }
    if (filters.courseId !== undefined) {
      where.course = { id: filters.courseId };
    }
    return this.enrollmentsRepository.find({
      where,
      relations: { student: true, course: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findByStudent(studentId: number): Promise<Enrollment[]> {
    const student = await this.studentsRepository.findOneBy({ id: studentId });
    if (!student) {
      throw new NotFoundException(`No existe el estudiante con id ${studentId}`);
    }
    return this.findAll({ studentId });
  }

  async findByCourse(courseId: number): Promise<Enrollment[]> {
    const course = await this.coursesRepository.findOneBy({ id: courseId });
    if (!course) {
      throw new NotFoundException(`No existe el curso con id ${courseId}`);
    }
    return this.findAll({ courseId });
  }

  async remove(id: number): Promise<void> {
    const enrollment = await this.enrollmentsRepository.findOneBy({ id });
    if (!enrollment) {
      throw new NotFoundException(`No existe la matrícula con id ${id}`);
    }
    await this.enrollmentsRepository.remove(enrollment);
  }
}
