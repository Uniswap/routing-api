export interface Config {
  ERROR_PENALTY: number
  HIGH_LATENCY_PENALTY: number
  HEALTH_SCORE_FALLBACK_THRESHOLD: number
  HEALTH_SCORE_RECOVER_THRESHOLD: number
  MAX_LATENCY_ALLOWED_IN_MS: number
  RECOVER_SCORE_PER_MS: number
  RECOVER_EVALUATION_WAIT_PERIOD_IN_MS: number
  RECOVER_MAX_WAIT_TIME_TO_ACKNOWLEDGE_IN_MS: number
}

export const DEFAULT_CONFIG: Config = {
  ERROR_PENALTY: -50,
  HIGH_LATENCY_PENALTY: -20,
  // If a healthy provider's score drop below this, it will become unhealthy.
  HEALTH_SCORE_FALLBACK_THRESHOLD: -999990,
  // If an unhealthy provider's score raise above this, it will become healthy.
  HEALTH_SCORE_RECOVER_THRESHOLD: -200,
  MAX_LATENCY_ALLOWED_IN_MS: 4000,
  // As time passes, provider's health score will automatically increase,
  // but will not exceed 0. This defines the score increased every millisecond.
  RECOVER_SCORE_PER_MS: 0.01,
  // For an unhealthy provider, if it hasn't been used for some time, we can
  // test it out to check its recovery. This defines the time it needs to wait
  // before being tested again, in milliseconds.
  RECOVER_EVALUATION_WAIT_PERIOD_IN_MS: 5000,
  // This is added to prevent an unhealthy provider gain too much recovery score only by
  // waiting a long time to be evaluated.
  RECOVER_MAX_WAIT_TIME_TO_ACKNOWLEDGE_IN_MS: 60000,
}
