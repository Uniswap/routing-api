module.exports = {
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testEnvironment: 'node',
  testTimeout: 15000,
  setupFiles: ['dotenv/config'],
  setupFilesAfterEnv: ['jest-expect-message', 'jest-sinon'],
};
