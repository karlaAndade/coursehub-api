import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Course } from '../courses/entities/course.entity.js';
import { Student } from '../students/entities/student.entity.js';
import { Enrollment } from './entities/enrollment.entity.js';
import { EnrollmentsService } from './enrollments.service.js';

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;
  let queryBuilder: {
    andWhere: ReturnType<typeof jest.fn>;
    getManyAndCount: ReturnType<typeof jest.fn>;
    leftJoinAndSelect: ReturnType<typeof jest.fn>;
    orderBy: ReturnType<typeof jest.fn>;
    skip: ReturnType<typeof jest.fn>;
    take: ReturnType<typeof jest.fn>;
  };
  let enrollmentsRepository: {
    create: ReturnType<typeof jest.fn>;
    createQueryBuilder: ReturnType<typeof jest.fn>;
    find: ReturnType<typeof jest.fn>;
    findOne: ReturnType<typeof jest.fn>;
    findOneBy: ReturnType<typeof jest.fn>;
    remove: ReturnType<typeof jest.fn>;
    save: ReturnType<typeof jest.fn>;
  };
  let studentsRepository: { findOneBy: ReturnType<typeof jest.fn> };
  let coursesRepository: { findOneBy: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    queryBuilder = {
      andWhere: jest.fn(() => queryBuilder),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      leftJoinAndSelect: jest.fn(() => queryBuilder),
      orderBy: jest.fn(() => queryBuilder),
      skip: jest.fn(() => queryBuilder),
      take: jest.fn(() => queryBuilder),
    };
    enrollmentsRepository = {
      create: jest.fn((value) => value),
      createQueryBuilder: jest.fn(() => queryBuilder),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      remove: jest.fn(),
      save: jest.fn(),
    };
    studentsRepository = { findOneBy: jest.fn() };
    coursesRepository = { findOneBy: jest.fn() };

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

  it('joins student and course and applies related-resource filters', async () => {
    await expect(
      service.findAll({ studentId: 3, courseId: 8, page: 2, limit: 5 }),
    ).resolves.toEqual({
      items: [],
      meta: { total: 0, page: 2, limit: 5 },
    });

    expect(enrollmentsRepository.createQueryBuilder).toHaveBeenCalledWith(
      'enrollment',
    );
    expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(
      1,
      'enrollment.student',
      'student',
    );
    expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(
      2,
      'enrollment.course',
      'course',
    );
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      1,
      'student.id = :studentId',
      { studentId: 3 },
    );
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      2,
      'course.id = :courseId',
      { courseId: 8 },
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('enrollment.id', 'ASC');
    expect(queryBuilder.skip).toHaveBeenCalledWith(5);
    expect(queryBuilder.take).toHaveBeenCalledWith(5);
  });

  it('binds search text as a parameter and combines active-only filtering', async () => {
    const search = "' OR 1=1 --";

    await expect(
      service.findAll({ search, activeOnly: 'true' }),
    ).resolves.toEqual({
      items: [],
      meta: { total: 0, page: 1, limit: 10 },
    });

    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      1,
      '(student.name ILIKE :search OR course.title ILIKE :search)',
      { search: `%${search}%` },
    );
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      2,
      'student.isActive = :active',
      { active: true },
    );
    expect(queryBuilder.getManyAndCount).toHaveBeenCalledTimes(1);
  });

  it('returns an empty paginated collection when no rows match', async () => {
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await expect(service.findAll({ search: 'no-match' })).resolves.toEqual({
      items: [],
      meta: { total: 0, page: 1, limit: 10 },
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
