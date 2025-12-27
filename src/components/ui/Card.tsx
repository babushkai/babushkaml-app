import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-[var(--radius-lg)] overflow-hidden transition-all duration-300 hover:border-[var(--border-accent)]/50 hover:shadow-lg',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  action?: React.ReactNode
  children?: React.ReactNode
}

export function CardHeader({ title, action, className, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-5 py-4 border-b border-[var(--border-secondary)] bg-[var(--bg-primary)]/50',
        className
      )}
      {...props}
    >
      {children ? (
        children
      ) : (
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {title}
        </h3>
      )}
      {action && <div>{action}</div>}
    </div>
  )
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div className={cn('p-5', className)} {...props}>
      {children}
    </div>
  )
}
