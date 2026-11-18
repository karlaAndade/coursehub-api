module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  testPathIgnorePatterns: [
    '<rootDir>/src/security/security-controls\\.spec\\.ts$',
  ],
  moduleNameMapper: {
    '^@nestjs/throttler$': '<rootDir>/test-support/nest-throttler.mock.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  clearMocks: true,
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            decorators: true,
          },
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true,
          },
          target: 'es2022',
        },
        module: { type: 'es6' },
      },
    ],
  },
};
