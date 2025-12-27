import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Play, Square, Settings, Code, Container, RefreshCw } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { DockerImageSelector } from '@/components/training/DockerImageSelector'
import type { AppState } from '@/types'
import { 
  isTauri, 
  getWorkspace, 
  createProject, 
  listProjects,
  startRun,
  onRunLog,
  onRunProgress,
  onRunStatus,
  onRunError,
} from '@/lib/tauri'

interface TrainingProps {
  state: AppState
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

type TrainingMethod = 'local' | 'docker'

interface TrainingConfig {
  method: TrainingMethod
  learning_rate: string
  hidden_dims: string
  dropout: string
  batch_size: string
  epochs: string
  docker_image: string
  docker_tag: string
}

export function Training({ state, addToast }: TrainingProps) {
  const [config, setConfig] = useState<TrainingConfig>({
    method: 'local',
    learning_rate: '0.001',
    hidden_dims: '128, 64, 32',
    dropout: '0.3',
    batch_size: '32',
    epochs: '10',
    docker_image: 'pytorch/pytorch',
    docker_tag: 'latest',
  })
  const [loading, setLoading] = useState(false)
  const [pulledImages, setPulledImages] = useState<Set<string>>(new Set())
  const [pullingImages, setPullingImages] = useState<Set<string>>(new Set())
  const [showDockerSelector, setShowDockerSelector] = useState(false)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [runLogs, setRunLogs] = useState<string[]>([])
  const [runProgress, setRunProgress] = useState<number>(0)

  const training = state.training || { status: 'idle', progress: 0, metrics: [], logs: [] }
  const isRunning = training.status === 'running' || activeRunId !== null

  const chartData = useMemo(() => {
    return training.metrics.map((m) => ({
      epoch: m.epoch,
      'Train Loss': m.train_loss,
      'Val Loss': m.val_loss,
      Accuracy: m.accuracy,
    }))
  }, [training.metrics])

  // Check if workspace is open and get/create project
  useEffect(() => {
    const checkWorkspace = async () => {
      if (!isTauri) {
        addToast('Training requires the desktop app. Use Workbench page for training.', 'warning')
        return
      }
      
      try {
        const ws = await getWorkspace()
        if (ws) {
          setWorkspaceOpen(true)
          // Get or create a default project
          const projects = await listProjects()
          if (projects.length > 0) {
            setProjectId(projects[0].id)
          } else {
            // Create a default project
            const project = await createProject('Training Project', 'Default project for training runs')
            setProjectId(project.id)
          }
        }
      } catch (e: any) {
        console.error('Workspace check failed:', e)
      }
    }
    checkWorkspace()
  }, [addToast])

  // Set up run event listeners
  useEffect(() => {
    if (!isTauri || !activeRunId) return

    let unsubscribers: (() => void)[] = []

    const setupListeners = async () => {
      console.log('[Training] Setting up listeners for run:', activeRunId)
      const unlistenLog = await onRunLog((event) => {
        console.log('[Training] Received log event:', event)
        if (event.run_id === activeRunId) {
          setRunLogs(prev => {
            const newLogs = [...prev, `[${event.level}] ${event.message}`]
            console.log('[Training] Updated logs, count:', newLogs.length)
            return newLogs
          })
        } else {
          console.log('[Training] Log event run_id mismatch:', event.run_id, '!=', activeRunId)
        }
      })
      unsubscribers.push(unlistenLog)

      const unlistenProgress = await onRunProgress((event) => {
        if (event.run_id === activeRunId) {
          const { current, total } = event
          setRunProgress(total > 0 ? Math.round((current / total) * 100) : 0)
        }
      })
      unsubscribers.push(unlistenProgress)

      const unlistenStatus = await onRunStatus((event) => {
        if (event.run_id === activeRunId) {
          if (event.status === 'succeeded' || event.status === 'failed') {
            setActiveRunId(null)
            addToast(`Training ${event.status}`, event.status === 'succeeded' ? 'success' : 'error')
          }
        }
      })
      unsubscribers.push(unlistenStatus)

      const unlistenError = await onRunError((event) => {
        if (event.run_id === activeRunId) {
          setRunLogs(prev => [...prev, `[ERROR] ${event.error}`])
          addToast(`Training error: ${event.error}`, 'error')
        }
      })
      unsubscribers.push(unlistenError)
    }

    setupListeners().catch(err => {
      console.error('[Training] Error setting up listeners:', err)
    })

    return () => {
      console.log('[Training] Cleaning up listeners for run:', activeRunId)
      unsubscribers.forEach(f => f())
    }
  }, [activeRunId, addToast])

  const handleStart = async () => {
    if (!isTauri) {
      addToast('Training requires the desktop app. Please use the Workbench page.', 'error')
      return
    }

    if (!workspaceOpen || !projectId) {
      addToast('Please open a workspace first. Go to Workbench page.', 'error')
      return
    }

    setLoading(true)
    try {
      const trainingConfig: any = {
        template: config.method === 'docker' ? undefined : 'tabular_classifier',
        learning_rate: parseFloat(config.learning_rate),
        hidden_dims: config.hidden_dims.split(',').map((x) => parseInt(x.trim())).filter((n) => !isNaN(n)),
        dropout: parseFloat(config.dropout),
        batch_size: parseInt(config.batch_size),
        epochs: parseInt(config.epochs),
      }

      if (config.method === 'docker') {
        trainingConfig.method = 'docker'
        trainingConfig.docker_image = `${config.docker_image}:${config.docker_tag}`
      }

      const run = await startRun({
        project_id: projectId,
        dataset_id: undefined, // Can be added later
        name: `Training Run ${new Date().toLocaleString()}`,
        config: trainingConfig,
      })

      console.log('[Training] Run started:', run.id, 'Status:', run.status)
      console.log('[Training] Setting activeRunId to:', run.id)
      setActiveRunId(run.id)
      setRunLogs([`[INFO] Training run started: ${run.id}`])
      setRunProgress(0)
      addToast('Training started', 'success')
      
      // Force a re-render to ensure listeners are set up
      setTimeout(() => {
        console.log('[Training] After timeout - activeRunId:', run.id)
      }, 100)
    } catch (e: any) {
      console.error('Failed to start training:', e)
      addToast(`Failed to start training: ${e?.message || 'Unknown error'}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handlePullDockerImage = async (image: string, tag: string) => {
    const imageKey = `${image}:${tag}`
    setPullingImages(prev => new Set(prev).add(imageKey))
    
    try {
      // Check if we're in Tauri environment
      const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
      
      if (isTauri) {
        // Use Tauri command
        const { pullDockerImage } = await import('@/services/DockerService')
        await pullDockerImage(image, tag)
        // Reload all images to get the latest list
        await loadPulledImages()
        addToast(`Successfully pulled ${image}:${tag}`, 'success')
      } else {
        // Fallback for web environment
        const response = await fetch('/api/docker/pull', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, tag }),
        })

        if (!response.ok) {
          throw new Error('Failed to pull Docker image')
        }

        setPulledImages(prev => new Set(prev).add(imageKey))
        addToast(`Successfully pulled ${image}:${tag}`, 'success')
      }
    } catch (error: any) {
      addToast(`Failed to pull Docker image: ${error.message}`, 'error')
    } finally {
      setPullingImages(prev => {
        const next = new Set(prev)
        next.delete(imageKey)
        return next
      })
    }
  }
  
  // Function to load pulled images
  const loadPulledImages = useCallback(async () => {
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
    if (isTauri) {
      try {
        const { listDockerImages } = await import('@/services/DockerService')
        const images = await listDockerImages()
        console.log('Loaded Docker images:', images)
        setPulledImages(new Set(images))
        if (images.length > 0) {
          addToast(`Found ${images.length} Docker image(s)`, 'success')
        }
      } catch (error: any) {
        console.error('Failed to load Docker images:', error)
        addToast(`Failed to load Docker images: ${error?.message || 'Unknown error'}`, 'error')
      }
    } else {
      console.warn('Not in Tauri environment, cannot list Docker images')
      addToast('Docker features require the desktop app (Tauri)', 'warning')
    }
  }, [addToast])
  
  // Load pulled images on mount
  useEffect(() => {
    loadPulledImages()
  }, [loadPulledImages])

  const handleDockerImageSelect = (image: string, tag: string) => {
    setConfig(prev => ({
      ...prev,
      docker_image: image,
      docker_tag: tag,
    }))
    setShowDockerSelector(false)
  }

  const handleStop = async () => {
    try {
      await fetch('/api/train/stop', { method: 'POST' })
      addToast('Training stopped', 'warning')
    } catch {
      addToast('Failed to stop training', 'error')
    }
  }

  const updateConfig = (key: keyof TrainingConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      {/* Configuration */}
      <Card>
        <CardHeader
          title="Configuration"
          action={
            <Badge
              variant={
                training.status === 'running'
                  ? 'accent'
                  : training.status === 'completed'
                  ? 'success'
                  : 'default'
              }
            >
              {training.status}
            </Badge>
          }
        />
        <CardContent className="space-y-4">
          {/* Training Method Selector */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Training Method
            </label>
            <div className="flex gap-2">
              <Button
                variant={config.method === 'local' ? 'primary' : 'secondary'}
                onClick={() => setConfig(prev => ({ ...prev, method: 'local' }))}
                className="flex-1"
              >
                <Code className="w-4 h-4" />
                Local Python
              </Button>
              <Button
                variant={config.method === 'docker' ? 'primary' : 'secondary'}
                onClick={() => setConfig(prev => ({ ...prev, method: 'docker' }))}
                className="flex-1"
              >
                <Container className="w-4 h-4" />
                Docker Container
              </Button>
            </div>
          </div>

          {/* Docker Image Selection */}
          {config.method === 'docker' && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Docker Image
              </label>
              <div className="mb-2 p-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded text-xs text-[var(--text-subtle)]">
                ℹ️ Requires Docker Desktop installed and running. Images are stored in your local Docker installation.
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={`${config.docker_image}:${config.docker_tag}`}
                    readOnly
                    className="flex-1"
                    placeholder="Select Docker image..."
                  />
                  <Button
                    variant="secondary"
                    onClick={() => setShowDockerSelector(!showDockerSelector)}
                  >
                    {showDockerSelector ? 'Hide' : 'Browse Images'}
                  </Button>
                </div>
                
                {/* Show locally pulled images */}
                <div className="mt-2 p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-[var(--text-subtle)] uppercase tracking-wider">
                      Locally Available Images ({pulledImages.size})
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={loadPulledImages}
                      title="Refresh Docker images list"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </div>
                  {pulledImages.size > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {Array.from(pulledImages).map((imageKey) => {
                        const [image, tag] = imageKey.includes(':') 
                          ? imageKey.split(':') 
                          : [imageKey, 'latest'];
                        return (
                          <button
                            key={imageKey}
                            onClick={() => handleDockerImageSelect(image, tag)}
                            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                              config.docker_image === image && config.docker_tag === tag
                                ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                                : 'bg-[var(--bg-primary)] border-[var(--border-primary)] hover:border-[var(--accent-primary)]'
                            }`}
                          >
                            {imageKey}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-[var(--text-subtle)] py-2">
                      No Docker images found. Pull an image from the browser below or use <code className="px-1 py-0.5 bg-[var(--bg-primary)] rounded">docker pull</code> in terminal.
                    </div>
                  )}
                </div>
                
                {showDockerSelector && (
                  <div className="mt-4 max-h-96 overflow-y-auto border border-[var(--border-primary)] rounded-lg p-4 bg-[var(--bg-secondary)]">
                    <DockerImageSelector
                      selectedImage={config.docker_image}
                      selectedTag={config.docker_tag}
                      onSelect={handleDockerImageSelect}
                      onPull={handlePullDockerImage}
                      pulledImages={pulledImages}
                      pullingImages={pullingImages}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          <Input
            label="Learning Rate"
            value={config.learning_rate}
            onChange={(e) => updateConfig('learning_rate', e.target.value)}
            placeholder="0.001"
          />
          <Input
            label="Hidden Dimensions"
            value={config.hidden_dims}
            onChange={(e) => updateConfig('hidden_dims', e.target.value)}
            placeholder="128, 64, 32"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Dropout"
              value={config.dropout}
              onChange={(e) => updateConfig('dropout', e.target.value)}
              placeholder="0.3"
            />
            <Input
              label="Batch Size"
              value={config.batch_size}
              onChange={(e) => updateConfig('batch_size', e.target.value)}
              placeholder="32"
            />
          </div>
          <Input
            label="Epochs"
            value={config.epochs}
            onChange={(e) => updateConfig('epochs', e.target.value)}
            placeholder="10"
          />

          <div className="flex gap-3 pt-2">
            <Button
              variant="primary"
              disabled={isRunning}
              loading={loading}
              onClick={handleStart}
            >
              <Play className="w-4 h-4" />
              Start Training
            </Button>
            <Button disabled={!isRunning} onClick={handleStop}>
              <Square className="w-4 h-4" />
              Stop
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Progress & Charts */}
      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Training Progress"
            action={
              <span className="font-mono text-sm text-[var(--accent-primary)]">
                {activeRunId ? `${runProgress}%` : `${training.progress}%`}
              </span>
            }
          />
          <CardContent>
            <Progress value={activeRunId ? runProgress : training.progress} size="md" showValue={false} />

            {/* Chart */}
            {chartData.length > 0 && (
              <div className="mt-6 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                    <XAxis
                      dataKey="epoch"
                      tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                      axisLine={{ stroke: 'var(--border-primary)' }}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                      axisLine={{ stroke: 'var(--border-primary)' }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 1]}
                      tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                      axisLine={{ stroke: 'var(--border-primary)' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                      }}
                      labelStyle={{ color: 'var(--text-primary)' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: 16 }} />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="Train Loss"
                      stroke="var(--accent-primary)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="Val Loss"
                      stroke="var(--text-muted)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="Accuracy"
                      stroke="var(--success)"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logs */}
        <Card>
          <CardHeader title="Training Logs" action={<Settings className="w-4 h-4 text-[var(--text-subtle)]" />} />
          <CardContent>
            <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)] p-4 h-64 overflow-y-auto font-mono text-xs leading-relaxed">
              {activeRunId && runLogs.length > 0 ? (
                runLogs.slice(-50).map((log, i) => (
                  <div
                    key={i}
                    className={
                      log.toLowerCase().includes('completed') || log.toLowerCase().includes('success')
                        ? 'text-[var(--success)]'
                        : log.toLowerCase().includes('error') || log.toLowerCase().includes('failed')
                        ? 'text-[var(--error)]'
                        : log.toLowerCase().includes('warning')
                        ? 'text-[var(--warning)]'
                        : 'text-[var(--text-muted)]'
                    }
                  >
                    {log}
                  </div>
                ))
              ) : training.logs.length > 0 ? (
                training.logs.slice(-50).map((log, i) => (
                  <div
                    key={i}
                    className={
                      log.toLowerCase().includes('completed') || log.toLowerCase().includes('success')
                        ? 'text-[var(--success)]'
                        : log.toLowerCase().includes('error') || log.toLowerCase().includes('failed')
                        ? 'text-[var(--error)]'
                        : 'text-[var(--text-muted)]'
                    }
                  >
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-[var(--text-subtle)]">
                  {!workspaceOpen ? 'Please open a workspace in the Workbench page first.' : 'No logs yet. Start training to see logs.'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
