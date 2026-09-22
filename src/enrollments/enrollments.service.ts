import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CoursesService } from '../courses/courses.service.js';
import { StudentsService } from '../students/students.service.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';

type Enrollment = {
  id: number;
  studentId: number;
  courseId: number;
};

@Injectable()
export class EnrollmentsService {
  private readonly enrollments: Enrollment[] = [];
  private nextId = 1;

  constructor(
    private readonly studentsService: StudentsService,
    private readonly coursesService: CoursesService,
  ) {}

  create(createEnrollmentDto: CreateEnrollmentDto): Enrollment {
    const { studentId, courseId } = createEnrollmentDto;

    const student = this.studentsService.findOne(studentId);
    if (!student) {
      throw new NotFoundException(
        `El estudiante con id ${studentId} no existe`,
      );
    }

    const course = this.coursesService.findOne(courseId);
    if (!course) {
      throw new NotFoundException(`El curso con id ${courseId} no existe`);
    }

    if (!student.isActive) {
      throw new BadRequestException(
        `El estudiante con id ${studentId} no está activo`,
      );
    }

    const yaExiste = this.enrollments.some(
      (enrollment) =>
        enrollment.studentId === studentId &&
        enrollment.courseId === courseId,
    );
    if (yaExiste) {
      throw new ConflictException(
        `El estudiante ${studentId} ya está matriculado en el curso ${courseId}`,
      );
    }

    const enrollment: Enrollment = {
      id: this.nextId++,
      studentId,
      courseId,
    };
    this.enrollments.push(enrollment);
    return enrollment;
  }

  findAll(studentId?: number, courseId?: number): Enrollment[] {
    return this.enrollments.filter((enrollment) => {
      if (studentId !== undefined && enrollment.studentId !== studentId) {
        return false;
      }
      if (courseId !== undefined && enrollment.courseId !== courseId) {
        return false;
      }
      return true;
    });
  }

  findByStudent(studentId: number): Enrollment[] {
    const student = this.studentsService.findOne(studentId);
    if (!student) {
      throw new NotFoundException(
        `El estudiante con id ${studentId} no existe`,
      );
    }
    return this.enrollments.filter(
      (enrollment) => enrollment.studentId === studentId,
    );
  }

  findByCourse(courseId: number): Enrollment[] {
    const course = this.coursesService.findOne(courseId);
    if (!course) {
      throw new NotFoundException(`El curso con id ${courseId} no existe`);
    }
    return this.enrollments.filter(
      (enrollment) => enrollment.courseId === courseId,
    );
  }

  remove(id: number): Enrollment {
    const index = this.enrollments.findIndex(
      (enrollment) => enrollment.id === id,
    );
    if (index === -1) {
      throw new NotFoundException(`La matrícula con id ${id} no existe`);
    }
    const [removed] = this.enrollments.splice(index, 1);
    return removed;
  }
}