import { useState } from 'react'
import { motion } from 'framer-motion'
import { FlaskConical, Plus, TrendingUp, Users } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import type { AppState } from '@/types'

interface ExperimentsProps {
  state: AppState
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

export function Experiments({ state, addToast }: ExperimentsProps) {
  const [loading, setLoading] = useState(false)

  const abTests = state.ab_tests || []

  const handleCreate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ab-test/create', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        addToast(data.error, 'warning')
      } else {
        addToast('A/B test created', 'success')
      }
    } catch {
      addToast('Failed to create A/B test', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card>
        <CardHeader
          title="A/B Testing"
          action={
            <Button variant="primary" loading={loading} onClick={handleCreate}>
              <Plus className="w-4 h-4" />
              Create Test
            </Button>
          }
        />
        <CardContent>
          {abTests.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {abTests
                .slice()
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 6)
                .map((test) => {
                  const a = test.results?.a || { requests: 0, conversions: 0 }
                  const b = test.results?.b || { requests: 0, conversions: 0 }
                  const convA = a.requests ? ((a.conversions / a.requests) * 100).toFixed(1) : '0'
                  const convB = b.requests ? ((b.conversions / b.requests) * 100).toFixed(1) : '0'

                  return (
                    <Card key={test.id} className="bg-[var(--bg-primary)]">
                      <CardContent>
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-semibold text-[var(--text-primary)]">{test.name}</h3>
                            <p className="text-xs font-mono text-[var(--text-subtle)] mt-0.5">
                              {test.id}
                            </p>
                          </div>
                          <Badge variant={test.status === 'running' ? 'accent' : 'default'}>
                            {test.status}
                          </Badge>
                        </div>

                        <p className="text-xs text-[var(--text-muted)] mb-4">
                          Created {formatDate(test.created_at)}
                        </p>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-[var(--radius-md)]">
                            <div className="flex items-center gap-2 mb-2">
                              <Users className="w-4 h-4 text-[var(--accent-primary)]" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
                                Variant A
                              </span>
                            </div>
                            <p className="font-mono text-2xl font-bold text-[var(--accent-primary)]">
                              {a.requests}
                            </p>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                              <TrendingUp className="w-3 h-3 inline mr-1" />
                              {convA}% conversion
                            </p>
                          </div>

                          <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-[var(--radius-md)]">
                            <div className="flex items-center gap-2 mb-2">
                              <Users className="w-4 h-4 text-[var(--accent-secondary)]" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
                                Variant B
                              </span>
                            </div>
                            <p className="font-mono text-2xl font-bold text-[var(--accent-secondary)]">
                              {b.requests}
                            </p>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                              <TrendingUp className="w-3 h-3 inline mr-1" />
                              {convB}% conversion
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]">
              <FlaskConical className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg mb-2">No A/B tests yet</p>
              <p className="text-sm mb-6 text-center max-w-md">
                Train at least 2 models to create an A/B test and compare their performance
              </p>
              <Button variant="primary" loading={loading} onClick={handleCreate}>
                Create A/B Test
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
