import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CoursesQueryDto } from './courses-query.dto.js';

describe('CoursesQueryDto', () => {
  it('transforms query values and supplies defaults', async () => {
    const query = plainToInstance(CoursesQueryDto, {
      page: '2',
      limit: '5',
      order: 'desc',
    });

    await expect(validate(query)).resolves.toHaveLength(0);
    expect(query).toMatchObject({
      page: 2,
      limit: 5,
      sortBy: 'id',
      order: 'DESC',
    });
  });

  it.each([
    { page: '0' },
    { limit: '200' },
    { sortBy: 'createdAt' },
    { order: 'sideways' },
  ])('rejects invalid query parameters: %j', async (input) => {
    const query = plainToInstance(CoursesQueryDto, input);

    await expect(validate(query)).resolves.not.toHaveLength(0);
  });
});