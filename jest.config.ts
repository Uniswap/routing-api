import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  roots: ['./test'],
  transform: {
    // Use swc to speed up ts-jest's sluggish compilation times.
    // Using this cuts the initial time to compile from 6-12 seconds to
    // ~1 second consistently.
    // Inspiration from: https://github.com/kulshekhar/ts-jest/issues/259#issuecomment-1332269911
    //
    // https://swc.rs/docs/usage/jest#usage
    '^.+\\.(t|j)s?$': '@swc/jest',
  },
}

export default config
