import { IsInt, IsOptional, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryEnrollmentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  studentId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  courseId?: number;
}
