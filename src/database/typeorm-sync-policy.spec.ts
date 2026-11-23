import { shouldSynchronizeSchema } from './typeorm-sync-policy.js';

describe('shouldSynchronizeSchema', () => {
  it('allows synchronization in development when explicitly enabled', () => {
    expect(shouldSynchronizeSchema('development', 'true', 'coursehub')).toBe(
      true,
    );
  });

  it('allows synchronization in test only for a dedicated test database', () => {
    expect(shouldSynchronizeSchema('test', 'true', 'coursehub_test')).toBe(
      true,
    );
    expect(shouldSynchronizeSchema('test', 'true', 'coursehub')).toBe(false);
  });

  it('disables synchronization in production even when requested', () => {
    expect(
      shouldSynchronizeSchema('production', 'true', 'coursehub_test'),
    ).toBe(false);
  });

  it('disables synchronization in development unless explicitly enabled', () => {
    expect(shouldSynchronizeSchema('development', 'false', 'coursehub')).toBe(
      false,
    );
    expect(shouldSynchronizeSchema('development', undefined, 'coursehub')).toBe(
      false,
    );
  });
});
