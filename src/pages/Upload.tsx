import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Upload as UploadIcon, File as FileIcon, X, CheckCircle, AlertCircle, Box, Loader2, Download, Sparkles } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { AppState } from '@/types'

interface UploadProps {
  state: AppState
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

interface UploadedFile {
  file: File
  name: string
  size: string
  format: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
}

const SUPPORTED_FORMATS = [
  { ext: '.onnx', name: 'ONNX', mime: 'application/octet-stream' },
  { ext: '.pt', name: 'PyTorch', mime: 'application/octet-stream' },
  { ext: '.pth', name: 'PyTorch', mime: 'application/octet-stream' },
  { ext: '.h5', name: 'TensorFlow/Keras', mime: 'application/octet-stream' },
  { ext: '.pkl', name: 'Scikit-learn', mime: 'application/octet-stream' },
  { ext: '.joblib', name: 'Scikit-learn', mime: 'application/octet-stream' },
  { ext: '.zip', name: 'Model Package', mime: 'application/zip' },
]

// Sample model configurations for generating toy models
const SAMPLE_MODELS = [
  {
    id: 'classifier',
    name: 'Binary Classifier',
    filename: 'toy_classifier.pkl',
    description: 'Simple logistic regression for binary classification',
    accuracy: 0.92,
    inputShape: [10],
    outputShape: [2],
  },
  {
    id: 'regressor',
    name: 'Linear Regressor',
    filename: 'toy_regressor.pkl',
    description: 'Linear regression model for continuous predictions',
    accuracy: 0.88,
    inputShape: [5],
    outputShape: [1],
  },
  {
    id: 'multiclass',
    name: 'Multi-class Classifier',
    filename: 'toy_multiclass.pkl',
    description: 'Neural network for multi-class classification',
    accuracy: 0.85,
    inputShape: [20],
    outputShape: [5],
  },
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFormatFromFile(file: File): string {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  const format = SUPPORTED_FORMATS.find(f => f.ext === ext)
  return format?.name || 'Unknown'
}

// Generate a toy model file in the browser
function generateToyModel(config: typeof SAMPLE_MODELS[0]): Blob {
  // Create a mock model structure
  const model = {
    _metadata: {
      type: config.id,
      name: config.name,
      description: config.description,
      accuracy: config.accuracy,
      input_shape: config.inputShape,
      output_shape: config.outputShape,
      created_at: new Date().toISOString(),
      framework: 'toy_framework',
      version: '1.0.0',
    },
    weights: {
      layer_1: Array.from({ length: config.inputShape[0] * 32 }, () => Math.random() * 2 - 1),
      bias_1: Array.from({ length: 32 }, () => Math.random() * 0.1),
      layer_2: Array.from({ length: 32 * 16 }, () => Math.random() * 2 - 1),
      bias_2: Array.from({ length: 16 }, () => Math.random() * 0.1),
      layer_3: Array.from({ length: 16 * config.outputShape[0] }, () => Math.random() * 2 - 1),
      bias_3: Array.from({ length: config.outputShape[0] }, () => Math.random() * 0.1),
    },
    config: {
      learning_rate: 0.001,
      epochs: 100,
      batch_size: 32,
      optimizer: 'adam',
      loss: config.id === 'regressor' ? 'mse' : 'cross_entropy',
    },
    feature_names: Array.from({ length: config.inputShape[0] }, (_, i) => `feature_${i + 1}`),
    class_names: config.id === 'regressor' 
      ? ['value'] 
      : Array.from({ length: config.outputShape[0] }, (_, i) => `class_${i}`),
  }

  // Convert to JSON and create blob
  const jsonStr = JSON.stringify(model, null, 2)
  return new Blob([jsonStr], { type: 'application/octet-stream' })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function Upload({ addToast }: UploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [modelName, setModelName] = useState('')
  const [modelVersion, setModelVersion] = useState('1.0.0')
  const [modelDescription, setModelDescription] = useState('')
  const [tags, setTags] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    handleFiles(droppedFiles)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      handleFiles(selectedFiles)
    }
  }, [])

  const handleFiles = (newFiles: File[]) => {
    const uploadedFiles: UploadedFile[] = newFiles.map(file => ({
      file,
      name: file.name,
      size: formatFileSize(file.size),
      format: getFormatFromFile(file),
      status: 'pending',
      progress: 0,
    }))
    setFiles(prev => [...prev, ...uploadedFiles])
    
    // Auto-fill model name from first file
    if (!modelName && newFiles.length > 0) {
      const baseName = newFiles[0].name.replace(/\.[^/.]+$/, '')
      setModelName(baseName)
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleDownloadSample = (config: typeof SAMPLE_MODELS[0]) => {
    const blob = generateToyModel(config)
    downloadBlob(blob, config.filename)
    addToast(`Downloaded ${config.name} sample model`, 'success')
  }

  const handleUseSampleModel = (config: typeof SAMPLE_MODELS[0]) => {
    const blob = generateToyModel(config)
    const file = new File([blob], config.filename, { type: 'application/octet-stream' })
    
    const uploadedFile: UploadedFile = {
      file,
      name: config.filename,
      size: formatFileSize(blob.size),
      format: 'Scikit-learn',
      status: 'pending',
      progress: 0,
    }
    
    setFiles(prev => [...prev, uploadedFile])
    setModelName(config.name.toLowerCase().replace(/\s+/g, '-'))
    setModelDescription(config.description)
    setTags(`sample, ${config.id}, demo`)
    
    addToast(`Sample model "${config.name}" added to upload queue`, 'success')
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      addToast('Please select a model file to upload', 'warning')
      return
    }

    if (!modelName.trim()) {
      addToast('Please enter a model name', 'warning')
      return
    }

    setIsUploading(true)

    // Update file statuses to uploading
    setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' as const, progress: 0 })))

    try {
      // Simulate upload progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 200))
        setFiles(prev => prev.map(f => ({ ...f, progress })))
      }

      // Create form data - upload first file
      const formData = new FormData()
      if (files.length > 0) {
        formData.append('file', files[0].file)
      }
      formData.append('name', modelName)
      formData.append('description', modelDescription)
      formData.append('tags', tags)

      // Upload to backend
      const apiBase = import.meta.env.VITE_API_URL || ''
      const response = await fetch(`${apiBase}/api/models/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      setFiles(prev => prev.map(f => ({ ...f, status: 'success' as const })))
      addToast(`Model "${modelName}" uploaded successfully!`, 'success')

      // Reset form after success
      setTimeout(() => {
        setFiles([])
        setModelName('')
        setModelVersion('1.0.0')
        setModelDescription('')
        setTags('')
      }, 2000)

    } catch (error) {
      setFiles(prev => prev.map(f => ({ 
        ...f, 
        status: 'error' as const, 
        error: 'Upload failed. Make sure the backend is running.' 
      })))
      addToast('Failed to upload model. Backend may be offline.', 'error')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Sample Models */}
      <Card>
        <CardHeader
          title="Sample Models"
          action={
            <Badge variant="accent">
              <Sparkles className="w-3 h-3" />
              Quick Start
            </Badge>
          }
        />
        <CardContent>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Don't have a model yet? Use one of our sample toy models to test the upload feature.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SAMPLE_MODELS.map((model) => (
              <div
                key={model.id}
                className="p-4 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-lg)] hover:border-[var(--border-accent)] transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-[var(--text-primary)]">{model.name}</h4>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{model.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 mb-3 text-xs text-[var(--text-subtle)]">
                  <span>Accuracy: <span className="text-[var(--accent-primary)] font-mono">{(model.accuracy * 100).toFixed(0)}%</span></span>
                  <span>Input: <span className="font-mono">{model.inputShape[0]}</span></span>
                  <span>Output: <span className="font-mono">{model.outputShape[0]}</span></span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleDownloadSample(model)}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleUseSampleModel(model)}
                  >
                    <UploadIcon className="w-3.5 h-3.5" />
                    Use & Upload
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card>
        <CardHeader title="Upload Model" />
        <CardContent>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'relative border-2 border-dashed rounded-[var(--radius-lg)] p-8 text-center transition-all duration-200',
              isDragging
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                : 'border-[var(--border-primary)] hover:border-[var(--text-subtle)]'
            )}
          >
            <input
              type="file"
              onChange={handleFileInput}
              accept=".onnx,.pt,.pth,.h5,.pkl,.joblib,.zip,.json"
              multiple
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                <UploadIcon className="w-8 h-8 text-[var(--accent-primary)]" />
              </div>
              <div>
                <p className="text-[var(--text-primary)] font-medium">
                  Drop your model files here
                </p>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  or click to browse
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUPPORTED_FORMATS.map(format => (
                  <Badge key={format.ext} variant="default">
                    {format.ext}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-6 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Selected Files
              </h4>
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-4 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)]"
                >
                  <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--bg-tertiary)] flex items-center justify-center">
                    <FileIcon className="w-5 h-5 text-[var(--accent-primary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--text-primary)] truncate">
                      {file.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[var(--text-muted)]">{file.size}</span>
                      <span className="text-xs text-[var(--text-subtle)]">•</span>
                      <Badge variant="info">{file.format}</Badge>
                    </div>
                    {file.status === 'uploading' && (
                      <div className="mt-2 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--accent-primary)] transition-all duration-200"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    )}
                    {file.status === 'error' && (
                      <p className="mt-1 text-xs text-[var(--error)]">{file.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {file.status === 'pending' && (
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {file.status === 'uploading' && (
                      <Loader2 className="w-5 h-5 text-[var(--accent-primary)] animate-spin" />
                    )}
                    {file.status === 'success' && (
                      <CheckCircle className="w-5 h-5 text-[var(--success)]" />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-[var(--error)]" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model Details */}
      <Card>
        <CardHeader title="Model Details" />
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Model Name"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g., fraud-detection-v2"
            />
            <Input
              label="Version"
              value={modelVersion}
              onChange={(e) => setModelVersion(e.target.value)}
              placeholder="1.0.0"
            />
          </div>
          <Input
            label="Description"
            value={modelDescription}
            onChange={(e) => setModelDescription(e.target.value)}
            placeholder="Brief description of the model..."
          />
          <Input
            label="Tags (comma-separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g., production, fraud, binary-classification"
          />
        </CardContent>
      </Card>

      {/* Upload Button */}
      <div className="flex justify-end gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            setFiles([])
            setModelName('')
            setModelVersion('1.0.0')
            setModelDescription('')
            setTags('')
          }}
          disabled={isUploading}
        >
          Clear
        </Button>
        <Button
          variant="primary"
          onClick={handleUpload}
          loading={isUploading}
          disabled={files.length === 0 || isUploading}
        >
          <Box className="w-4 h-4" />
          Upload Model
        </Button>
      </div>

      {/* Supported Formats */}
      <Card>
        <CardHeader title="Supported Formats" />
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: 'ONNX', ext: '.onnx', desc: 'Open Neural Network Exchange format' },
              { name: 'PyTorch', ext: '.pt, .pth', desc: 'PyTorch model checkpoint' },
              { name: 'TensorFlow', ext: '.h5', desc: 'Keras/TensorFlow saved model' },
              { name: 'Scikit-learn', ext: '.pkl, .joblib', desc: 'Pickled sklearn model' },
              { name: 'Model Package', ext: '.zip', desc: 'Zipped model with config' },
              { name: 'Custom', ext: 'any', desc: 'Custom format with handler' },
            ].map((format) => (
              <div
                key={format.name}
                className="p-4 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="accent">{format.ext}</Badge>
                </div>
                <p className="font-medium text-[var(--text-primary)]">{format.name}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{format.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
