import { useState, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Upload,
  FileSpreadsheet,
  Download,
  Play,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  Loader2,
} from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Input'
import { cn, formatPercent } from '@/lib/utils'
import type { AppState } from '@/types'

interface BatchInferenceProps {
  state: AppState
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

interface BatchJob {
  id: string
  filename: string
  modelId: string
  modelName: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  totalRows: number
  processedRows: number
  results?: Array<{ input: number[]; prediction: number; probability: number }>
  error?: string
  createdAt: string
  completedAt?: string
}

export function BatchInference({ state, addToast }: BatchInferenceProps) {
  const [selectedModelId, setSelectedModelId] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<number[][] | null>(null)
  const [jobs, setJobs] = useState<BatchJob[]>([])
  const [processing, setProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const apiBase = import.meta.env.VITE_API_URL || ''
  const models = state.models || []

  const selectedModel = useMemo(
    () => models.find(m => m.id === selectedModelId),
    [models, selectedModelId]
  )

  // Auto-select production model
  if (!selectedModelId && models.length > 0) {
    const prod = models.find(m => m.stage === 'production')
    setSelectedModelId(prod?.id || models[0].id)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const parseCSV = (text: string): number[][] => {
    const lines = text.trim().split('\n')
    // Skip header if present
    const startIdx = lines[0].includes(',') && isNaN(parseFloat(lines[0].split(',')[0])) ? 1 : 0
    
    return lines.slice(startIdx).map(line => 
      line.split(',').map(val => parseFloat(val.trim())).filter(n => !isNaN(n))
    ).filter(row => row.length > 0)
  }

  const parseJSON = (text: string): number[][] => {
    try {
      const json = JSON.parse(text)
      
      // Handle array of arrays
      if (Array.isArray(json) && json.length > 0) {
        if (Array.isArray(json[0])) {
          // Already in the right format: [[1,2,3], [4,5,6]]
          return json.map(row => 
            Array.isArray(row) 
              ? row.map(val => typeof val === 'number' ? val : parseFloat(String(val))).filter(n => !isNaN(n))
              : []
          ).filter(row => row.length > 0)
        } else if (typeof json[0] === 'object') {
          // Array of objects: [{feature1: 1, feature2: 2}, ...]
          return json.map(obj => {
            const values = Object.values(obj)
            return values.map(val => typeof val === 'number' ? val : parseFloat(String(val))).filter(n => !isNaN(n))
          }).filter(row => row.length > 0)
        }
      }
      
      throw new Error('Invalid JSON format')
    } catch (err) {
      throw new Error('Failed to parse JSON: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const handleFile = async (file: File) => {
    const isCSV = file.name.endsWith('.csv')
    const isJSON = file.name.endsWith('.json')
    
    if (!isCSV && !isJSON) {
      addToast('Please upload a CSV or JSON file', 'error')
      return
    }

    try {
      const text = await file.text()
      let data: number[][]
      
      if (isCSV) {
        data = parseCSV(text)
      } else {
        data = parseJSON(text)
      }
      
      if (data.length === 0) {
        addToast(`${isCSV ? 'CSV' : 'JSON'} file is empty or invalid`, 'error')
        return
      }

      setUploadedFile(file)
      setParsedData(data)
      addToast(`Loaded ${data.length} rows from ${file.name}`, 'success')
    } catch (err) {
      addToast(`Failed to parse ${isCSV ? 'CSV' : 'JSON'} file: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const clearFile = () => {
    setUploadedFile(null)
    setParsedData(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const runBatchPrediction = async () => {
    if (!parsedData || !selectedModelId || !selectedModel || !uploadedFile) return

    setProcessing(true)
    const jobId = `batch_${Date.now()}`
    
    const newJob: BatchJob = {
      id: jobId,
      filename: uploadedFile.name,
      modelId: selectedModelId,
      modelName: selectedModel.name,
      status: 'processing',
      totalRows: parsedData.length,
      processedRows: 0,
      createdAt: new Date().toISOString(),
    }
    
    setJobs(prev => [newJob, ...prev])

    try {
      // Process in batches of 10
      const batchSize = 10
      const results: Array<{ input: number[]; prediction: number; probability: number }> = []
      
      for (let i = 0; i < parsedData.length; i += batchSize) {
        const batch = parsedData.slice(i, i + batchSize)
        
        const response = await fetch(`${apiBase}/api/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            features: batch,
            model_id: selectedModelId,
          }),
        })

        if (!response.ok) throw new Error('Prediction failed')

        const data = await response.json()
        
        batch.forEach((input, idx) => {
          results.push({
            input,
            prediction: data.predictions[idx],
            probability: data.probabilities[idx][1],
          })
        })

        // Update progress
        setJobs(prev => prev.map(j => 
          j.id === jobId 
            ? { ...j, processedRows: Math.min(i + batchSize, parsedData.length) }
            : j
        ))

        // Small delay to show progress
        await new Promise(r => setTimeout(r, 100))
      }

      // Mark as completed
      setJobs(prev => prev.map(j => 
        j.id === jobId 
          ? { ...j, status: 'completed', results, completedAt: new Date().toISOString() }
          : j
      ))

      addToast(`Batch prediction completed: ${results.length} rows processed`, 'success')
      clearFile()
    } catch (err) {
      setJobs(prev => prev.map(j => 
        j.id === jobId 
          ? { ...j, status: 'failed', error: 'Prediction failed' }
          : j
      ))
      addToast('Batch prediction failed', 'error')
    } finally {
      setProcessing(false)
    }
  }

  const downloadResults = (job: BatchJob) => {
    if (!job.results) return

    const header = 'input,prediction,probability\n'
    const rows = job.results.map(r => 
      `"${r.input.join(',')}",${r.prediction},${r.probability.toFixed(4)}`
    ).join('\n')

    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `predictions_${job.filename}`
    a.click()
    URL.revokeObjectURL(url)

    addToast('Results downloaded', 'success')
  }

  const deleteJob = (jobId: string) => {
    setJobs(prev => prev.filter(j => j.id !== jobId))
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Upload Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Upload CSV or JSON File" />
            <CardContent>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={cn(
                  'relative border-2 border-dashed rounded-[var(--radius-lg)] p-8 text-center transition-all',
                  dragActive
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                    : 'border-[var(--border-primary)] hover:border-[var(--border-accent)]',
                  uploadedFile && 'border-[var(--success)] bg-[var(--success)]/5'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileInput}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />

                {uploadedFile ? (
                  <div className="space-y-3">
                    <FileSpreadsheet className="w-12 h-12 mx-auto text-[var(--success)]" />
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{uploadedFile.name}</p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {parsedData?.length || 0} rows loaded
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={clearFile}>
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="w-12 h-12 mx-auto text-[var(--text-subtle)]" />
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">
                        Drop your CSV or JSON file here
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">
                        or click to browse
                      </p>
                    </div>
                    <p className="text-xs text-[var(--text-subtle)]">
                      CSV: one row per sample, features comma-separated<br />
                      JSON: array of arrays or array of objects
                    </p>
                  </div>
                )}
              </div>

              {/* Sample format */}
              <div className="mt-4 p-4 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)]">
                <p className="text-xs text-[var(--text-muted)] mb-2">Expected formats:</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-secondary)] mb-1">CSV:</p>
                    <pre className="text-xs font-mono text-[var(--text-secondary)] overflow-x-auto">
{`feature1,feature2,feature3,feature4
0.5,0.3,0.8,0.2
0.1,0.7,0.4,0.9
0.6,0.2,0.5,0.3`}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-secondary)] mb-1">JSON (array of arrays):</p>
                    <pre className="text-xs font-mono text-[var(--text-secondary)] overflow-x-auto">
{`[[0.5,0.3,0.8,0.2],
 [0.1,0.7,0.4,0.9],
 [0.6,0.2,0.5,0.3]]`}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-secondary)] mb-1">JSON (array of objects):</p>
                    <pre className="text-xs font-mono text-[var(--text-secondary)] overflow-x-auto">
{`[{"feature1":0.5,"feature2":0.3,"feature3":0.8,"feature4":0.2},
 {"feature1":0.1,"feature2":0.7,"feature3":0.4,"feature4":0.9}]`}
                    </pre>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Model Selection & Run */}
        <Card>
          <CardHeader title="Run Configuration" />
          <CardContent className="space-y-4">
            <Select
              label="Select Model"
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
            >
              {models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.stage}) - {formatPercent(m.accuracy)}
                </option>
              ))}
            </Select>

            {selectedModel && (
              <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)]">
                <p className="text-xs text-[var(--text-muted)]">Selected Model</p>
                <p className="font-medium text-[var(--text-primary)]">{selectedModel.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={selectedModel.stage === 'production' ? 'success' : 'default'}>
                    {selectedModel.stage}
                  </Badge>
                  <span className="text-xs font-mono text-[var(--accent-primary)]">
                    {formatPercent(selectedModel.accuracy)}
                  </span>
                </div>
              </div>
            )}

            <Button
              variant="primary"
              className="w-full"
              disabled={!uploadedFile || !selectedModelId || processing}
              onClick={runBatchPrediction}
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Batch Prediction
                </>
              )}
            </Button>

            {parsedData && (
              <p className="text-xs text-center text-[var(--text-muted)]">
                Will process {parsedData.length} rows
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Jobs History */}
      <Card>
        <CardHeader title="Batch Jobs" />
        <CardContent className="p-0">
          {jobs.length > 0 ? (
            <div className="divide-y divide-[var(--border-secondary)]">
              {jobs.map(job => (
                <div key={job.id} className="flex items-center gap-4 px-5 py-4">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    job.status === 'completed' && 'bg-[var(--success)]/10 text-[var(--success)]',
                    job.status === 'processing' && 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]',
                    job.status === 'failed' && 'bg-[var(--error)]/10 text-[var(--error)]',
                    job.status === 'pending' && 'bg-[var(--text-subtle)]/10 text-[var(--text-subtle)]'
                  )}>
                    {job.status === 'completed' && <CheckCircle className="w-5 h-5" />}
                    {job.status === 'processing' && <Loader2 className="w-5 h-5 animate-spin" />}
                    {job.status === 'failed' && <AlertCircle className="w-5 h-5" />}
                    {job.status === 'pending' && <Clock className="w-5 h-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[var(--text-subtle)]" />
                      <span className="font-medium text-[var(--text-primary)] truncate">
                        {job.filename}
                      </span>
                      <Badge variant={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'error' : 'default'}>
                        {job.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-[var(--text-muted)]">
                      <span>Model: {job.modelName}</span>
                      <span>
                        {job.processedRows}/{job.totalRows} rows
                      </span>
                      {job.status === 'processing' && (
                        <div className="flex-1 max-w-[200px] h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--accent-primary)] transition-all"
                            style={{ width: `${(job.processedRows / job.totalRows) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {job.status === 'completed' && job.results && (
                      <Button size="sm" onClick={() => downloadResults(job)}>
                        <Download className="w-4 h-4" />
                        Download
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => deleteJob(job.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-[var(--text-muted)]">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No batch jobs yet</p>
              <p className="text-sm mt-1">Upload a CSV or JSON file and run predictions</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

