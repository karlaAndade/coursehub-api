export type ApplicationErrorKind = 'not_found' | 'forbidden' | 'conflict';

export class ApplicationError extends Error {
  constructor(
    readonly kind: ApplicationErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}
