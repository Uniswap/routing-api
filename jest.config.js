module.exports = {
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testEnvironment: 'node',
  testTimeout: 10000,
  setupFiles: ['dotenv/config'],
  setupFilesAfterEnv: ['jest-expect-message'],
};
