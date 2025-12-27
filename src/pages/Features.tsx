import { useState } from 'react'
import { motion } from 'framer-motion'
import { Database, RefreshCw } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { AppState } from '@/types'

interface FeaturesProps {
  state: AppState
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

export function Features({ state, addToast }: FeaturesProps) {
  const [loading, setLoading] = useState(false)

  const features = state.features || {}
  const hasFeatures = 'count' in features && features.count && features.columns?.length

  const handleGenerate = async () => {
    setLoading(true)
    try {
      await fetch('/api/features/generate', { method: 'POST' })
      addToast('Features generated successfully', 'success')
    } catch {
      addToast('Failed to generate features', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card>
        <CardHeader
          title="Feature Store"
          action={
            <Button variant="primary" loading={loading} onClick={handleGenerate}>
              <RefreshCw className="w-4 h-4" />
              Generate Features
            </Button>
          }
        />
        <CardContent>
          {hasFeatures ? (
            <div className="space-y-6">
              {/* Summary */}
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-4xl font-bold text-[var(--accent-primary)]">
                  {features.count?.toLocaleString()}
                </span>
                <span className="text-[var(--text-muted)]">rows</span>
              </div>

              <div className="text-sm text-[var(--text-muted)]">
                Columns:{' '}
                <span className="font-mono text-[var(--text-secondary)]">
                  {features.columns?.join(', ')}
                </span>
              </div>

              {/* Statistics Table */}
              <Card>
                <CardHeader title="Statistics" />
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[var(--border-secondary)]">
                          <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-5 py-3">
                            Feature
                          </th>
                          <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-5 py-3 font-mono">
                            Mean
                          </th>
                          <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-5 py-3 font-mono">
                            Std
                          </th>
                          <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-5 py-3 font-mono">
                            Min
                          </th>
                          <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-5 py-3 font-mono">
                            Max
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {features.stats &&
                          Object.entries(features.stats).map(([name, stats]) => (
                            <tr
                              key={name}
                              className="border-b border-[var(--border-secondary)] last:border-0 hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                              <td className="px-5 py-4 font-medium text-[var(--text-primary)]">
                                {name}
                              </td>
                              <td className="px-5 py-4 text-right font-mono text-sm text-[var(--text-secondary)]">
                                {stats.mean.toFixed(2)}
                              </td>
                              <td className="px-5 py-4 text-right font-mono text-sm text-[var(--text-secondary)]">
                                {stats.std.toFixed(2)}
                              </td>
                              <td className="px-5 py-4 text-right font-mono text-sm text-[var(--text-secondary)]">
                                {stats.min.toFixed(2)}
                              </td>
                              <td className="px-5 py-4 text-right font-mono text-sm text-[var(--text-secondary)]">
                                {stats.max.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]">
              <Database className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg mb-2">No features yet</p>
              <p className="text-sm mb-6">Generate features to populate the feature store</p>
              <Button variant="primary" loading={loading} onClick={handleGenerate}>
                Generate Features
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
