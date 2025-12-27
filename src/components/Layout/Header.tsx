import { Menu } from 'lucide-react'
import { StatusDot } from '@/components/ui/Badge'
import { UserMenu } from '@/components/ui/UserMenu'
import { formatDate } from '@/lib/utils'
import type { Page } from '@/types'

interface HeaderProps {
  page: Page
  connected: boolean
  timestamp: string | null
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onNavigate: (page: Page) => void
}

const pageTitles: Record<Page, { title: string; subtitle: string }> = {
  dashboard: { title: 'Overview', subtitle: 'Platform health & metrics' },
  workbench: { title: 'Workbench', subtitle: 'Local training & model management' },
  training: { title: 'Training', subtitle: 'Model training pipeline' },
  models: { title: 'Models', subtitle: 'Model registry & versioning' },
  upload: { title: 'Upload Model', subtitle: 'Import trained models' },
  inference: { title: 'Inference', subtitle: 'Run predictions' },
  features: { title: 'Features', subtitle: 'Feature store management' },
  experiments: { title: 'Experiments', subtitle: 'A/B testing & experiments' },
  pipelines: { title: 'Pipelines', subtitle: 'ML workflow orchestration' },
  monitoring: { title: 'Monitoring', subtitle: 'Performance & drift detection' },
  datasets: { title: 'Datasets', subtitle: 'Data management' },
  settings: { title: 'Settings', subtitle: 'Platform configuration' },
  compare: { title: 'Model Comparison', subtitle: 'Compare model performance' },
  batch: { title: 'Batch Inference', subtitle: 'Run predictions on CSV files' },
  api: { title: 'API Playground', subtitle: 'Test and explore API endpoints' },
}

export function Header({ page, connected, timestamp, onToggleSidebar, onNavigate }: HeaderProps) {
  const { title, subtitle } = pageTitles[page]

  return (
    <header className="sticky top-0 z-30 glass border-b border-[var(--border-secondary)]">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors lg:hidden"
            title="Toggle sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]">{title}</h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-[var(--bg-secondary)] rounded-full border border-[var(--border-primary)]">
            <StatusDot status={connected ? 'online' : 'offline'} />
            <span className="text-xs text-[var(--text-muted)] hidden sm:inline">
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
          <span className="text-xs font-mono text-[var(--text-subtle)] hidden md:block">
            {formatDate(timestamp ?? undefined)}
          </span>
          <UserMenu onNavigate={onNavigate} />
        </div>
      </div>
    </header>
  )
}
