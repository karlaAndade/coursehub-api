import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Enrollment } from '../../enrollments/entities/enrollment.entity.js';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true, length: 150 })
  email: string;

  @Column({ type: 'int' })
  age: number;

  @Column({ length: 100 })
  career: string;

  @Column({ type: 'int' })
  semester: number;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.student)
  enrollments: Enrollment[];
}