export interface LatencyEvaluation {
  apiName: string
  timestampInMs: number
  latencyInMs: number
}

export interface ProviderState {
  healthScore: number
  latencies: LatencyEvaluation[]
}

export interface ProviderStateDiff {
  healthScore: number
  healthScoreDiff: number
  latency: LatencyEvaluation
}
