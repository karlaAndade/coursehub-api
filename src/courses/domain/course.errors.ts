import { ApplicationError } from '../../common/errors/application-error.js';

export class CourseNotFoundError extends ApplicationError {
  constructor() {
    super('not_found', 'Course not found');
    this.name = 'CourseNotFoundError';
  }
}

export class CourseAccessDeniedError extends ApplicationError {
  constructor() {
    super('forbidden', 'You cannot modify this course');
    this.name = 'CourseAccessDeniedError';
  }
}

export class CourseHasEnrollmentsError extends ApplicationError {
  constructor() {
    super('conflict', 'No se puede eliminar un curso con matrículas asociadas');
    this.name = 'CourseHasEnrollmentsError';
  }
}
