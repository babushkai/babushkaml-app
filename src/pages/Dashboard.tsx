import { motion } from 'framer-motion'
import { ExternalLink, Box, FlaskConical, Zap, Clock, ArrowRight } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, StatusDot } from '@/components/ui/Badge'
import { Metric, MetricGrid } from '@/components/ui/Metric'
import { formatDate, formatPercent } from '@/lib/utils'
import type { AppState, Page } from '@/types'

interface DashboardProps {
  state: AppState
  onNavigate: (page: Page) => void
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

const services = [
  { name: 'API', key: 'api', url: 'http://localhost:8000/docs' },
  { name: 'MLflow', key: 'mlflow', url: 'http://localhost:5000' },
  { name: 'Prometheus', key: 'prometheus', url: 'http://localhost:9090' },
  { name: 'Grafana', key: 'grafana', url: 'http://localhost:3000' },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export function Dashboard({ state, onNavigate, addToast }: DashboardProps) {
  const models = state.models || []
  const inProd = models.filter((m) => m.stage === 'production').length
  const inStaging = models.filter((m) => m.stage === 'staging').length
  const predictions = state.predictions_history?.reduce((acc, p) => acc + p.num_predictions, 0) || 0
  const latestLatency = state.predictions_history?.[state.predictions_history.length - 1]?.latency_ms

  const handleGenerateFeatures = async () => {
    try {
      await fetch('/api/features/generate', { method: 'POST' })
      addToast('Features generated successfully', 'success')
    } catch {
      addToast('Failed to generate features', 'error')
    }
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Services Grid */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader title="Services" />
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {services.map((service) => {
                const status = state.services?.[service.key] || 'offline'
                return (
                  <a
                    key={service.key}
                    href={service.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between p-4 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)] hover:border-[var(--border-accent)] hover:bg-[var(--bg-tertiary)] transition-all"
                  >
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{service.name}</p>
                      <p className="text-xs font-mono text-[var(--text-subtle)] mt-0.5">
                        {service.url.replace('http://', '')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={status === 'online' ? 'success' : 'default'}>
                        <StatusDot status={status === 'online' ? 'online' : 'offline'} />
                        {status}
                      </Badge>
                      <ExternalLink className="w-4 h-4 text-[var(--text-subtle)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </a>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Metrics */}
      <motion.div variants={itemVariants}>
        <MetricGrid>
          <Metric
            label="Models"
            value={models.length}
            subtitle={`${inProd} prod · ${inStaging} staging`}
            icon={Box}
          />
          <Metric
            label="Experiments"
            value={state.experiments?.length || 0}
            subtitle="tracked runs"
            icon={FlaskConical}
          />
          <Metric
            label="Predictions"
            value={predictions}
            subtitle="this session"
            icon={Zap}
          />
          <Metric
            label="Latency"
            value={latestLatency ? `${latestLatency.toFixed(1)}ms` : '—'}
            subtitle="latest inference"
            icon={Clock}
          />
        </MetricGrid>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader
            title="Quick Actions"
            action={
              <span className="text-xs text-[var(--text-subtle)]">
                Press <kbd className="font-mono px-1.5 py-0.5 bg-[var(--bg-primary)] rounded border border-[var(--border-primary)]">G</kbd> + key
              </span>
            }
          />
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" onClick={() => onNavigate('training')}>
                Start Training
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button onClick={() => onNavigate('inference')}>Run Inference</Button>
              <Button onClick={() => onNavigate('models')}>View Models</Button>
              <Button onClick={handleGenerateFeatures}>Generate Features</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Models */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader
            title="Recent Models"
            action={
              <Button size="sm" onClick={() => onNavigate('models')}>
                View All
              </Button>
            }
          />
          <CardContent className="p-0">
            {models.length ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-secondary)]">
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-5 py-3">
                        Model
                      </th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-5 py-3">
                        Accuracy
                      </th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-5 py-3">
                        Stage
                      </th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-5 py-3">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {models
                      .slice()
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .slice(0, 5)
                      .map((model) => (
                        <tr
                          key={model.id}
                          onClick={() => onNavigate('models')}
                          className="border-b border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors"
                        >
                          <td className="px-5 py-4">
                            <div className="font-medium text-[var(--text-primary)]">{model.name}</div>
                            <div className="text-xs font-mono text-[var(--text-subtle)] mt-0.5">
                              {model.id}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="font-mono font-semibold text-[var(--accent-primary)]">
                              {formatPercent(model.accuracy)}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <Badge variant={model.stage === 'production' ? 'success' : 'default'}>
                              {model.stage}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 text-sm text-[var(--text-muted)]">
                            {formatDate(model.created_at)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <Box className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No models yet. Start training to create one.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
