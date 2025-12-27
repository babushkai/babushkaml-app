import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Database,
  Cpu,
  Brain,
  CheckCircle,
  Rocket,
  Clock,
  AlertCircle,
  ChevronRight,
  Settings,
} from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { AppState, Pipeline, PipelineStep } from '@/types'

interface PipelinesProps {
  state: AppState
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

const STEP_ICONS: Record<PipelineStep['type'], React.ElementType> = {
  data: Database,
  preprocess: Cpu,
  train: Brain,
  evaluate: CheckCircle,
  deploy: Rocket,
}

const STEP_COLORS: Record<PipelineStep['status'], string> = {
  pending: 'text-[var(--text-muted)] bg-[var(--bg-tertiary)]',
  running: 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 animate-pulse',
  completed: 'text-[var(--success)] bg-[var(--success)]/10',
  failed: 'text-[var(--error)] bg-[var(--error)]/10',
}

// Demo pipelines
const DEMO_PIPELINES: Pipeline[] = [
  {
    id: 'pipeline_1',
    name: 'Training Pipeline',
    description: 'End-to-end model training workflow',
    status: 'idle',
    steps: [
      { id: 's1', name: 'Load Data', type: 'data', status: 'completed', duration_ms: 1200 },
      { id: 's2', name: 'Preprocess', type: 'preprocess', status: 'completed', duration_ms: 3400 },
      { id: 's3', name: 'Train Model', type: 'train', status: 'completed', duration_ms: 45000 },
      { id: 's4', name: 'Evaluate', type: 'evaluate', status: 'completed', duration_ms: 2100 },
      { id: 's5', name: 'Deploy', type: 'deploy', status: 'pending' },
    ],
    created_at: new Date(Date.now() - 86400000).toISOString(),
    last_run: new Date(Date.now() - 3600000).toISOString(),
    schedule: '0 0 * * *',
  },
  {
    id: 'pipeline_2',
    name: 'Feature Engineering',
    description: 'Generate and validate features',
    status: 'running',
    steps: [
      { id: 's1', name: 'Extract Raw Data', type: 'data', status: 'completed', duration_ms: 2500 },
      { id: 's2', name: 'Transform Features', type: 'preprocess', status: 'running' },
      { id: 's3', name: 'Validate Schema', type: 'evaluate', status: 'pending' },
    ],
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'pipeline_3',
    name: 'Model Retraining',
    description: 'Automated retraining on new data',
    status: 'failed',
    steps: [
      { id: 's1', name: 'Fetch New Data', type: 'data', status: 'completed', duration_ms: 1800 },
      { id: 's2', name: 'Merge Datasets', type: 'preprocess', status: 'failed', error: 'Schema mismatch' },
      { id: 's3', name: 'Retrain', type: 'train', status: 'pending' },
      { id: 's4', name: 'Compare Models', type: 'evaluate', status: 'pending' },
    ],
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
]

function formatDuration(ms?: number): string {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function Pipelines({ addToast }: PipelinesProps) {
  const [pipelines, setPipelines] = useState<Pipeline[]>(DEMO_PIPELINES)
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(DEMO_PIPELINES[0])

  const handleRunPipeline = async (pipelineId: string) => {
    setPipelines(prev => prev.map(p => 
      p.id === pipelineId 
        ? { ...p, status: 'running' as const, steps: p.steps.map(s => ({ ...s, status: 'pending' as const })) }
        : p
    ))
    addToast('Pipeline started', 'success')

    // Simulate pipeline execution
    const pipeline = pipelines.find(p => p.id === pipelineId)
    if (pipeline) {
      for (let i = 0; i < pipeline.steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 1500))
        setPipelines(prev => prev.map(p => {
          if (p.id !== pipelineId) return p
          const newSteps = [...p.steps]
          newSteps[i] = { ...newSteps[i], status: 'completed' as const, duration_ms: Math.random() * 5000 + 1000 }
          if (i + 1 < newSteps.length) {
            newSteps[i + 1] = { ...newSteps[i + 1], status: 'running' as const }
          }
          return { ...p, steps: newSteps }
        }))
      }
      setPipelines(prev => prev.map(p => 
        p.id === pipelineId ? { ...p, status: 'completed' as const } : p
      ))
      addToast('Pipeline completed successfully', 'success')
    }
  }

  const handleStopPipeline = (pipelineId: string) => {
    setPipelines(prev => prev.map(p => 
      p.id === pipelineId ? { ...p, status: 'idle' as const } : p
    ))
    addToast('Pipeline stopped', 'warning')
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-6"
    >
      {/* Pipeline List */}
      <div className="lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Pipelines
          </h2>
          <Button size="sm" onClick={() => addToast('Create pipeline (coming soon)', 'info')}>
            <Plus className="w-4 h-4" />
            New
          </Button>
        </div>

        <div className="space-y-2">
          {pipelines.map((pipeline) => (
            <button
              key={pipeline.id}
              onClick={() => setSelectedPipeline(pipeline)}
              className={cn(
                'w-full text-left p-4 rounded-[var(--radius-lg)] border transition-all duration-200',
                selectedPipeline?.id === pipeline.id
                  ? 'bg-[var(--accent-primary)]/5 border-[var(--accent-primary)]/30'
                  : 'bg-[var(--bg-secondary)] border-[var(--border-primary)] hover:border-[var(--border-accent)]'
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-[var(--text-primary)]">{pipeline.name}</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{pipeline.description}</p>
                </div>
                <Badge
                  variant={
                    pipeline.status === 'running' ? 'accent' :
                    pipeline.status === 'completed' ? 'success' :
                    pipeline.status === 'failed' ? 'error' : 'default'
                  }
                >
                  {pipeline.status}
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-[var(--text-subtle)]">
                <span>{pipeline.steps.length} steps</span>
                {pipeline.last_run && (
                  <span>Last run: {formatDate(pipeline.last_run)}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Pipeline Details */}
      <div className="lg:col-span-2">
        {selectedPipeline ? (
          <Card>
            <CardHeader
              title={selectedPipeline.name}
              action={
                <div className="flex items-center gap-2">
                  {selectedPipeline.status === 'running' ? (
                    <Button size="sm" onClick={() => handleStopPipeline(selectedPipeline.id)}>
                      <Pause className="w-4 h-4" />
                      Stop
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleRunPipeline(selectedPipeline.id)}
                    >
                      <Play className="w-4 h-4" />
                      Run
                    </Button>
                  )}
                  <Button size="sm" onClick={() => addToast('Settings (coming soon)', 'info')}>
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              }
            />
            <CardContent>
              {/* Pipeline Visualization */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <Clock className="w-4 h-4" />
                  {selectedPipeline.schedule ? (
                    <span>Scheduled: {selectedPipeline.schedule} (cron)</span>
                  ) : (
                    <span>Manual trigger</span>
                  )}
                </div>

                {/* Steps Flow */}
                <div className="relative">
                  {selectedPipeline.steps.map((step, index) => {
                    const Icon = STEP_ICONS[step.type]
                    const isLast = index === selectedPipeline.steps.length - 1

                    return (
                      <div key={step.id} className="flex items-start gap-4">
                        {/* Connector line */}
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-full flex items-center justify-center',
                              STEP_COLORS[step.status]
                            )}
                          >
                            {step.status === 'running' ? (
                              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : step.status === 'failed' ? (
                              <AlertCircle className="w-5 h-5" />
                            ) : step.status === 'completed' ? (
                              <CheckCircle className="w-5 h-5" />
                            ) : (
                              <Icon className="w-5 h-5" />
                            )}
                          </div>
                          {!isLast && (
                            <div className="w-0.5 h-8 bg-[var(--border-primary)]" />
                          )}
                        </div>

                        {/* Step details */}
                        <div className="flex-1 pb-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-[var(--text-primary)]">{step.name}</h4>
                              <p className="text-xs text-[var(--text-muted)] mt-0.5 capitalize">
                                {step.type}
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge variant={
                                step.status === 'completed' ? 'success' :
                                step.status === 'running' ? 'accent' :
                                step.status === 'failed' ? 'error' : 'default'
                              }>
                                {step.status}
                              </Badge>
                              {step.duration_ms && (
                                <p className="text-xs font-mono text-[var(--text-subtle)] mt-1">
                                  {formatDuration(step.duration_ms)}
                                </p>
                              )}
                            </div>
                          </div>
                          {step.error && (
                            <div className="mt-2 p-2 bg-[var(--error)]/10 border border-[var(--error)]/20 rounded-[var(--radius-sm)]">
                              <p className="text-xs text-[var(--error)]">{step.error}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2 pt-4 border-t border-[var(--border-secondary)]">
                  <Button size="sm" onClick={() => addToast('Viewing logs...', 'info')}>
                    View Logs
                  </Button>
                  <Button size="sm" onClick={() => {
                    setPipelines(prev => prev.map(p => 
                      p.id === selectedPipeline.id 
                        ? { ...p, steps: p.steps.map(s => ({ ...s, status: 'pending' as const, duration_ms: undefined, error: undefined })) }
                        : p
                    ))
                    addToast('Pipeline reset', 'success')
                  }}>
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </Button>
                  <Button size="sm" onClick={() => addToast('Clone pipeline (coming soon)', 'info')}>
                    Clone
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
                <ChevronRight className="w-8 h-8 text-[var(--text-subtle)]" />
              </div>
              <p className="text-[var(--text-muted)]">Select a pipeline to view details</p>
            </CardContent>
          </Card>
        )}
      </div>
    </motion.div>
  )
}

