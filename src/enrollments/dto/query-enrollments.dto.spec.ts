import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryEnrollmentsDto } from './query-enrollments.dto.js';

describe('QueryEnrollmentsDto', () => {
  it('transforms numeric filters and applies pagination defaults', async () => {
    const query = plainToInstance(QueryEnrollmentsDto, {
      studentId: '2',
      courseId: '4',
      page: '3',
      limit: '5',
      activeOnly: 'true',
    });

    await expect(validate(query)).resolves.toHaveLength(0);
    expect(query).toMatchObject({
      studentId: 2,
      courseId: 4,
      page: 3,
      limit: 5,
      activeOnly: 'true',
    });

    const defaults = plainToInstance(QueryEnrollmentsDto, {});
    expect(defaults).toMatchObject({ page: 1, limit: 10 });
  });

  it.each([
    { studentId: '0' },
    { courseId: '-1' },
    { page: '0' },
    { limit: '51' },
    { activeOnly: 'yes' },
  ])('rejects invalid query values: %j', async (input) => {
    const query = plainToInstance(QueryEnrollmentsDto, input);

    await expect(validate(query)).resolves.not.toHaveLength(0);
  });
});
