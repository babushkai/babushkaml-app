import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import type { Toast as ToastType } from '@/hooks/useToast'

interface ToastContainerProps {
  toasts: ToastType[]
  removeToast: (id: number) => void
}

export function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  }

  const colors = {
    success: 'border-l-[var(--success)] text-[var(--success)]',
    error: 'border-l-[var(--error)] text-[var(--error)]',
    warning: 'border-l-[var(--warning)] text-[var(--warning)]',
    info: 'border-l-[var(--info)] text-[var(--info)]',
  }

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type]
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.95 }}
              className="pointer-events-auto bg-[var(--bg-secondary)] border border-[var(--border-primary)] border-l-4 rounded-[var(--radius-md)] shadow-lg min-w-[300px] max-w-[400px] overflow-hidden"
              style={{ borderLeftColor: `var(--${toast.type})` }}
            >
              <div className="flex items-start gap-3 p-4">
                <Icon className={`w-5 h-5 flex-shrink-0 ${colors[toast.type]}`} />
                <p className="flex-1 text-sm text-[var(--text-primary)]">{toast.message}</p>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-[var(--text-subtle)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
