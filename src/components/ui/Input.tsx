import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, id, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-xs font-medium text-[var(--text-muted)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full px-3 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] font-mono placeholder:text-[var(--text-subtle)] transition-all duration-200',
            'focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20',
            'hover:border-[var(--text-subtle)]',
            className
          )}
          {...props}
        />
      </div>
    )
  }
)

Input.displayName = 'Input'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, id, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-xs font-medium text-[var(--text-muted)]"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          className={cn(
            'w-full px-3 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] font-mono placeholder:text-[var(--text-subtle)] transition-all duration-200 resize-y min-h-[160px]',
            'focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20',
            'hover:border-[var(--text-subtle)]',
            className
          )}
          {...props}
        />
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, id, children, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-xs font-medium text-[var(--text-muted)]"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={cn(
            'w-full px-3 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] transition-all duration-200 cursor-pointer',
            'focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20',
            'hover:border-[var(--text-subtle)]',
            className
          )}
          {...props}
        >
          {children}
        </select>
      </div>
    )
  }
)

Select.displayName = 'Select'
