import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Student } from '../../students/entities/student.entity.js';
import { Course } from '../../courses/entities/course.entity.js';

@Entity('enrollments')
@Unique(['student', 'course'])
export class Enrollment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Student, (student) => student.enrollments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  student: Relation<Student>;

  @ManyToOne(() => Course, (course) => course.enrollments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  course: Relation<Course>;

  // Extensión opcional: el servidor genera la fecha, el cliente no la envía
  @CreateDateColumn()
  createdAt: Date;
}
