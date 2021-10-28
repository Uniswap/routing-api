module.exports = {
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testEnvironment: 'node',
  testTimeout: 30000,
  setupFiles: ['dotenv/config'],
  setupFilesAfterEnv: ['jest-expect-message', 'jest-sinon'],
};
