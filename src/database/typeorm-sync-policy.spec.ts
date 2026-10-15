import { shouldSynchronizeSchema } from './typeorm-sync-policy.js';

describe('shouldSynchronizeSchema', () => {
  it('allows synchronization in development when explicitly enabled', () => {
    expect(shouldSynchronizeSchema('development', 'true')).toBe(true);
  });

  it.each(['test', 'production'])(
    'disables synchronization in %s even when requested',
    (nodeEnvironment) => {
      expect(shouldSynchronizeSchema(nodeEnvironment, 'true')).toBe(false);
    },
  );

  it('disables synchronization in development unless explicitly enabled', () => {
    expect(shouldSynchronizeSchema('development', 'false')).toBe(false);
    expect(shouldSynchronizeSchema('development', undefined)).toBe(false);
  });
});