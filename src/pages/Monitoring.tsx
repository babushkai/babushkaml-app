import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  Target,
  Bell,
  CheckCircle,
  Play,
  RefreshCw,
} from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { MetricGrid, Metric } from '@/components/ui/Metric'
import { cn } from '@/lib/utils'
import type { AppState, Alert } from '@/types'

interface MonitoringProps {
  state: AppState
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

interface LatencyStats {
  p50: number
  p95: number
  p99: number
  mean: number
  min: number
  max: number
}

interface MonitoringMetrics {
  latency: LatencyStats
  requests: { total: number; recent: number; per_minute: number }
  errors: { total: number; rate_pct: number }
  models_in_production: number
  total_models: number
  active_alerts: number
}

interface DriftFeature {
  name: string
  baseline: number
  current: number
  drift_pct: number
  status: 'ok' | 'warning' | 'critical'
}

function formatTimeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function Monitoring({ state, addToast }: MonitoringProps) {
  const [metrics, setMetrics] = useState<MonitoringMetrics | null>(null)
  const [latencyData, setLatencyData] = useState<Array<{ time: string; value: number }>>([])
  const [requestsData, setRequestsData] = useState<Array<{ time: string; value: number }>>([])
  const [driftData, setDriftData] = useState<DriftFeature[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h')

  const apiBase = import.meta.env.VITE_API_URL || ''

  const fetchMonitoringData = useCallback(async () => {
    try {
      const [metricsRes, latencyRes, requestsRes, driftRes, alertsRes] = await Promise.all([
        fetch(`${apiBase}/api/monitoring/metrics`),
        fetch(`${apiBase}/api/monitoring/latency`),
        fetch(`${apiBase}/api/monitoring/requests`),
        fetch(`${apiBase}/api/monitoring/drift`),
        fetch(`${apiBase}/api/alerts`),
      ])

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json()
        setMetrics(metricsData)
      }

      if (latencyRes.ok) {
        const latencyJson = await latencyRes.json()
        const formatted = (latencyJson.data || []).map((d: { timestamp: string; value: number }) => ({
          time: formatTimestamp(d.timestamp),
          value: d.value,
        }))
        setLatencyData(formatted.slice(-30))  // Last 30 data points
      }

      if (requestsRes.ok) {
        const requestsJson = await requestsRes.json()
        const formatted = (requestsJson.data || []).map((d: { timestamp: string; count: number }) => ({
          time: formatTimestamp(d.timestamp),
          value: d.count,
        }))
        setRequestsData(formatted.slice(-30))  // Last 30 data points
      }

      if (driftRes.ok) {
        const driftJson = await driftRes.json()
        setDriftData(driftJson.features || [])
      }

      if (alertsRes.ok) {
        const alertsJson = await alertsRes.json()
        setAlerts(alertsJson.alerts || [])
      }

      setLoading(false)
    } catch (err) {
      console.error('Failed to fetch monitoring data:', err)
      setLoading(false)
    }
  }, [apiBase])

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchMonitoringData()
    const interval = setInterval(fetchMonitoringData, 5000)  // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [fetchMonitoringData])

  // Sync alerts from WebSocket state
  useEffect(() => {
    if (state.alerts && state.alerts.length > 0) {
      setAlerts(state.alerts)
    }
  }, [state.alerts])

  const unacknowledgedAlerts = useMemo(
    () => alerts.filter(a => !a.acknowledged),
    [alerts]
  )

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const res = await fetch(`${apiBase}/api/alerts/${alertId}/acknowledge`, { method: 'POST' })
      if (res.ok) {
        setAlerts(prev => prev.map(a => 
          a.id === alertId ? { ...a, acknowledged: true } : a
        ))
        addToast('Alert acknowledged', 'success')
      }
    } catch (err) {
      addToast('Failed to acknowledge alert', 'error')
    }
  }

  const acknowledgeAll = async () => {
    for (const alert of unacknowledgedAlerts) {
      await acknowledgeAlert(alert.id)
    }
  }

  const simulateTraffic = async () => {
    setSimulating(true)
    try {
      const res = await fetch(`${apiBase}/api/monitoring/simulate`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        addToast(data.message || 'Traffic simulated successfully', 'success')
        // Refresh data after simulation
        setTimeout(fetchMonitoringData, 1000)
      } else {
        const err = await res.json()
        addToast(err.error || 'Failed to simulate traffic', 'error')
      }
    } catch (err) {
      addToast('Failed to simulate traffic', 'error')
    } finally {
      setSimulating(false)
    }
  }

  const runPrediction = async () => {
    try {
      // Generate random features
      const features = [[
        Math.floor(Math.random() * 60) + 18,  // user_age
        Math.floor(Math.random() * 100),       // user_tenure
        Math.random() * 5000,                  // total_spend
        Math.floor(Math.random() * 365),       // last_purchase_days
      ]]
      
      const res = await fetch(`${apiBase}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features }),
      })
      
      if (res.ok) {
        const data = await res.json()
        addToast(`Prediction: ${data.predictions[0]} (${data.latency_ms}ms) using ${data.model_name}`, 'info')
        fetchMonitoringData()
      } else {
        const err = await res.json()
        addToast(err.error || 'Failed to run prediction', 'error')
      }
    } catch (err) {
      addToast('Failed to run prediction', 'error')
    }
  }

  // Calculate derived metrics
  const avgLatency = metrics?.latency?.mean || 0
  const requestsPerMin = metrics?.requests?.per_minute || 0
  const errorRate = metrics?.errors?.rate_pct || 0
  const productionAccuracy = state.models?.find(m => m.stage === 'production')?.accuracy || 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(['1h', '6h', '24h', '7d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setSelectedTimeRange(range)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-[var(--radius-md)] transition-colors',
                selectedTimeRange === range
                  ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
              )}
            >
              {range}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={runPrediction}>
            <Play className="w-4 h-4" />
            Run Prediction
          </Button>
          <Button size="sm" onClick={simulateTraffic} disabled={simulating}>
            {simulating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            {simulating ? 'Simulating...' : 'Simulate Traffic'}
          </Button>
          <Button size="sm" variant="ghost" onClick={fetchMonitoringData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <MetricGrid columns={4}>
        <Metric
          label="Avg Latency"
          value={loading ? '...' : `${avgLatency.toFixed(1)}ms`}
          subtitle={metrics?.latency?.p99 ? `p99: ${metrics.latency.p99}ms` : 'p99 response time'}
          icon={Clock}
        />
        <Metric
          label="Requests/min"
          value={loading ? '...' : Math.round(requestsPerMin).toString()}
          subtitle={`Total: ${metrics?.requests?.total || 0}`}
          icon={Zap}
        />
        <Metric
          label="Error Rate"
          value={loading ? '...' : `${errorRate.toFixed(1)}%`}
          subtitle={`${metrics?.errors?.total || 0} total errors`}
          icon={AlertTriangle}
        />
        <Metric
          label="Accuracy"
          value={productionAccuracy > 0 ? `${(productionAccuracy * 100).toFixed(1)}%` : 'N/A'}
          subtitle="Production model"
          icon={Target}
        />
      </MetricGrid>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latency Chart */}
        <Card>
          <CardHeader
            title="Response Latency"
            action={
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[var(--text-muted)]">p50</span>
                <span className="font-mono text-[var(--accent-primary)]">
                  {metrics?.latency?.p50 || 0}ms
                </span>
                <span className="text-[var(--text-muted)]">p99</span>
                <span className="font-mono text-[var(--warning)]">
                  {metrics?.latency?.p99 || 0}ms
                </span>
              </div>
            }
          />
          <CardContent>
            <div className="h-64">
              {latencyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={latencyData}>
                    <defs>
                      <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                      axisLine={{ stroke: 'var(--border-primary)' }}
                    />
                    <YAxis
                      tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                      axisLine={{ stroke: 'var(--border-primary)' }}
                      unit="ms"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                      }}
                      formatter={(value) => value != null ? [`${Number(value).toFixed(1)}ms`, 'Latency'] : ['-', 'Latency']}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--accent-primary)"
                      fill="url(#latencyGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[var(--text-muted)]">
                  <div className="text-center">
                    <Activity className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>No latency data yet</p>
                    <p className="text-sm mt-1">Run predictions or simulate traffic</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Requests Chart */}
        <Card>
          <CardHeader
            title="Request Volume"
            action={
              <Badge variant="success">
                <TrendingUp className="w-3 h-3" />
                {metrics?.requests?.total || 0} total
              </Badge>
            }
          />
          <CardContent>
            <div className="h-64">
              {requestsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={requestsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                    <XAxis
                      dataKey="time"
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
                      }}
                      formatter={(value) => value != null ? [Math.round(Number(value)), 'Requests'] : [0, 'Requests']}
                    />
                    <Bar dataKey="value" fill="var(--accent-secondary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[var(--text-muted)]">
                  <div className="text-center">
                    <Zap className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>No request data yet</p>
                    <p className="text-sm mt-1">Run predictions or simulate traffic</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drift Detection */}
      <Card>
        <CardHeader
          title="Data Drift Detection"
          action={
            <Button size="sm" onClick={fetchMonitoringData}>
              <Activity className="w-4 h-4" />
              Refresh
            </Button>
          }
        />
        <CardContent>
          {driftData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-secondary)]">
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-4 py-3">
                      Feature
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-4 py-3">
                      Baseline
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-4 py-3">
                      Current
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-4 py-3">
                      Drift %
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] px-4 py-3">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {driftData.map((row) => (
                    <tr
                      key={row.name}
                      className="border-b border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-[var(--text-primary)]">
                          {row.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-[var(--text-muted)]">
                        {typeof row.baseline === 'number' ? row.baseline.toFixed(1) : row.baseline}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-[var(--text-muted)]">
                        {typeof row.current === 'number' ? row.current.toFixed(1) : row.current}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {row.current > row.baseline ? (
                            <TrendingUp className="w-4 h-4 text-[var(--success)]" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-[var(--error)]" />
                          )}
                          <span className={cn(
                            'font-mono text-sm',
                            row.status === 'critical' ? 'text-[var(--error)]' :
                            row.status === 'warning' ? 'text-[var(--warning)]' :
                            'text-[var(--text-muted)]'
                          )}>
                            {row.drift_pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            row.status === 'critical' ? 'error' :
                            row.status === 'warning' ? 'warning' : 'success'
                          }
                        >
                          {row.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-[var(--text-muted)]">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No drift data yet</p>
              <p className="text-sm mt-1">Run predictions with features to track drift</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader
          title="Alerts"
          action={
            <div className="flex items-center gap-2">
              {unacknowledgedAlerts.length > 0 && (
                <Badge variant="error">
                  {unacknowledgedAlerts.length} new
                </Badge>
              )}
              <Button size="sm" onClick={acknowledgeAll} disabled={unacknowledgedAlerts.length === 0}>
                <CheckCircle className="w-4 h-4" />
                Acknowledge All
              </Button>
            </div>
          }
        />
        <CardContent className="p-0">
          {alerts.length > 0 ? (
            <div className="divide-y divide-[var(--border-secondary)]">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    'flex items-start gap-4 px-5 py-4 transition-colors',
                    !alert.acknowledged && 'bg-[var(--bg-tertiary)]/50'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    alert.severity === 'critical' ? 'bg-[var(--error)]/10 text-[var(--error)]' :
                    alert.severity === 'warning' ? 'bg-[var(--warning)]/10 text-[var(--warning)]' :
                    'bg-[var(--info)]/10 text-[var(--info)]'
                  )}>
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        alert.severity === 'critical' ? 'error' :
                        alert.severity === 'warning' ? 'warning' : 'info'
                      }>
                        {alert.severity}
                      </Badge>
                      <Badge variant="default">{alert.type}</Badge>
                      <span className="text-xs text-[var(--text-subtle)]">
                        {formatTimeAgo(alert.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--text-primary)]">{alert.message}</p>
                  </div>
                  {!alert.acknowledged ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => acknowledgeAlert(alert.id)}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                  ) : (
                    <span className="text-xs text-[var(--text-subtle)]">Acknowledged</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-[var(--text-muted)]">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No alerts</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
