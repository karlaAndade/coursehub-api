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
  let queryBuilder: {
    andWhere: ReturnType<typeof vi.fn>;
    getManyAndCount: ReturnType<typeof vi.fn>;
    leftJoinAndSelect: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    skip: ReturnType<typeof vi.fn>;
    take: ReturnType<typeof vi.fn>;
  };
  let enrollmentsRepository: {
    create: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    findOneBy: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let studentsRepository: { findOneBy: ReturnType<typeof vi.fn> };
  let coursesRepository: { findOneBy: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    queryBuilder = {
      andWhere: vi.fn(() => queryBuilder),
      getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
      leftJoinAndSelect: vi.fn(() => queryBuilder),
      orderBy: vi.fn(() => queryBuilder),
      skip: vi.fn(() => queryBuilder),
      take: vi.fn(() => queryBuilder),
    };
    enrollmentsRepository = {
      create: vi.fn((value) => value),
      createQueryBuilder: vi.fn(() => queryBuilder),
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
    expect(queryBuilder.getManyAndCount).toHaveBeenCalledOnce();
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
