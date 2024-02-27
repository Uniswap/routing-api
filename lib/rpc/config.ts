export interface CommonConfig {
  // Wait time for recording next latency evaluation result.
  LATENCY_EVALUATION_WAIT_PERIOD_IN_S: number
}

export interface UniJsonRpcProviderConfig extends CommonConfig {
  // For an unhealthy provider, if it hasn't been used for some time, we can
  // test it out to check its recovery. This defines the time it needs to wait
  // before being tested again, in milliseconds.
  RECOVER_EVALUATION_WAIT_PERIOD_IN_MS: number
  // Do shadow calls on other non-selected healthy providers to monitor their latencies
  ENABLE_SHADOW_LATENCY_EVALUATION: boolean
  // Default initial provider's weight, if not specified.
  DEFAULT_INITIAL_WEIGHT: 1000
}

export interface SingleJsonRpcProviderConfig extends CommonConfig {
  ERROR_PENALTY: number
  HIGH_LATENCY_PENALTY: number
  // If a healthy provider's score drop below this, it will become unhealthy.
  HEALTH_SCORE_FALLBACK_THRESHOLD: number
  // If an unhealthy provider's score raise above this, it will become healthy.
  HEALTH_SCORE_RECOVER_THRESHOLD: number
  // Latency exceeds this will be considered as error.
  MAX_LATENCY_ALLOWED_IN_MS: number
  // As time passes, provider's health score will automatically increase,
  // but will not exceed 0. This defines the score increased every millisecond.
  RECOVER_SCORE_PER_MS: number
  // This is added to prevent an unhealthy provider gain too much recovery score only by
  // waiting a long time to be evaluated.
  RECOVER_MAX_WAIT_TIME_TO_ACKNOWLEDGE_IN_MS: number
  // Flag to enable health state sync with DB.
  ENABLE_DB_SYNC: boolean
  // Time interval to sync with health states from DB
  DB_SYNC_INTERVAL_IN_S: number
  // The length of latency history window to consider.
  LATENCY_STAT_HISTORY_WINDOW_LENGTH_IN_S: number
}

export const DEFAULT_UNI_PROVIDER_CONFIG: UniJsonRpcProviderConfig = {
  RECOVER_EVALUATION_WAIT_PERIOD_IN_MS: 5000,
  ENABLE_SHADOW_LATENCY_EVALUATION: true,
  LATENCY_EVALUATION_WAIT_PERIOD_IN_S: 15,
  DEFAULT_INITIAL_WEIGHT: 1000,
}

// Health score needs to drop below a certain threshold to trigger circuit break (all potentially fallback to other
// providers). If we set the threshold to the lowest possible, there will never be a circuit break.
const NEVER_FALLBACK = Number.MIN_SAFE_INTEGER

export const DEFAULT_SINGLE_PROVIDER_CONFIG: SingleJsonRpcProviderConfig = {
  ERROR_PENALTY: -50,
  HIGH_LATENCY_PENALTY: -20,
  HEALTH_SCORE_FALLBACK_THRESHOLD: NEVER_FALLBACK,
  HEALTH_SCORE_RECOVER_THRESHOLD: -200,
  MAX_LATENCY_ALLOWED_IN_MS: 4000,
  RECOVER_SCORE_PER_MS: 0.01,
  RECOVER_MAX_WAIT_TIME_TO_ACKNOWLEDGE_IN_MS: 60000,
  ENABLE_DB_SYNC: true,
  DB_SYNC_INTERVAL_IN_S: 5,
  LATENCY_STAT_HISTORY_WINDOW_LENGTH_IN_S: 300,
  LATENCY_EVALUATION_WAIT_PERIOD_IN_S: 15,
}

export enum ProviderSpecialWeight {
  // Provider will never receive any traffic.
  // However, it's still being perceived as one of available healthy provider.
  // This is useful when we want to do shadow calls to collect performance metrics.
  NEVER = 0,

  // Provider will be able to serve as a fallback. For detailed logic, please see the TSDoc for
  // UniJsonRpcProvider's constructor
  AS_FALLBACK = -1,
}
