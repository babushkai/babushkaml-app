import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Cpu,
  Cloud,
  Smartphone,
  Wifi,
  WifiOff,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Settings,
} from 'lucide-react'
import { ComputeService, ComputeMode } from '@/services/ComputeService'
import { SyncService, SyncStatus } from '@/services/SyncService'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { Model } from '@/types'

interface ComputeSettingsProps {
  models: Model[]
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

export function ComputeSettings({ models, addToast }: ComputeSettingsProps) {
  const [computeStatus, setComputeStatus] = useState(ComputeService.getStatus())
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(SyncService.getStatus())
  const [downloadingModels, setDownloadingModels] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Listen for sync status changes
    const unsubscribe = SyncService.addListener(setSyncStatus)
    return unsubscribe
  }, [])

  const handleModeChange = (mode: ComputeMode) => {
    ComputeService.configure({ mode })
    setComputeStatus(ComputeService.getStatus())
    addToast(`Compute mode set to ${mode}`, 'success')
  }

  const handleDownloadModel = async (model: Model) => {
    setDownloadingModels(prev => new Set(prev).add(model.id))
    try {
      const success = await ComputeService.downloadModel(model.id, model.name)
      if (success) {
        addToast(`Downloaded ${model.name} for local inference`, 'success')
      } else {
        addToast(`Failed to download ${model.name}`, 'error')
      }
    } finally {
      setDownloadingModels(prev => {
        const next = new Set(prev)
        next.delete(model.id)
        return next
      })
      setComputeStatus(ComputeService.getStatus())
    }
  }

  const handleRemoveModel = async (model: Model) => {
    await ComputeService.removeLocalModel(model.id)
    setComputeStatus(ComputeService.getStatus())
    addToast(`Removed ${model.name} from local storage`, 'info')
  }

  const handleSyncNow = async () => {
    const result = await SyncService.syncAll()
    if (result.success > 0) {
      addToast(`Synced ${result.success} items`, 'success')
    }
    if (result.failed > 0) {
      addToast(`Failed to sync ${result.failed} items`, 'error')
    }
  }

  const modes: { id: ComputeMode; label: string; icon: React.FC<{ className?: string }>; description: string }[] = [
    { id: 'auto', label: 'Auto', icon: Settings, description: 'Automatically choose based on connectivity' },
    { id: 'local', label: 'Local Only', icon: Smartphone, description: 'Run inference on device (offline mode)' },
    { id: 'cloud', label: 'Cloud Only', icon: Cloud, description: 'Always use cloud compute' },
  ]

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10">
              <Cpu className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
            <div>
              <h3 className="font-medium text-[var(--text-primary)]">Compute Status</h3>
              <p className="text-xs text-[var(--text-muted)]">Local and cloud compute settings</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                {syncStatus.isOnline ? (
                  <Wifi className="w-4 h-4 text-[var(--success)]" />
                ) : (
                  <WifiOff className="w-4 h-4 text-[var(--error)]" />
                )}
                <span className="text-xs text-[var(--text-muted)]">Connection</span>
              </div>
              <p className="font-medium text-[var(--text-primary)]">
                {syncStatus.isOnline ? 'Online' : 'Offline'}
              </p>
            </div>

            <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Smartphone className="w-4 h-4 text-[var(--accent-primary)]" />
                <span className="text-xs text-[var(--text-muted)]">Platform</span>
              </div>
              <p className="font-medium text-[var(--text-primary)]">
                {computeStatus.isNative ? 'Native App' : 'Web'}
              </p>
            </div>

            <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Download className="w-4 h-4 text-[var(--warning)]" />
                <span className="text-xs text-[var(--text-muted)]">Local Models</span>
              </div>
              <p className="font-medium text-[var(--text-primary)]">
                {computeStatus.localModelsCount}
              </p>
            </div>

            <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className="w-4 h-4 text-[var(--info)]" />
                <span className="text-xs text-[var(--text-muted)]">Pending Sync</span>
              </div>
              <p className="font-medium text-[var(--text-primary)]">
                {syncStatus.pendingCount}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compute Mode */}
      <Card>
        <CardHeader>
          <h3 className="font-medium text-[var(--text-primary)]">Compute Mode</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {modes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => handleModeChange(mode.id)}
                className={cn(
                  'p-4 rounded-xl border-2 text-left transition-all',
                  computeStatus.mode === mode.id
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                    : 'border-[var(--border-primary)] hover:border-[var(--border-accent)]'
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <mode.icon className={cn(
                    'w-5 h-5',
                    computeStatus.mode === mode.id
                      ? 'text-[var(--accent-primary)]'
                      : 'text-[var(--text-muted)]'
                  )} />
                  <span className="font-medium text-[var(--text-primary)]">{mode.label}</span>
                  {computeStatus.mode === mode.id && (
                    <CheckCircle className="w-4 h-4 text-[var(--accent-primary)] ml-auto" />
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)]">{mode.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Local Models */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-[var(--text-primary)]">Local Models</h3>
            <Badge variant={computeStatus.isNative ? 'success' : 'warning'}>
              {computeStatus.isNative ? 'Native Support' : 'Web Only'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!computeStatus.isNative && (
            <div className="mb-4 p-3 bg-[var(--warning)]/10 border border-[var(--warning)]/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[var(--warning)] mt-0.5" />
                <div>
                  <p className="text-sm text-[var(--warning)]">
                    Local model inference requires the native iOS app
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Download models will be available when running in the iOS app
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {models.map((model) => {
              const isLocal = ComputeService.hasLocalModel(model.id)
              const isDownloading = downloadingModels.has(model.id)

              return (
                <motion.div
                  key={model.id}
                  layout
                  className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      isLocal ? 'bg-[var(--success)]/10' : 'bg-[var(--bg-secondary)]'
                    )}>
                      {isLocal ? (
                        <Smartphone className="w-4 h-4 text-[var(--success)]" />
                      ) : (
                        <Cloud className="w-4 h-4 text-[var(--text-muted)]" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{model.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {model.format || 'Unknown'} • {model.size_mb?.toFixed(1) || '?'} MB
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isLocal ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveModel(model)}
                        className="text-[var(--error)] hover:bg-[var(--error)]/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDownloadModel(model)}
                        disabled={!computeStatus.isNative || isDownloading}
                      >
                        {isDownloading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </motion.div>
              )
            })}

            {models.length === 0 && (
              <p className="text-sm text-[var(--text-muted)] text-center py-8">
                No models available. Upload a model first.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sync Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-[var(--text-primary)]">Data Sync</h3>
            <Button
              size="sm"
              onClick={handleSyncNow}
              disabled={!syncStatus.isOnline || syncStatus.isSyncing}
            >
              {syncStatus.isSyncing ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync Now
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-[var(--text-secondary)]">Last sync</span>
              <span className="text-sm text-[var(--text-muted)]">
                {syncStatus.lastSyncAt
                  ? new Date(syncStatus.lastSyncAt).toLocaleString()
                  : 'Never'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-[var(--text-secondary)]">Pending changes</span>
              <Badge variant={syncStatus.pendingCount > 0 ? 'warning' : 'success'}>
                {syncStatus.pendingCount}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-[var(--text-secondary)]">Auto-sync when online</span>
              <Badge variant="success">Enabled</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}





