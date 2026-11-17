import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { UserRole } from '../../users/user-role.enum.js';

describe('RolesGuard', () => {
  const handler = () => undefined;
  const controller = class {};
  const reflector = {
    getAllAndOverride: vi.fn(),
  };
  let guard: RolesGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  function context(user?: { id: number; email: string; role: UserRole }) {
    return {
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as never;
  }

  it('allows a route without role metadata', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(context())).toBe(true);
  });

  it('allows an authenticated user with an allowed role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(
      guard.canActivate(
        context({ id: 1, email: 'admin@example.test', role: UserRole.ADMIN }),
      ),
    ).toBe(true);
  });

  it('denies an authenticated user without an allowed role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(
      guard.canActivate(
        context({
          id: 2,
          email: 'student@example.test',
          role: UserRole.STUDENT,
        }),
      ),
    ).toBe(false);
  });

  it('returns unauthorized when role-protected route has no authenticated user', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
  });
});
