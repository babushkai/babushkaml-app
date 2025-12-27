import { cn } from '@/lib/utils'

interface ProgressProps {
  value: number
  max?: number
  label?: string
  showValue?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function Progress({
  value,
  max = 100,
  label,
  showValue = true,
  size = 'md',
}: ProgressProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100))

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  }

  return (
    <div className="space-y-2">
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="text-[var(--text-muted)]">{label}</span>}
          {showValue && (
            <span className="font-mono text-[var(--accent-primary)]">{percent.toFixed(0)}%</span>
          )}
        </div>
      )}
      <div
        className={cn(
          'w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-full overflow-hidden',
          sizeClasses[size]
        )}
      >
        <div
          className="h-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
