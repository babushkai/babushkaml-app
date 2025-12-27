export interface TrainingMetric {
  epoch: number
  train_loss: number
  val_loss: number
  accuracy: number
}

export interface TrainingState {
  status: 'idle' | 'running' | 'completed' | 'stopped'
  progress: number
  metrics: TrainingMetric[]
  logs: string[]
  start_time?: string
}

export interface ModelConfig {
  learning_rate: number
  hidden_dims: number[]
  dropout: number
  batch_size: number
  epochs: number
  docker_image?: string
}

export interface Model {
  id: string
  name: string
  accuracy: number
  created_at: string
  stage: 'staging' | 'production' | 'archived'
  config: ModelConfig
  format?: 'onnx' | 'pytorch' | 'tensorflow' | 'sklearn' | 'custom'
  size_mb?: number
  version?: string
  description?: string
  tags?: string[]
  uploaded?: boolean
}

export interface Experiment {
  id: string
  model_id: string
  metrics: TrainingMetric[]
  config: ModelConfig
  created_at: string
}

export interface FeatureStats {
  mean: number
  std: number
  min: number
  max: number
}

export interface Features {
  count: number
  columns: string[]
  stats: Record<string, FeatureStats>
}

export interface ABTestResults {
  requests: number
  conversions: number
}

export interface ABTest {
  id: string
  name: string
  model_a: string
  model_b: string
  traffic_split: number
  status: 'running' | 'completed'
  results: {
    a: ABTestResults
    b: ABTestResults
  }
  created_at: string
}

export interface PredictionHistory {
  model_id: string
  model_name: string
  num_predictions: number
  latency_ms: number
  timestamp: string
}

export interface PredictionResult {
  predictions: number[]
  probabilities: number[][]
  latency_ms: number
  model_id: string
  model_name: string
  model_accuracy: number
  model_stage: string
  timestamp: string
}

export interface Service {
  name: string
  url: string
  status: 'online' | 'offline'
  code: number | null
}

// Pipeline types
export interface PipelineStep {
  id: string
  name: string
  type: 'data' | 'preprocess' | 'train' | 'evaluate' | 'deploy'
  status: 'pending' | 'running' | 'completed' | 'failed'
  duration_ms?: number
  error?: string
}

export interface Pipeline {
  id: string
  name: string
  description?: string
  steps: PipelineStep[]
  status: 'idle' | 'running' | 'completed' | 'failed'
  created_at: string
  updated_at?: string
  schedule?: string
  last_run?: string
}

// Monitoring types
export interface DriftMetric {
  feature: string
  baseline_mean: number
  current_mean: number
  drift_score: number
  status: 'normal' | 'warning' | 'critical'
}

export interface ModelPerformance {
  model_id: string
  model_name: string
  accuracy: number
  precision: number
  recall: number
  f1_score: number
  latency_p50: number
  latency_p95: number
  latency_p99: number
  requests_per_minute: number
  error_rate: number
  timestamp: string
}

export interface Alert {
  id: string
  type: 'drift' | 'performance' | 'error' | 'system'
  severity: 'info' | 'warning' | 'critical'
  message: string
  model_id?: string
  created_at: string
  acknowledged: boolean
}

// Dataset types
export interface Dataset {
  id: string
  name: string
  description?: string
  format: 'csv' | 'parquet' | 'json'
  size_mb: number
  rows: number
  columns: number
  created_at: string
  schema?: Record<string, string>
}

export interface AppState {
  services: Record<string, string>
  config: ModelConfig
  features: Features | Record<string, never>
  alerts: Alert[]
  models: Model[]
  experiments: Experiment[]
  ab_tests: ABTest[]
  training: TrainingState
  predictions_history: PredictionHistory[]
  timestamp: string | null
  pipelines?: Pipeline[]
  datasets?: Dataset[]
  monitoring?: {
    drift: DriftMetric[]
    performance: ModelPerformance[]
  }
}

export type Page = 
  | 'dashboard' 
  | 'training' 
  | 'models' 
  | 'upload'
  | 'inference' 
  | 'features' 
  | 'experiments'
  | 'pipelines'
  | 'monitoring'
  | 'datasets'
  | 'settings'
  | 'compare'
  | 'batch'
  | 'api'
  | 'workbench'




