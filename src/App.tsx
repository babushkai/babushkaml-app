import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from '@/components/Layout/Sidebar'
import { Header } from '@/components/Layout/Header'
import { ToastContainer } from '@/components/ui/Toast'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useToast } from '@/hooks/useToast'
import { useTheme } from '@/hooks/useTheme'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { Dashboard } from '@/pages/Dashboard'
import { Training } from '@/pages/Training'
import { Models } from '@/pages/Models'
import { Upload } from '@/pages/Upload'
import { Inference } from '@/pages/Inference'
import { Features } from '@/pages/Features'
import { Experiments } from '@/pages/Experiments'
import { Pipelines } from '@/pages/Pipelines'
import { Monitoring } from '@/pages/Monitoring'
import { Datasets } from '@/pages/Datasets'
import { Settings } from '@/pages/Settings'
import { Compare } from '@/pages/Compare'
import { BatchInference } from '@/pages/BatchInference'
import { ApiPlayground } from '@/pages/ApiPlayground'
import { Login } from '@/pages/Login'
import Workbench from '@/pages/Workbench'
import type { Page } from '@/types'

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

function AppContent() {
  const [page, setPage] = useState<Page>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { state, connected } = useWebSocket()
  const { toasts, addToast, removeToast } = useToast()
  const { theme, setTheme } = useTheme()
  const { isAuthenticated, isLoading } = useAuth()

  // Keyboard navigation
  useEffect(() => {
    let stage = 0

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      const key = e.key.toLowerCase()

      // Toggle sidebar with 'b' key
      if (key === 'b' && stage === 0) {
        setSidebarOpen((prev) => !prev)
        return
      }

      if (stage === 0 && key === 'g') {
        stage = 1
        return
      }

      if (stage === 1) {
        const map: Record<string, Page> = {
          d: 'dashboard',
          w: 'workbench',
          t: 'training',
          m: 'models',
          u: 'upload',
          i: 'inference',
          f: 'features',
          e: 'experiments',
          p: 'pipelines',
          o: 'monitoring',
          a: 'datasets',
          s: 'settings',
          c: 'compare',
          b: 'batch',
          y: 'api',
        }
        if (map[key]) {
          setPage(map[key])
        }
        stage = 0
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const navigate = useCallback((p: Page) => setPage(p), [])
  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), [])

  // Show loading spinner during auth check
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--accent-primary)]/20 border-t-[var(--accent-primary)] rounded-full animate-spin" />
          <p className="text-[var(--text-muted)] text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login />
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard state={state} onNavigate={navigate} addToast={addToast} />
      case 'workbench':
        return <Workbench />
      case 'training':
        return <Training state={state} addToast={addToast} />
      case 'models':
        return <Models state={state} onNavigate={navigate} addToast={addToast} />
      case 'upload':
        return <Upload state={state} addToast={addToast} />
      case 'inference':
        return (
          <Inference
            state={state}
            onNavigate={navigate}
            addToast={addToast}
          />
        )
      case 'features':
        return <Features state={state} addToast={addToast} />
      case 'experiments':
        return <Experiments state={state} addToast={addToast} />
      case 'pipelines':
        return <Pipelines state={state} addToast={addToast} />
      case 'monitoring':
        return <Monitoring state={state} addToast={addToast} />
      case 'datasets':
        return <Datasets state={state} addToast={addToast} />
      case 'settings':
        return <Settings state={state} addToast={addToast} theme={theme} setTheme={setTheme} />
      case 'compare':
        return <Compare state={state} addToast={addToast} />
      case 'batch':
        return <BatchInference state={state} addToast={addToast} />
      case 'api':
        return <ApiPlayground state={state} addToast={addToast} />
      default:
        return <Dashboard state={state} onNavigate={navigate} addToast={addToast} />
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Sidebar */}
      <Sidebar
        currentPage={page}
        onNavigate={navigate}
        connected={connected}
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
      />

      {/* Main content area */}
      <div
        className="transition-all duration-300 ease-in-out"
        style={{ marginLeft: sidebarOpen ? '240px' : '64px' }}
      >
        {/* Header */}
        <Header
          page={page}
          connected={connected}
          timestamp={state.timestamp}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
          onNavigate={navigate}
        />

        {/* Page content */}
        <main className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
