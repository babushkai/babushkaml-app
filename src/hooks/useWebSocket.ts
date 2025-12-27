import { useEffect, useRef, useState, useCallback } from 'react'
import type { AppState } from '@/types'

// Check if running in Tauri (standalone mode)
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

// Demo data for standalone mode
const STANDALONE_STATE: AppState = {
  services: { api: 'online', database: 'online' },
  config: {
    learning_rate: 0.001,
    hidden_dims: [128, 64, 32],
    dropout: 0.3,
    batch_size: 32,
    epochs: 10,
  },
  features: {
    count: 10,
    columns: ['feature_1', 'feature_2', 'feature_3', 'feature_4', 'feature_5'],
    stats: {},
  },
  alerts: [],
  models: [
    {
      id: 'local_model_1',
      name: 'Local Demo Model',
      accuracy: 0.92,
      created_at: new Date().toISOString(),
      stage: 'production',
      config: { learning_rate: 0.001, hidden_dims: [128, 64], dropout: 0.3, batch_size: 32, epochs: 10 },
      format: 'onnx',
      size_mb: 2.5,
    },
  ],
  experiments: [],
  ab_tests: [],
  training: {
    status: 'idle',
    progress: 0,
    metrics: [],
    logs: [],
  },
  predictions_history: [],
  timestamp: new Date().toISOString(),
}

const initialState: AppState = {
  services: {},
  config: {
    learning_rate: 0.001,
    hidden_dims: [128, 64, 32],
    dropout: 0.3,
    batch_size: 32,
    epochs: 10,
  },
  features: {},
  alerts: [],
  models: [],
  experiments: [],
  ab_tests: [],
  training: {
    status: 'idle',
    progress: 0,
    metrics: [],
    logs: [],
  },
  predictions_history: [],
  timestamp: null,
}

export function useWebSocket() {
  const [state, setState] = useState<AppState>(initialState)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    // Use environment variable, or fallback for Tauri/web
    const apiUrl = import.meta.env.VITE_API_URL || (isTauri ? 'http://localhost:8080' : '')
    let wsUrl: string
    if (apiUrl) {
      wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws/updates'
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      wsUrl = `${protocol}//${window.location.host}/ws/updates`
    }
    
    try {
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        setConnected(true)
        console.log('WebSocket connected')
      }

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setState((prev) => ({
            ...prev,
            ...data,
            // services is already an object { name: status }, not an array
            services: data.services || prev.services,
          }))
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }

      wsRef.current.onclose = () => {
        setConnected(false)
        console.log('WebSocket disconnected, reconnecting...')
        reconnectTimeoutRef.current = setTimeout(connect, 3000)
      }

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    } catch (e) {
      console.error('Failed to create WebSocket:', e)
      reconnectTimeoutRef.current = setTimeout(connect, 3000)
    }
  }, [])

  useEffect(() => {
    // Get API base URL - for Tauri, use configured backend URL or localhost
    const apiBase = import.meta.env.VITE_API_URL || (isTauri ? 'http://localhost:8080' : '')
    
    // Try to fetch from backend first
    fetch(`${apiBase}/api/state`)
      .then((r) => r.json())
      .then((data) => {
        setState((s) => ({ ...s, ...data }))
        setConnected(true)
      })
      .catch((e) => {
        console.log('Backend not available, using offline mode:', e)
        // Fallback to local/demo state when backend unavailable
        const savedState = localStorage.getItem('mlops-standalone-state')
        if (savedState) {
          try {
            setState(JSON.parse(savedState))
          } catch {
            setState(STANDALONE_STATE)
          }
        } else {
          setState(STANDALONE_STATE)
        }
        setConnected(false)
      })

    // Connect WebSocket (will gracefully fail if backend unavailable)
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      wsRef.current?.close()
    }
  }, [connect])

  const updateState = useCallback((updates: Partial<AppState>) => {
    setState((prev) => {
      const newState = { ...prev, ...updates }
      // Persist state in standalone mode
      if (isTauri) {
        localStorage.setItem('mlops-standalone-state', JSON.stringify(newState))
      }
      return newState
    })
  }, [])

  return { state, connected, updateState }
}

