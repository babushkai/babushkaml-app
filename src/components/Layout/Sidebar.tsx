import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Brain,
  Box,
  Zap,
  Database,
  FlaskConical,
  ChevronLeft,
  ChevronRight,
  Upload,
  GitBranch,
  Activity,
  FolderOpen,
  Settings,
  GitCompare,
  FileSpreadsheet,
  Code,
  Cpu,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusDot } from '@/components/ui/Badge'
import { Logo } from '@/components/ui/Logo'
import type { Page } from '@/types'

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
  connected: boolean
  isOpen: boolean
  onToggle: () => void
}

const navSections: {
  title?: string
  items: { id: Page; label: string; icon: React.ElementType; kbd: string }[]
}[] = [
  {
    items: [
      { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, kbd: 'G D' },
      { id: 'workbench', label: 'Workbench', icon: Cpu, kbd: 'G W' },
    ],
  },
  {
    title: 'ML Lifecycle',
    items: [
      { id: 'training', label: 'Training', icon: Brain, kbd: 'G T' },
      { id: 'models', label: 'Models', icon: Box, kbd: 'G M' },
      { id: 'compare', label: 'Compare', icon: GitCompare, kbd: 'G C' },
      { id: 'upload', label: 'Upload', icon: Upload, kbd: 'G U' },
      { id: 'inference', label: 'Inference', icon: Zap, kbd: 'G I' },
      { id: 'batch', label: 'Batch Inference', icon: FileSpreadsheet, kbd: 'G B' },
    ],
  },
  {
    title: 'Data & Features',
    items: [
      { id: 'datasets', label: 'Datasets', icon: FolderOpen, kbd: 'G A' },
      { id: 'features', label: 'Features', icon: Database, kbd: 'G F' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { id: 'pipelines', label: 'Pipelines', icon: GitBranch, kbd: 'G P' },
      { id: 'experiments', label: 'Experiments', icon: FlaskConical, kbd: 'G E' },
      { id: 'monitoring', label: 'Monitoring', icon: Activity, kbd: 'G O' },
      { id: 'api', label: 'API Playground', icon: Code, kbd: 'G Y' },
    ],
  },
  {
    items: [
      { id: 'settings', label: 'Settings', icon: Settings, kbd: 'G S' },
    ],
  },
]

export function Sidebar({ currentPage, onNavigate, connected, isOpen, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        'fixed top-0 left-0 bottom-0 bg-[var(--bg-secondary)] border-r border-[var(--border-secondary)] flex flex-col z-40 transition-all duration-300 ease-in-out',
        isOpen ? 'w-60' : 'w-16'
      )}
    >
      {/* Brand */}
      <div className="p-3">
        <div
          className={cn(
            'flex items-center gap-3 px-2 py-2 rounded-[var(--radius-md)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer',
            !isOpen && 'justify-center px-0'
          )}
        >
          <Logo size="lg" variant="icon" className="flex-shrink-0" />
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="text-sm font-semibold text-[var(--text-primary)] whitespace-nowrap">BabushkaML</h1>
              <p className="text-[10px] text-[var(--text-subtle)] whitespace-nowrap">ML Made Simple</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-4 overflow-y-auto overflow-x-hidden">
        {navSections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            {section.title && isOpen && (
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
                {section.title}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = currentPage === item.id
                const Icon = item.icon

                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    title={!isOpen ? item.label : undefined}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] transition-all duration-200 group relative',
                      isActive
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]',
                      !isOpen && 'justify-center px-2'
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      {isActive && (
                        <motion.div
                          layoutId="nav-glow"
                          className="absolute inset-0 bg-[var(--accent-primary)]/20 rounded-full blur-md"
                        />
                      )}
                      <Icon
                        className={cn(
                          'w-[18px] h-[18px] relative z-10 transition-colors',
                          isActive ? 'text-[var(--accent-primary)]' : ''
                        )}
                      />
                    </div>
                    {isOpen && (
                      <>
                        <span className={cn('text-sm flex-1 text-left whitespace-nowrap', isActive ? 'font-medium' : '')}>
                          {item.label}
                        </span>
                        <kbd className="text-[10px] font-mono text-[var(--text-subtle)] bg-[var(--bg-primary)] px-1.5 py-0.5 rounded border border-[var(--border-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.kbd}
                        </kbd>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Toggle button */}
      <div className="px-2 py-2">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          title={isOpen ? 'Collapse sidebar (B)' : 'Expand sidebar (B)'}
        >
          {isOpen ? (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs">Collapse</span>
            </>
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Footer */}
      <div className={cn('p-3 border-t border-[var(--border-secondary)]', !isOpen && 'px-2')}>
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 bg-[var(--bg-primary)] rounded-[var(--radius-md)] border border-[var(--border-primary)]',
            !isOpen && 'justify-center px-2'
          )}
        >
          <StatusDot status={connected ? 'online' : 'offline'} />
          {isOpen && (
            <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          )}
        </div>
        {isOpen && (
          <p className="mt-3 text-[10px] text-[var(--text-subtle)] text-center">
            Press <kbd className="font-mono px-1 py-0.5 bg-[var(--bg-primary)] rounded text-[var(--text-muted)]">B</kbd> to toggle
          </p>
        )}
      </div>
    </aside>
  )
}
