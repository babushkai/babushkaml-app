import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Search, Copy, Rocket, Zap, HardDrive, Cloud, RefreshCw } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatDate, formatPercent, cn } from '@/lib/utils'
import type { AppState, Page, Model as BackendModel } from '@/types'
import { isTauri, listAllModels, promoteModel as tauriPromoteModel, type GlobalModel } from '@/lib/tauri'

interface ModelsProps {
  state: AppState
  onNavigate: (page: Page) => void
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

type Tab = 'overview' | 'config' | 'metrics'
type ModelSource = 'local' | 'backend'

// Unified model type that works with both sources
interface UnifiedModel {
  id: string
  version_id?: string
  name: string
  stage: string
  accuracy?: number
  created_at: string
  source: ModelSource
  project_name?: string
  artifact_path?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config?: any
}

export function Models({ state, onNavigate, addToast }: ModelsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [localModels, setLocalModels] = useState<GlobalModel[]>([])
  const [loadingLocal, setLoadingLocal] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<'all' | ModelSource>('all')
  
  // Load local models from Tauri
  useEffect(() => {
    const loadLocalModels = async () => {
      if (!isTauri) return;
      
      setLoadingLocal(true);
      try {
        const models = await listAllModels();
        setLocalModels(models);
      } catch (e) {
        console.error('Failed to load local models:', e);
      } finally {
        setLoadingLocal(false);
      }
    };
    
    loadLocalModels();
  }, []);
  
  const refreshLocalModels = async () => {
    if (!isTauri) return;
    setLoadingLocal(true);
    try {
      const models = await listAllModels();
      setLocalModels(models);
      addToast('Local models refreshed', 'success');
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      addToast(`Failed to refresh: ${errorMessage}`, 'error');
    } finally {
      setLoadingLocal(false);
    }
  };

  // Combine backend and local models
  const models = useMemo(() => {
    const backendModels: UnifiedModel[] = (state.models || []).map((m: BackendModel) => ({
      id: m.id,
      name: m.name,
      stage: m.stage,
      accuracy: m.accuracy,
      created_at: m.created_at,
      source: 'backend' as ModelSource,
      config: m.config,
    }));
    
    const tauriModels: UnifiedModel[] = localModels.map((m) => ({
      id: m.id,
      version_id: m.version_id,
      name: m.name,
      stage: m.stage,
      created_at: m.created_at,
      source: 'local' as ModelSource,
      project_name: m.project_name,
      artifact_path: m.artifact_path,
    }));
    
    const allModels = [...backendModels, ...tauriModels];
    return allModels.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [state.models, localModels])

  const filteredModels = useMemo(() => {
    let filtered = models;
    
    // Filter by source
    if (sourceFilter !== 'all') {
      filtered = filtered.filter((m) => m.source === sourceFilter);
    }
    
    // Filter by search query
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.stage.toLowerCase().includes(q) ||
          (m.project_name?.toLowerCase().includes(q) ?? false)
      );
    }
    
    return filtered;
  }, [models, searchQuery, sourceFilter])

  const selected = useMemo(() => models.find((m) => m.id === selectedId) || null, [models, selectedId])

  const experiment = useMemo(() => {
    if (!selected || selected.source === 'local') return null
    return state.experiments?.find((e) => e.model_id === selected.id) || null
  }, [state.experiments, selected])

  const chartData = useMemo(() => {
    if (!experiment?.metrics) return []
    return experiment.metrics.map((m) => ({
      epoch: m.epoch,
      'Train Loss': m.train_loss,
      'Val Loss': m.val_loss,
      Accuracy: m.accuracy,
    }))
  }, [experiment])

  // Auto-select first model
  useEffect(() => {
    if (!selectedId && models.length > 0) {
      setSelectedId(models[0].id)
    }
  }, [models, selectedId])

  const apiBase = import.meta.env.VITE_API_URL || ''

  const handleDeploy = async () => {
    if (!selected) return
    
    try {
      if (selected.source === 'local' && selected.version_id) {
        // Use Tauri to promote local model
        await tauriPromoteModel(selected.version_id, 'production');
        await refreshLocalModels();
        addToast(`Model "${selected.name}" promoted to production`, 'success')
      } else {
        // Use backend API
        const res = await fetch(`${apiBase}/api/model/${selected.id}/promote`, { method: 'POST' })
        if (res.ok) {
          addToast(`Model "${selected.name}" promoted to production`, 'success')
        } else {
          const data = await res.json()
          addToast(data.error || 'Failed to promote model', 'error')
        }
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to promote model';
      addToast(errorMessage, 'error')
    }
  }

  const handleCopyId = () => {
    if (!selected) return
    navigator.clipboard?.writeText(selected.id)
    addToast('Model ID copied', 'success')
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Model List */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader
            title="Model Registry"
            action={
              <div className="flex items-center gap-3">
                {/* Source Filter */}
                <div className="flex items-center gap-1 p-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)]">
                  <button
                    onClick={() => setSourceFilter('all')}
                    className={cn(
                      'px-2 py-1 text-xs font-medium rounded transition-colors',
                      sourceFilter === 'all'
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSourceFilter('local')}
                    className={cn(
                      'px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1',
                      sourceFilter === 'local'
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    <HardDrive className="w-3 h-3" /> Local
                  </button>
                  <button
                    onClick={() => setSourceFilter('backend')}
                    className={cn(
                      'px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1',
                      sourceFilter === 'backend'
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    <Cloud className="w-3 h-3" /> Backend
                  </button>
                </div>
                
                {/* Refresh local models */}
                {isTauri && (
                  <Button size="sm" variant="ghost" onClick={refreshLocalModels} disabled={loadingLocal}>
                    <RefreshCw className={cn('w-4 h-4', loadingLocal && 'animate-spin')} />
                  </Button>
                )}
                
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-subtle)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search models…"
                    className="pl-9 pr-4 py-2 w-48 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
              </div>
            }
          />
          <CardContent className="p-0">
            {filteredModels.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-secondary)]">
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-5 py-3">
                        Model
                      </th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-5 py-3">
                        Source
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
                    {filteredModels.map((model) => (
                      <tr
                        key={`${model.source}-${model.id}`}
                        onClick={() => setSelectedId(model.id)}
                        className={cn(
                          'border-b border-[var(--border-secondary)] cursor-pointer transition-colors',
                          model.id === selectedId
                            ? 'bg-[var(--accent-primary)]/5'
                            : 'hover:bg-[var(--bg-tertiary)]'
                        )}
                      >
                        <td className="px-5 py-4">
                          <div className="font-medium text-[var(--text-primary)]">{model.name}</div>
                          <div className="text-xs text-[var(--text-subtle)] mt-0.5">
                            {model.project_name && (
                              <span className="text-[var(--accent-primary)]">{model.project_name}</span>
                            )}
                            {model.project_name && ' • '}
                            <span className="font-mono">{model.id.slice(0, 8)}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                            model.source === 'local' 
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-purple-500/10 text-purple-400'
                          )}>
                            {model.source === 'local' ? (
                              <><HardDrive className="w-3 h-3" /> Local</>
                            ) : (
                              <><Cloud className="w-3 h-3" /> Backend</>
                            )}
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
                {searchQuery ? 'No models match your search' : 'No models yet'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Model Details */}
      <div className="lg:col-span-1">
        <Card className="sticky top-24">
          <CardHeader
            title="Model Details"
            action={
              selected ? (
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                    selected.source === 'local' 
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'bg-purple-500/10 text-purple-400'
                  )}>
                    {selected.source === 'local' ? <HardDrive className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
                    {selected.source}
                  </span>
                  <Badge variant={selected.stage === 'production' ? 'success' : 'default'}>
                    {selected.stage}
                  </Badge>
                </div>
              ) : null
            }
          />
          <CardContent>
            {selected ? (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)]">{selected.name}</h3>
                    <p className="text-xs font-mono text-[var(--text-subtle)] mt-0.5">{selected.id.slice(0, 12)}...</p>
                    {selected.project_name && (
                      <p className="text-xs text-[var(--accent-primary)] mt-0.5">Project: {selected.project_name}</p>
                    )}
                  </div>
                  {selected.accuracy !== undefined && (
                    <span className="font-mono text-xl font-semibold text-[var(--accent-primary)]">
                      {formatPercent(selected.accuracy)}
                    </span>
                  )}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-[var(--bg-primary)] rounded-[var(--radius-md)] border border-[var(--border-primary)]">
                  {(['overview', 'config', 'metrics'] as Tab[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={cn(
                        'flex-1 px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] transition-colors capitalize',
                        tab === t
                          ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                {tab === 'overview' && (
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-[var(--border-secondary)]">
                      <span className="text-xs text-[var(--text-muted)]">Created</span>
                      <span className="text-xs font-mono text-[var(--text-secondary)]">
                        {formatDate(selected.created_at)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[var(--border-secondary)]">
                      <span className="text-xs text-[var(--text-muted)]">Source</span>
                      <span className="text-xs font-mono text-[var(--text-secondary)] capitalize">
                        {selected.source}
                      </span>
                    </div>
                    {selected.source === 'backend' && (
                      <>
                        <div className="flex justify-between py-2 border-b border-[var(--border-secondary)]">
                          <span className="text-xs text-[var(--text-muted)]">Experiment</span>
                          <span className="text-xs font-mono text-[var(--text-secondary)]">
                            {experiment?.id || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-xs text-[var(--text-muted)]">Epochs</span>
                          <span className="text-xs font-mono text-[var(--text-secondary)]">
                            {String(experiment?.metrics?.length || selected.config?.epochs || '—')}
                          </span>
                        </div>
                      </>
                    )}
                    {selected.source === 'local' && (
                      <>
                        <div className="flex justify-between py-2 border-b border-[var(--border-secondary)]">
                          <span className="text-xs text-[var(--text-muted)]">Project</span>
                          <span className="text-xs font-mono text-[var(--text-secondary)]">
                            {selected.project_name || '—'}
                          </span>
                        </div>
                        {selected.artifact_path && (
                          <div className="flex justify-between py-2">
                            <span className="text-xs text-[var(--text-muted)]">Artifact</span>
                            <span className="text-xs font-mono text-[var(--text-secondary)] truncate max-w-[150px]" title={selected.artifact_path}>
                              {selected.artifact_path.split('/').pop() || '—'}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={selected.stage === 'production'}
                        onClick={handleDeploy}
                      >
                        <Rocket className="w-3.5 h-3.5" />
                        Deploy
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          onNavigate('inference')
                          addToast(`Selected ${selected.name} for inference`, 'success')
                        }}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Use
                      </Button>
                      <Button size="sm" onClick={handleCopyId}>
                        <Copy className="w-3.5 h-3.5" />
                        Copy ID
                      </Button>
                    </div>
                  </div>
                )}

                {tab === 'config' && (
                  <div className="space-y-2">
                    {(['learning_rate', 'hidden_dims', 'dropout', 'batch_size', 'epochs'] as const).map(
                      (key) => (
                        <div key={key} className="flex justify-between py-2 border-b border-[var(--border-secondary)] last:border-0">
                          <span className="text-xs text-[var(--text-muted)]">{key}</span>
                          <span className="text-xs font-mono text-[var(--text-secondary)]">
                            {Array.isArray(selected.config?.[key])
                              ? (selected.config[key] as number[]).join(', ')
                              : String(selected.config?.[key] ?? '—')}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                )}

                {tab === 'metrics' && (
                  <div>
                    {chartData.length > 0 ? (
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                            <XAxis
                              dataKey="epoch"
                              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                              axisLine={{ stroke: 'var(--border-primary)' }}
                            />
                            <YAxis
                              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                              axisLine={{ stroke: 'var(--border-primary)' }}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'var(--bg-secondary)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 11,
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="Accuracy"
                              stroke="var(--success)"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                        No metrics available
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-[var(--text-muted)]">Select a model</div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
