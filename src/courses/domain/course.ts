import type { UserRole } from '../../users/user-role.enum.js';

export type Course = {
  id: number;
  title: string;
  level: string;
  createdByUserId: number | null;
};

export type CourseActor = {
  id: number;
  role: UserRole;
};

export type CourseInput = Pick<Course, 'title' | 'level'>;

export type CourseUpdate = Partial<CourseInput>;

export type CourseListQuery = {
  level?: string;
  page: number;
  limit: number;
  sortBy: 'id' | 'title' | 'level';
  order: 'ASC' | 'DESC';
};

export type CourseListResult = {
  items: Course[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};
