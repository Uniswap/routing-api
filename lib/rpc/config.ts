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
}

export const DEFAULT_SINGLE_PROVIDER_CONFIG: SingleJsonRpcProviderConfig = {
  ERROR_PENALTY: -50,
  HIGH_LATENCY_PENALTY: -20,
  HEALTH_SCORE_FALLBACK_THRESHOLD: -999990,
  HEALTH_SCORE_RECOVER_THRESHOLD: -200,
  MAX_LATENCY_ALLOWED_IN_MS: 4000,
  RECOVER_SCORE_PER_MS: 0.01,
  RECOVER_MAX_WAIT_TIME_TO_ACKNOWLEDGE_IN_MS: 60000,
  ENABLE_DB_SYNC: true,
  DB_SYNC_INTERVAL_IN_S: 5,
  LATENCY_STAT_HISTORY_WINDOW_LENGTH_IN_S: 300,
  LATENCY_EVALUATION_WAIT_PERIOD_IN_S: 15,
}
