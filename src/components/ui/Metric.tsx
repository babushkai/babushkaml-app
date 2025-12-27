import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface MetricProps {
  label: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  loading?: boolean
}

export function Metric({ label, value, subtitle, icon: Icon, loading }: MetricProps) {
  if (loading) {
    return (
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-[var(--radius-lg)] p-5 space-y-3">
        <div className="h-3 w-20 animate-shimmer rounded" />
        <div className="h-8 w-24 animate-shimmer rounded" />
        <div className="h-3 w-16 animate-shimmer rounded" />
      </div>
    )
  }

  return (
    <div className="group bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-[var(--radius-lg)] p-5 transition-all duration-300 hover:border-[var(--border-accent)]/50 hover:bg-[var(--bg-tertiary)]">
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          {label}
        </span>
        {Icon && (
          <Icon className="w-4 h-4 text-[var(--text-subtle)] group-hover:text-[var(--accent-primary)] transition-colors" />
        )}
      </div>
      <div className="mt-2">
        <span className="font-mono text-3xl font-semibold text-[var(--accent-primary)]">
          {value}
        </span>
      </div>
      {subtitle && (
        <p className="mt-1.5 text-xs text-[var(--text-muted)]">{subtitle}</p>
      )}
    </div>
  )
}

interface MetricGridProps {
  children: React.ReactNode
  columns?: 2 | 3 | 4
}

export function MetricGrid({ children, columns = 4 }: MetricGridProps) {
  const colsClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }

  return <div className={cn('grid gap-4', colsClass[columns])}>{children}</div>
}
