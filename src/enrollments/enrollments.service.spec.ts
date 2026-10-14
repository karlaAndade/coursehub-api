import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Course } from '../courses/entities/course.entity.js';
import { Student } from '../students/entities/student.entity.js';
import { Enrollment } from './entities/enrollment.entity.js';
import { EnrollmentsService } from './enrollments.service.js';

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;
  let enrollmentsRepository: {
    create: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    findOneBy: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let studentsRepository: { findOneBy: ReturnType<typeof vi.fn> };
  let coursesRepository: { findOneBy: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    enrollmentsRepository = {
      create: vi.fn((value) => value),
      find: vi.fn(),
      findOne: vi.fn(),
      findOneBy: vi.fn(),
      remove: vi.fn(),
      save: vi.fn(),
    };
    studentsRepository = { findOneBy: vi.fn() };
    coursesRepository = { findOneBy: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentsService,
        {
          provide: getRepositoryToken(Enrollment),
          useValue: enrollmentsRepository,
        },
        { provide: getRepositoryToken(Student), useValue: studentsRepository },
        { provide: getRepositoryToken(Course), useValue: coursesRepository },
      ],
    }).compile();

    service = module.get<EnrollmentsService>(EnrollmentsService);
  });

  it('creates an enrollment for an active student and existing course', async () => {
    const student = { id: 3, isActive: true };
    const course = { id: 8 };
    const enrollment = { student, course };
    studentsRepository.findOneBy.mockResolvedValue(student);
    coursesRepository.findOneBy.mockResolvedValue(course);
    enrollmentsRepository.findOne.mockResolvedValue(null);
    enrollmentsRepository.save.mockResolvedValue(enrollment);

    await expect(service.create({ studentId: 3, courseId: 8 })).resolves.toBe(
      enrollment,
    );
    expect(enrollmentsRepository.create).toHaveBeenCalledWith({
      student,
      course,
    });
    expect(enrollmentsRepository.save).toHaveBeenCalledWith(enrollment);
  });

  it('returns 404 when the student does not exist', async () => {
    studentsRepository.findOneBy.mockResolvedValue(null);

    await expect(
      service.create({ studentId: 3, courseId: 8 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(coursesRepository.findOneBy).not.toHaveBeenCalled();
  });

  it('returns 404 when the course does not exist', async () => {
    studentsRepository.findOneBy.mockResolvedValue({ id: 3, isActive: true });
    coursesRepository.findOneBy.mockResolvedValue(null);

    await expect(
      service.create({ studentId: 3, courseId: 8 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an inactive student', async () => {
    studentsRepository.findOneBy.mockResolvedValue({ id: 3, isActive: false });

    await expect(
      service.create({ studentId: 3, courseId: 8 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(coursesRepository.findOneBy).not.toHaveBeenCalled();
  });

  it('rejects a duplicate student-course pair', async () => {
    studentsRepository.findOneBy.mockResolvedValue({ id: 3, isActive: true });
    coursesRepository.findOneBy.mockResolvedValue({ id: 8 });
    enrollmentsRepository.findOne.mockResolvedValue({ id: 1 });

    await expect(
      service.create({ studentId: 3, courseId: 8 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(enrollmentsRepository.save).not.toHaveBeenCalled();
  });

  it('loads related student and course data when listing enrollments', async () => {
    enrollmentsRepository.find.mockResolvedValue([]);

    await service.findAll({ studentId: 3, courseId: 8 });

    expect(enrollmentsRepository.find).toHaveBeenCalledWith({
      where: { student: { id: 3 }, course: { id: 8 } },
      relations: { student: true, course: true },
      order: { createdAt: 'DESC' },
    });
  });

  it('removes an existing enrollment', async () => {
    const enrollment = { id: 12 };
    enrollmentsRepository.findOneBy.mockResolvedValue(enrollment);

    await expect(service.remove(12)).resolves.toBeUndefined();
    expect(enrollmentsRepository.remove).toHaveBeenCalledWith(enrollment);
  });

  it('returns 404 when removing a missing enrollment', async () => {
    enrollmentsRepository.findOneBy.mockResolvedValue(null);

    await expect(service.remove(12)).rejects.toBeInstanceOf(NotFoundException);
    expect(enrollmentsRepository.remove).not.toHaveBeenCalled();
  });
});
