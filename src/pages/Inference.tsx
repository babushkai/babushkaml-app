import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Zap, Clock, CheckCircle, HardDrive, Cloud } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Textarea, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { formatDate, formatPercent, cn } from '@/lib/utils'
import type { AppState, PredictionResult, Page, Model as BackendModel } from '@/types'
import { isTauri, listAllModels, localPredict, type GlobalModel } from '@/lib/tauri'

interface InferenceProps {
  state: AppState
  onNavigate: (page: Page) => void
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

type ModelSource = 'local' | 'backend'

interface UnifiedModel {
  id: string
  version_id?: string
  name: string
  stage: string
  source: ModelSource
}

export function Inference({ state, onNavigate, addToast }: InferenceProps) {
  const [input, setInput] = useState(
    '{"features": [[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]]}'
  )
  const [result, setResult] = useState<PredictionResult | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [localModels, setLocalModels] = useState<GlobalModel[]>([])

  // Load local models
  useEffect(() => {
    const loadLocalModels = async () => {
      if (!isTauri) return;
      try {
        const models = await listAllModels();
        setLocalModels(models);
      } catch (e) {
        console.error('Failed to load local models:', e);
      }
    };
    loadLocalModels();
  }, []);

  // Combine all models
  const models: UnifiedModel[] = useMemo(() => {
    const backendModels: UnifiedModel[] = (state.models || []).map((m: BackendModel) => ({
      id: m.id,
      name: m.name,
      stage: m.stage,
      source: 'backend' as ModelSource,
    }));
    
    const tauriModels: UnifiedModel[] = localModels.map((m) => ({
      id: m.id,
      version_id: m.version_id,
      name: `${m.name} (${m.project_name})`,
      stage: m.stage,
      source: 'local' as ModelSource,
    }));
    
    return [...tauriModels, ...backendModels];
  }, [state.models, localModels]);

  const predictionsHistory = state.predictions_history || []

  // Auto-select production or latest model
  useEffect(() => {
    if (!selectedModelId && models.length > 0) {
      const prodModel = models.find((m) => m.stage === 'production')
      setSelectedModelId(prodModel?.id || models[0].id)
    }
  }, [models, selectedModelId])

  const selectedModel = useMemo(
    () => models.find((m) => m.id === selectedModelId),
    [models, selectedModelId]
  )

  const apiBase = import.meta.env.VITE_API_URL || ''

  const handlePredict = async () => {
    if (!selectedModelId && models.length === 0) {
      addToast('No models available. Train a model first.', 'warning')
      return
    }

    setLoading(true)
    try {
      let parsed
      try {
        parsed = JSON.parse(input)
      } catch {
        addToast('Invalid JSON format', 'error')
        setLoading(false)
        return
      }

      // Check if using local or backend model
      if (selectedModel?.source === 'local' && selectedModel.version_id) {
        // Use Tauri for local inference
        const response = await localPredict({
          model_version_id: selectedModel.version_id,
          features: parsed.features,
        });
        
        setResult({
          predictions: response.predictions,
          probabilities: response.probabilities || [],
          model_name: response.model_name,
          model_id: selectedModel.id,
          latency_ms: response.latency_ms,
          model_accuracy: 0,
          model_stage: selectedModel.stage,
          timestamp: new Date().toISOString(),
        });
        addToast(`Local prediction completed using ${response.model_name}`, 'success');
      } else {
        // Use backend API
        parsed.model_id = selectedModelId

        const resp = await fetch(`${apiBase}/api/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed),
        })

        const data = await resp.json()

        if (data.error) {
          addToast(data.error, 'error')
          setLoading(false)
          return
        }

        setResult(data)
        addToast(`Prediction completed using ${data.model_name}`, 'success')
      }
    } catch (e: any) {
      addToast(e.message || 'Prediction failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Model Selection */}
      <Card>
        <CardHeader title="Model Selection" />
        <CardContent>
          {models.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-[var(--text-muted)] mb-4">No models available</p>
              <Button variant="primary" onClick={() => onNavigate('training')}>
                Train a Model
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Select
                label="Select Model"
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
              >
                {models.map((m) => (
                  <option key={`${m.source}-${m.id}`} value={m.id}>
                    [{m.source === 'local' ? '💻 Local' : '☁️ Backend'}] {m.name} ({m.stage})
                  </option>
                ))}
              </Select>

              {selectedModel && (
                <div className="flex items-center gap-6 p-4 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)]">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-subtle)] mb-1">
                      Selected Model
                    </p>
                    <p className="font-medium text-[var(--text-primary)]">{selectedModel.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                        selectedModel.source === 'local' 
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-purple-500/10 text-purple-400'
                      )}>
                        {selectedModel.source === 'local' ? <HardDrive className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
                        {selectedModel.source}
                      </span>
                      <Badge variant={selectedModel.stage === 'production' ? 'success' : 'default'}>
                        {selectedModel.stage}
                      </Badge>
                    </div>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-subtle)] mb-1">
                      Inference
                    </p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {selectedModel.source === 'local' ? 'Runs locally on your machine' : 'Runs on backend server'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request/Response */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Prediction Request" />
          <CardContent>
            <Textarea
              label="Input Features (JSON)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='{"features": [[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]]}'
              className="min-h-[200px]"
            />
            <div className="flex items-center gap-3 mt-4">
              <Button
                variant="primary"
                loading={loading}
                disabled={!selectedModelId || models.length === 0}
                onClick={handlePredict}
              >
                <Zap className="w-4 h-4" />
                Run Prediction
              </Button>
              {selectedModel && (
                <span className="text-xs text-[var(--text-subtle)]">
                  Using: {selectedModel.name}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Prediction Response"
            action={
              result?.latency_ms && (
                <div className="flex items-center gap-1.5 text-xs font-mono text-[var(--accent-primary)]">
                  <Clock className="w-3.5 h-3.5" />
                  {result.latency_ms.toFixed(2)}ms
                </div>
              )
            }
          />
          <CardContent>
            {result ? (
              <div className="space-y-4">
                {/* Model Info */}
                <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--text-subtle)] mb-0.5">
                        Model Used
                      </p>
                      <p className="font-medium text-sm text-[var(--text-primary)]">
                        {result.model_name}
                      </p>
                      <p className="text-[10px] font-mono text-[var(--text-subtle)]">
                        {result.model_id}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-[var(--text-subtle)] mb-0.5">
                        Accuracy
                      </p>
                      <p className="font-mono font-semibold text-[var(--accent-primary)]">
                        {formatPercent(result.model_accuracy)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Results */}
                <div>
                  <p className="text-xs text-[var(--text-muted)] mb-2">Results</p>
                  <pre className="p-4 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)] text-xs font-mono text-[var(--text-secondary)] overflow-auto max-h-48">
                    {JSON.stringify(
                      { predictions: result.predictions, probabilities: result.probabilities },
                      null,
                      2
                    )}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
                <CheckCircle className="w-12 h-12 mb-3 opacity-30" />
                <p>
                  {models.length === 0
                    ? 'Train a model first, then run predictions.'
                    : 'Run a prediction to see results.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History */}
      {predictionsHistory.length > 0 && (
        <Card>
          <CardHeader title="Prediction History" />
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-secondary)]">
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-5 py-3">
                      Model
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-5 py-3">
                      Predictions
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-5 py-3">
                      Latency
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-5 py-3">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {predictionsHistory
                    .slice()
                    .reverse()
                    .slice(0, 10)
                    .map((p, i) => (
                      <tr key={i} className="border-b border-[var(--border-secondary)] last:border-0">
                        <td className="px-5 py-3">
                          <p className="font-medium text-sm text-[var(--text-primary)]">
                            {p.model_name}
                          </p>
                          <p className="text-[10px] font-mono text-[var(--text-subtle)]">
                            {p.model_id}
                          </p>
                        </td>
                        <td className="px-5 py-3 font-mono text-sm text-[var(--text-secondary)]">
                          {p.num_predictions}
                        </td>
                        <td className="px-5 py-3 font-mono text-sm text-[var(--accent-primary)]">
                          {p.latency_ms.toFixed(2)}ms
                        </td>
                        <td className="px-5 py-3 text-xs text-[var(--text-muted)]">
                          {formatDate(p.timestamp)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}
