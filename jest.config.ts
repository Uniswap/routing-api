import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  roots: ['./test'],
  testPathIgnorePatterns: [".d.ts", ".js"],
}

export default config
