import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Play,
  Copy,
  Check,
  Code,
  Terminal,
  Clock,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select, Textarea } from '@/components/ui/Input'
import { formatPercent } from '@/lib/utils'
import type { AppState } from '@/types'

interface ApiPlaygroundProps {
  state: AppState
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

type Endpoint = {
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  name: string
  description: string
  requestBody?: string
  requiresModel?: boolean
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/state',
    name: 'Get State',
    description: 'Get current application state including models, training status, and alerts',
  },
  {
    method: 'POST',
    path: '/api/predict',
    name: 'Run Prediction',
    description: 'Run inference on a trained model',
    requestBody: JSON.stringify({ features: [[0.5, 0.3, 0.8, 0.2]], model_id: '' }, null, 2),
    requiresModel: true,
  },
  {
    method: 'POST',
    path: '/api/train/start',
    name: 'Start Training',
    description: 'Start a new training job',
  },
  {
    method: 'POST',
    path: '/api/train/stop',
    name: 'Stop Training',
    description: 'Stop the current training job',
  },
  {
    method: 'POST',
    path: '/api/model/{model_id}/promote',
    name: 'Promote Model',
    description: 'Promote a model to production',
    requiresModel: true,
  },
  {
    method: 'GET',
    path: '/api/monitoring/metrics',
    name: 'Get Monitoring Metrics',
    description: 'Get monitoring metrics including latency and error rates',
  },
  {
    method: 'GET',
    path: '/api/monitoring/drift',
    name: 'Get Drift Metrics',
    description: 'Get feature drift detection results',
  },
  {
    method: 'GET',
    path: '/api/alerts',
    name: 'Get Alerts',
    description: 'Get all system alerts',
  },
  {
    method: 'POST',
    path: '/api/features/generate',
    name: 'Generate Features',
    description: 'Generate demo feature data',
  },
]

export function ApiPlayground({ state, addToast }: ApiPlaygroundProps) {
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint>(ENDPOINTS[0])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [requestBody, setRequestBody] = useState('')
  const [response, setResponse] = useState<{ data: unknown; status: number; time: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [copiedCode, setCopiedCode] = useState<'curl' | 'python' | 'js' | null>(null)

  const apiBase = import.meta.env.VITE_API_URL || window.location.origin
  const models = state.models || []

  // Auto-select model
  if (!selectedModelId && models.length > 0) {
    setSelectedModelId(models[0].id)
  }

  const actualPath = useMemo(() => {
    let path = selectedEndpoint.path
    if (path.includes('{model_id}') && selectedModelId) {
      path = path.replace('{model_id}', selectedModelId)
    }
    return path
  }, [selectedEndpoint, selectedModelId])

  const actualBody = useMemo(() => {
    if (!selectedEndpoint.requestBody) return ''
    
    try {
      const body = JSON.parse(selectedEndpoint.requestBody)
      if (body.model_id !== undefined && selectedModelId) {
        body.model_id = selectedModelId
      }
      return JSON.stringify(body, null, 2)
    } catch {
      return selectedEndpoint.requestBody
    }
  }, [selectedEndpoint, selectedModelId])

  const handleEndpointChange = (path: string) => {
    const endpoint = ENDPOINTS.find(e => e.path === path)
    if (endpoint) {
      setSelectedEndpoint(endpoint)
      setRequestBody('')
      setResponse(null)
    }
  }

  const runRequest = async () => {
    setLoading(true)
    setResponse(null)

    const startTime = performance.now()

    try {
      const url = `${apiBase}${actualPath}`
      const options: RequestInit = {
        method: selectedEndpoint.method,
        headers: { 'Content-Type': 'application/json' },
      }

      if (selectedEndpoint.method === 'POST' && (requestBody || actualBody)) {
        options.body = requestBody || actualBody
      }

      const res = await fetch(url, options)
      const data = await res.json()
      const time = performance.now() - startTime

      setResponse({ data, status: res.status, time })

      if (res.ok) {
        addToast(`Request completed in ${time.toFixed(0)}ms`, 'success')
      } else {
        addToast(`Request failed with status ${res.status}`, 'error')
      }
    } catch (err) {
      const time = performance.now() - startTime
      setResponse({
        data: { error: err instanceof Error ? err.message : 'Request failed' },
        status: 0,
        time,
      })
      addToast('Request failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const curlCode = useMemo(() => {
    const url = `${apiBase}${actualPath}`
    let cmd = `curl -X ${selectedEndpoint.method} "${url}"`
    
    if (selectedEndpoint.method === 'POST' && (requestBody || actualBody)) {
      cmd += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${(requestBody || actualBody).replace(/\n/g, '')}'`
    }
    
    return cmd
  }, [apiBase, actualPath, selectedEndpoint, requestBody, actualBody])

  const pythonCode = useMemo(() => {
    const url = `${apiBase}${actualPath}`
    let code = `import requests\n\n`
    
    if (selectedEndpoint.method === 'GET') {
      code += `response = requests.get("${url}")\n`
    } else {
      const body = requestBody || actualBody
      code += `data = ${body || '{}'}\n\n`
      code += `response = requests.post("${url}", json=data)\n`
    }
    
    code += `print(response.json())`
    return code
  }, [apiBase, actualPath, selectedEndpoint, requestBody, actualBody])

  const jsCode = useMemo(() => {
    const url = `${apiBase}${actualPath}`
    let code = ''
    
    if (selectedEndpoint.method === 'GET') {
      code = `const response = await fetch("${url}");\nconst data = await response.json();\nconsole.log(data);`
    } else {
      const body = requestBody || actualBody
      code = `const response = await fetch("${url}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(${body || '{}'})
});
const data = await response.json();
console.log(data);`
    }
    
    return code
  }, [apiBase, actualPath, selectedEndpoint, requestBody, actualBody])

  const copyCode = async (type: 'curl' | 'python' | 'js') => {
    const code = type === 'curl' ? curlCode : type === 'python' ? pythonCode : jsCode
    await navigator.clipboard?.writeText(code)
    setCopiedCode(type)
    setTimeout(() => setCopiedCode(null), 2000)
    addToast('Code copied to clipboard', 'success')
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Endpoint Selection */}
      <Card>
        <CardHeader title="API Endpoint" />
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Select
                label="Select Endpoint"
                value={selectedEndpoint.path}
                onChange={(e) => handleEndpointChange(e.target.value)}
              >
                {ENDPOINTS.map(ep => (
                  <option key={ep.path} value={ep.path}>
                    {ep.method} {ep.path} - {ep.name}
                  </option>
                ))}
              </Select>
            </div>

            {selectedEndpoint.requiresModel && (
              <Select
                label="Model"
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
              >
                {models.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} - {formatPercent(m.accuracy)}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="mt-4 p-4 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)]">
            <div className="flex items-start gap-3">
              <Badge
                variant={selectedEndpoint.method === 'GET' ? 'success' : selectedEndpoint.method === 'POST' ? 'info' : 'error'}
              >
                {selectedEndpoint.method}
              </Badge>
              <div>
                <p className="font-mono text-sm text-[var(--text-primary)]">
                  {apiBase}{actualPath}
                </p>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  {selectedEndpoint.description}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request */}
        <Card>
          <CardHeader
            title="Request"
            action={
              <Button
                variant="primary"
                size="sm"
                loading={loading}
                onClick={runRequest}
              >
                <Play className="w-4 h-4" />
                Send
              </Button>
            }
          />
          <CardContent>
            {selectedEndpoint.method === 'POST' && selectedEndpoint.requestBody ? (
              <Textarea
                label="Request Body (JSON)"
                value={requestBody || actualBody}
                onChange={(e) => setRequestBody(e.target.value)}
                className="font-mono text-sm min-h-[200px]"
              />
            ) : (
              <div className="p-8 text-center text-[var(--text-muted)]">
                <Code className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No request body required</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Response */}
        <Card>
          <CardHeader
            title="Response"
            action={
              response && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    {response.status >= 200 && response.status < 300 ? (
                      <CheckCircle className="w-4 h-4 text-[var(--success)]" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-[var(--error)]" />
                    )}
                    <Badge variant={response.status >= 200 && response.status < 300 ? 'success' : 'error'}>
                      {response.status || 'Error'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Clock className="w-3.5 h-3.5" />
                    {response.time.toFixed(0)}ms
                  </div>
                </div>
              )
            }
          />
          <CardContent>
            {response ? (
              <pre className="p-4 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)] text-xs font-mono text-[var(--text-secondary)] overflow-auto max-h-[300px]">
                {JSON.stringify(response.data, null, 2)}
              </pre>
            ) : (
              <div className="p-8 text-center text-[var(--text-muted)]">
                <Terminal className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Send a request to see the response</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Code Snippets */}
      <Card>
        <CardHeader title="Code Snippets" />
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* cURL */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">cURL</span>
                <Button size="sm" variant="ghost" onClick={() => copyCode('curl')}>
                  {copiedCode === 'curl' ? <Check className="w-4 h-4 text-[var(--success)]" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <pre className="p-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)] text-xs font-mono text-[var(--text-secondary)] overflow-auto max-h-[150px]">
                {curlCode}
              </pre>
            </div>

            {/* Python */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">Python</span>
                <Button size="sm" variant="ghost" onClick={() => copyCode('python')}>
                  {copiedCode === 'python' ? <Check className="w-4 h-4 text-[var(--success)]" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <pre className="p-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)] text-xs font-mono text-[var(--text-secondary)] overflow-auto max-h-[150px]">
                {pythonCode}
              </pre>
            </div>

            {/* JavaScript */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">JavaScript</span>
                <Button size="sm" variant="ghost" onClick={() => copyCode('js')}>
                  {copiedCode === 'js' ? <Check className="w-4 h-4 text-[var(--success)]" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <pre className="p-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)] text-xs font-mono text-[var(--text-secondary)] overflow-auto max-h-[150px]">
                {jsCode}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

