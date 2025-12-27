import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-primary)]',
        success: 'bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20',
        warning: 'bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20',
        error: 'bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/20',
        info: 'bg-[var(--info)]/10 text-[var(--info)] border border-[var(--info)]/20',
        accent: 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

interface StatusDotProps {
  status: 'online' | 'offline' | 'running' | 'idle'
}

export function StatusDot({ status }: StatusDotProps) {
  const colors = {
    online: 'bg-[var(--success)]',
    offline: 'bg-[var(--text-subtle)]',
    running: 'bg-[var(--accent-primary)]',
    idle: 'bg-[var(--text-muted)]',
  }

  return (
    <span className="relative flex h-2 w-2">
      {(status === 'online' || status === 'running') && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
            colors[status]
          )}
        />
      )}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', colors[status])} />
    </span>
  )
}
