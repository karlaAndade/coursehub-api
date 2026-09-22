import { Injectable } from '@nestjs/common';
import { CreateStudentDto } from './dto/create-student.dto/create-student.dto.js';

type Student = CreateStudentDto & { id: number };

@Injectable()
export class StudentsService {
  private nextId = 1;
  private students: Student[] = [];

  findAll() {
    return this.students;
  }

  findOne(id: number): Student | undefined {
    return this.students.find((student) => student.id === id);
  }

  create(createStudentDto: CreateStudentDto) {
    const student: Student = {
      id: this.nextId++,
      ...createStudentDto,
    };

    this.students.push(student);

    return student;
  }
}