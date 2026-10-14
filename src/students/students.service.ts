import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Student } from './entities/student.entity.js';
import { CreateStudentDto } from './dto/create-student.dto/create-student.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto/update-student.dto.js';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentsRepository: Repository<Student>,
  ) {}

  async create(dto: CreateStudentDto): Promise<Student> {
    await this.ensureEmailIsFree(dto.email);
    const student = this.studentsRepository.create(dto);
    return this.saveStudent(student);
  }

  async findAll(
    filters: { career?: string; semester?: number; isActive?: boolean } = {},
  ): Promise<Student[]> {
    const where: Record<string, unknown> = {};
    if (filters.career !== undefined) where.career = filters.career;
    if (filters.semester !== undefined) where.semester = filters.semester;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    return this.studentsRepository.find({ where, order: { id: 'ASC' } });
  }

  async findOne(id: number): Promise<Student> {
    const student = await this.studentsRepository.findOneBy({ id });
    if (!student) {
      throw new NotFoundException(`No existe el estudiante con id ${id}`);
    }
    return student;
  }

  async update(id: number, dto: UpdateStudentDto): Promise<Student> {
    const student = await this.findOne(id);
    if (dto.email && dto.email !== student.email) {
      await this.ensureEmailIsFree(dto.email, id);
    }
    Object.assign(student, dto);
    await this.saveStudent(student);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const student = await this.findOne(id);
    if (!student.isActive) {
      throw new BadRequestException(
        'No se puede eliminar a un estudiante inactivo',
      );
    }
    try {
      await this.studentsRepository.remove(student);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23503'
      ) {
        throw new ConflictException(
          'No se puede eliminar a un estudiante con matrículas asociadas',
        );
      }
      throw error;
    }
  }

  // Regla en el servicio: el correo no puede pertenecer a otro estudiante
  private async ensureEmailIsFree(email: string, excludeId?: number) {
    const existing = await this.studentsRepository.findOneBy({ email });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `El correo ${email} ya está registrado por otro estudiante`,
      );
    }
  }

  // Respaldo: si PostgreSQL rechaza el correo repetido (código 23505), también es 409
  private async saveStudent(student: Student): Promise<Student> {
    try {
      return await this.studentsRepository.save(student);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          `El correo ${student.email} ya está registrado por otro estudiante`,
        );
      }
      throw error;
    }
  }
}