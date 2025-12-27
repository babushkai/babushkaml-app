import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts'
import {
  GitCompare,
  Plus,
  X,
  Trophy,
  TrendingUp,
  Clock,
  Zap,
  Check,
} from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Input'
import { cn, formatPercent } from '@/lib/utils'
import type { AppState, Model } from '@/types'

interface CompareProps {
  state: AppState
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

export function Compare({ state, addToast }: CompareProps) {
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [addingModel, setAddingModel] = useState(false)

  const models = state.models || []
  const experiments = state.experiments || []

  const selectedModelData = useMemo(() => {
    return selectedModels
      .map(id => models.find(m => m.id === id))
      .filter((m): m is Model => m !== undefined)
  }, [selectedModels, models])

  const addModel = (modelId: string) => {
    if (selectedModels.length >= 4) {
      addToast('Maximum 4 models can be compared', 'warning')
      return
    }
    if (!selectedModels.includes(modelId)) {
      setSelectedModels([...selectedModels, modelId])
    }
    setAddingModel(false)
  }

  const removeModel = (modelId: string) => {
    setSelectedModels(selectedModels.filter(id => id !== modelId))
  }

  // Prepare comparison data
  const comparisonMetrics = useMemo(() => {
    return selectedModelData.map(model => {
      const exp = experiments.find(e => e.model_id === model.id)
      const lastMetric = exp?.metrics?.[exp.metrics.length - 1]
      
      return {
        name: model.name,
        accuracy: (model.accuracy || 0) * 100,
        trainLoss: lastMetric?.train_loss || 0,
        valLoss: lastMetric?.val_loss || 0,
        epochs: exp?.metrics?.length || model.config?.epochs || 0,
        stage: model.stage,
      }
    })
  }, [selectedModelData, experiments])

  // Radar chart data
  const radarData = useMemo(() => {
    if (selectedModelData.length === 0) return []
    
    const metrics = ['Accuracy', 'Speed', 'Stability', 'Generalization', 'Efficiency']
    return metrics.map(metric => {
      const result: Record<string, string | number> = { metric }
      selectedModelData.forEach(model => {
        // Simulated scores based on model properties
        const baseScore = (model.accuracy || 0.5) * 100
        const variance = Math.random() * 20 - 10
        result[model.name] = Math.min(100, Math.max(0, baseScore + variance))
      })
      return result
    })
  }, [selectedModelData])

  const colors = ['#00d4ff', '#7c3aed', '#10b981', '#f59e0b']

  const bestModel = useMemo(() => {
    if (selectedModelData.length === 0) return null
    return selectedModelData.reduce((best, current) => 
      (current.accuracy || 0) > (best.accuracy || 0) ? current : best
    )
  }, [selectedModelData])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Model Selection */}
      <Card>
        <CardHeader
          title="Select Models to Compare"
          action={
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-muted)]">
                {selectedModels.length}/4 models selected
              </span>
              {!addingModel && selectedModels.length < 4 && models.length > selectedModels.length && (
                <Button size="sm" onClick={() => setAddingModel(true)}>
                  <Plus className="w-4 h-4" />
                  Add Model
                </Button>
              )}
            </div>
          }
        />
        <CardContent>
          {addingModel && (
            <div className="mb-4 p-4 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)]">
              <Select
                label="Select a model"
                onChange={(e) => {
                  if (e.target.value) addModel(e.target.value)
                }}
                defaultValue=""
              >
                <option value="">Choose a model...</option>
                {models
                  .filter(m => !selectedModels.includes(m.id))
                  .map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} - {formatPercent(m.accuracy)} accuracy
                    </option>
                  ))}
              </Select>
              <Button size="sm" variant="ghost" onClick={() => setAddingModel(false)} className="mt-2">
                Cancel
              </Button>
            </div>
          )}

          {selectedModelData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {selectedModelData.map((model, index) => (
                <div
                  key={model.id}
                  className="relative p-4 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)]"
                  style={{ borderLeftColor: colors[index], borderLeftWidth: 3 }}
                >
                  <button
                    onClick={() => removeModel(model.id)}
                    className="absolute top-2 right-2 p-1 text-[var(--text-subtle)] hover:text-[var(--error)] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  
                  <div className="flex items-start gap-3">
                    <div
                      className="w-3 h-3 rounded-full mt-1.5"
                      style={{ backgroundColor: colors[index] }}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-[var(--text-primary)] truncate">
                        {model.name}
                      </h4>
                      <p className="text-xs font-mono text-[var(--text-subtle)] truncate">
                        {model.id}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="font-mono text-lg font-semibold" style={{ color: colors[index] }}>
                          {formatPercent(model.accuracy)}
                        </span>
                        <Badge variant={model.stage === 'production' ? 'success' : 'default'}>
                          {model.stage}
                        </Badge>
                      </div>
                      {bestModel?.id === model.id && (
                        <div className="flex items-center gap-1 mt-2 text-[var(--warning)]">
                          <Trophy className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">Best</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-[var(--text-muted)]">
              <GitCompare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No models selected</p>
              <p className="text-sm mt-1">Add models to compare their performance</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedModelData.length >= 2 && (
        <>
          {/* Metrics Comparison Bar Chart */}
          <Card>
            <CardHeader title="Accuracy Comparison" />
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonMetrics} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                      axisLine={{ stroke: 'var(--border-primary)' }}
                      unit="%"
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                      axisLine={{ stroke: 'var(--border-primary)' }}
                      width={120}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                      }}
                      formatter={(value) => value != null ? [`${Number(value).toFixed(1)}%`, 'Accuracy'] : ['-', 'Accuracy']}
                    />
                    <Bar
                      dataKey="accuracy"
                      fill="var(--accent-primary)"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Radar Chart */}
          <Card>
            <CardHeader title="Multi-Metric Analysis" />
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--border-primary)" />
                    <PolarAngleAxis
                      dataKey="metric"
                      tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={{ fill: 'var(--text-subtle)', fontSize: 10 }}
                    />
                    {selectedModelData.map((model, index) => (
                      <Radar
                        key={model.id}
                        name={model.name}
                        dataKey={model.name}
                        stroke={colors[index]}
                        fill={colors[index]}
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                    ))}
                    <Legend />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Comparison Table */}
          <Card>
            <CardHeader title="Detailed Comparison" />
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-secondary)]">
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-5 py-3">
                        Metric
                      </th>
                      {selectedModelData.map((model, index) => (
                        <th
                          key={model.id}
                          className="text-left text-[10px] font-semibold uppercase tracking-wider px-5 py-3"
                          style={{ color: colors[index] }}
                        >
                          {model.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Accuracy', key: 'accuracy', format: (v: number) => `${v.toFixed(1)}%`, icon: TrendingUp },
                      { label: 'Train Loss', key: 'trainLoss', format: (v: number) => v.toFixed(4), icon: Zap },
                      { label: 'Val Loss', key: 'valLoss', format: (v: number) => v.toFixed(4), icon: Zap },
                      { label: 'Epochs', key: 'epochs', format: (v: number) => v.toString(), icon: Clock },
                      { label: 'Stage', key: 'stage', format: (v: string) => v, icon: Check },
                    ].map(({ label, key, format, icon: Icon }) => {
                      const values = comparisonMetrics.map(m => m[key as keyof typeof m])
                      const numericValues = values.filter((v): v is number => typeof v === 'number')
                      const bestValue = key === 'trainLoss' || key === 'valLoss'
                        ? Math.min(...numericValues)
                        : Math.max(...numericValues)

                      return (
                        <tr key={key} className="border-b border-[var(--border-secondary)]">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-[var(--text-subtle)]" />
                              <span className="text-sm text-[var(--text-primary)]">{label}</span>
                            </div>
                          </td>
                          {comparisonMetrics.map((metrics, index) => {
                            const value = metrics[key as keyof typeof metrics]
                            const isBest = typeof value === 'number' && value === bestValue && numericValues.length > 1

                            return (
                              <td key={index} className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    'font-mono text-sm',
                                    isBest ? 'text-[var(--success)] font-semibold' : 'text-[var(--text-secondary)]'
                                  )}>
                                    {format(value as never)}
                                  </span>
                                  {isBest && <Trophy className="w-3.5 h-3.5 text-[var(--warning)]" />}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {selectedModelData.length === 1 && (
        <Card>
          <CardContent className="py-12 text-center text-[var(--text-muted)]">
            <GitCompare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Add at least one more model to compare</p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}

