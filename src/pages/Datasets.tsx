import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Upload,
  Database,
  FileText,
  Table,
  Trash2,
  Download,
  Eye,
  Plus,
  Search,
  Filter,
} from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn, formatDate } from '@/lib/utils'
import type { AppState, Dataset } from '@/types'

interface DatasetsProps {
  state: AppState
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

// Demo datasets
const DEMO_DATASETS: Dataset[] = [
  {
    id: 'ds_1',
    name: 'training_data_v2',
    description: 'Main training dataset with user features',
    format: 'parquet',
    size_mb: 245.8,
    rows: 1250000,
    columns: 24,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    schema: {
      user_id: 'string',
      age: 'int64',
      tenure_months: 'int64',
      total_spend: 'float64',
      is_churned: 'bool',
    },
  },
  {
    id: 'ds_2',
    name: 'validation_set',
    description: 'Hold-out validation data',
    format: 'csv',
    size_mb: 48.2,
    rows: 250000,
    columns: 24,
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'ds_3',
    name: 'inference_batch_20240315',
    description: 'Batch inference input data',
    format: 'json',
    size_mb: 12.5,
    rows: 50000,
    columns: 12,
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: 'ds_4',
    name: 'feature_store_snapshot',
    description: 'Feature store export for offline analysis',
    format: 'parquet',
    size_mb: 892.3,
    rows: 5000000,
    columns: 48,
    created_at: new Date(Date.now() - 604800000).toISOString(),
  },
]

const FORMAT_ICONS: Record<string, React.ElementType> = {
  csv: FileText,
  parquet: Table,
  json: Database,
}

function formatSize(mb: number): string {
  if (mb < 1) return `${(mb * 1024).toFixed(0)} KB`
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return String(num)
}

export function Datasets({ addToast }: DatasetsProps) {
  const [datasets, setDatasets] = useState<Dataset[]>(DEMO_DATASETS)
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const filteredDatasets = datasets.filter(ds =>
    ds.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ds.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      const file = files[0]
      const ext = file.name.split('.').pop()?.toLowerCase()
      const format = ext === 'parquet' ? 'parquet' : ext === 'json' ? 'json' : 'csv'
      
      const newDataset: Dataset = {
        id: `ds_${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        format: format as 'csv' | 'parquet' | 'json',
        size_mb: file.size / (1024 * 1024),
        rows: 0, // Would be calculated after processing
        columns: 0,
        created_at: new Date().toISOString(),
      }
      
      setDatasets(prev => [newDataset, ...prev])
      addToast(`Dataset "${newDataset.name}" uploaded successfully`, 'success')
    }
  }, [addToast])

  const handleDelete = (datasetId: string) => {
    setDatasets(prev => prev.filter(ds => ds.id !== datasetId))
    if (selectedDataset?.id === datasetId) {
      setSelectedDataset(null)
    }
    addToast('Dataset deleted', 'success')
  }

  const handleDownload = async (dataset: Dataset) => {
    try {
      addToast(`Downloading ${dataset.name}...`, 'info')
      
      let content: string
      let mimeType: string
      let extension: string

      // Generate content based on format
      if (dataset.format === 'csv') {
        // Generate CSV with headers and sample data
        const headers = dataset.schema 
          ? Object.keys(dataset.schema).join(',')
          : 'column1,column2,column3,column4'
        
        // Generate sample rows
        const rows: string[] = [headers]
        const sampleCount = Math.min(dataset.rows || 100, 100) // Limit to 100 rows for demo
        
        for (let i = 0; i < sampleCount; i++) {
          if (dataset.schema) {
            const row = Object.keys(dataset.schema).map((key, idx) => {
              const type = dataset.schema![key]
              if (type === 'string') return `value_${i}_${idx}`
              if (type === 'int64') return String(Math.floor(Math.random() * 1000))
              if (type === 'float64') return (Math.random() * 100).toFixed(2)
              if (type === 'bool') return i % 2 === 0 ? 'true' : 'false'
              return `value_${i}_${idx}`
            })
            rows.push(row.join(','))
          } else {
            rows.push(`value_${i}_1,value_${i}_2,value_${i}_3,value_${i}_4`)
          }
        }
        
        content = rows.join('\n')
        mimeType = 'text/csv'
        extension = 'csv'
      } else if (dataset.format === 'json') {
        // Generate JSON array with sample data
        const sampleCount = Math.min(dataset.rows || 10, 10) // Limit to 10 items for demo
        const items = Array.from({ length: sampleCount }, (_, i) => {
          if (dataset.schema) {
            const item: Record<string, any> = {}
            Object.entries(dataset.schema).forEach(([key, type]) => {
              if (type === 'string') item[key] = `value_${i}`
              else if (type === 'int64') item[key] = Math.floor(Math.random() * 1000)
              else if (type === 'float64') item[key] = Math.random() * 100
              else if (type === 'bool') item[key] = i % 2 === 0
              else item[key] = `value_${i}`
            })
            return item
          }
          return { id: i, value1: `value_${i}_1`, value2: `value_${i}_2` }
        })
        content = JSON.stringify(items, null, 2)
        mimeType = 'application/json'
        extension = 'json'
      } else {
        // Parquet - create a placeholder text file (can't generate binary parquet in browser)
        content = `Parquet file placeholder for ${dataset.name}\n\nThis is a demo dataset. In production, this would be a binary Parquet file.\n\nDataset: ${dataset.name}\nRows: ${dataset.rows}\nColumns: ${dataset.columns}\nSize: ${formatSize(dataset.size_mb)}`
        mimeType = 'text/plain'
        extension = 'txt'
      }

      // Create blob and download
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${dataset.name}.${extension}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      addToast(`Downloaded ${dataset.name} successfully`, 'success')
    } catch (error) {
      console.error('Download error:', error)
      addToast('Failed to download dataset', 'error')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Upload Area */}
      <Card>
        <CardContent className="p-0">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'flex items-center justify-between p-6 border-b border-[var(--border-secondary)] transition-colors',
              isDragging && 'bg-[var(--accent-primary)]/5'
            )}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[var(--bg-tertiary)] flex items-center justify-center">
                <Upload className="w-6 h-6 text-[var(--accent-primary)]" />
              </div>
              <div>
                <h3 className="font-medium text-[var(--text-primary)]">Upload Dataset</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Drag and drop CSV, Parquet, or JSON files
                </p>
              </div>
            </div>
            <Button onClick={() => addToast('Opening file browser...', 'info')}>
              <Plus className="w-4 h-4" />
              Browse Files
            </Button>
          </div>

          {/* Search and Filter */}
          <div className="flex items-center gap-4 p-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-subtle)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search datasets..."
                className="w-full pl-10 pr-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
            <Button size="sm">
              <Filter className="w-4 h-4" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dataset List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title={`Datasets (${filteredDatasets.length})`}
              action={
                <span className="text-xs text-[var(--text-muted)]">
                  Total: {formatSize(datasets.reduce((acc, ds) => acc + ds.size_mb, 0))}
                </span>
              }
            />
            <CardContent className="p-0">
              {filteredDatasets.length > 0 ? (
                <div className="divide-y divide-[var(--border-secondary)]">
                  {filteredDatasets.map((dataset) => {
                    const Icon = FORMAT_ICONS[dataset.format] || Database
                    const isSelected = selectedDataset?.id === dataset.id

                    return (
                      <div
                        key={dataset.id}
                        onClick={() => setSelectedDataset(dataset)}
                        className={cn(
                          'flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-[var(--accent-primary)]/5'
                            : 'hover:bg-[var(--bg-tertiary)]'
                        )}
                      >
                        <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--bg-tertiary)] flex items-center justify-center">
                          <Icon className="w-5 h-5 text-[var(--accent-primary)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-[var(--text-primary)] truncate">
                              {dataset.name}
                            </h4>
                            <Badge variant="default">{dataset.format}</Badge>
                          </div>
                          {dataset.description && (
                            <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                              {dataset.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-1 text-xs text-[var(--text-subtle)]">
                            <span>{formatNumber(dataset.rows)} rows</span>
                            <span>{dataset.columns} columns</span>
                            <span>{formatSize(dataset.size_mb)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownload(dataset)
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(dataset.id)
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-[var(--error)]" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-[var(--text-muted)]">
                  <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No datasets found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Dataset Details */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader title="Dataset Details" />
            <CardContent>
              {selectedDataset ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)]">
                      {selectedDataset.name}
                    </h3>
                    {selectedDataset.description && (
                      <p className="text-sm text-[var(--text-muted)] mt-1">
                        {selectedDataset.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    {[
                      { label: 'Format', value: selectedDataset.format.toUpperCase() },
                      { label: 'Size', value: formatSize(selectedDataset.size_mb) },
                      { label: 'Rows', value: formatNumber(selectedDataset.rows) },
                      { label: 'Columns', value: String(selectedDataset.columns) },
                      { label: 'Created', value: formatDate(selectedDataset.created_at) },
                    ].map((item) => (
                      <div key={item.label} className="flex justify-between py-2 border-b border-[var(--border-secondary)] last:border-0">
                        <span className="text-xs text-[var(--text-muted)]">{item.label}</span>
                        <span className="text-xs font-mono text-[var(--text-secondary)]">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {selectedDataset.schema && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                        Schema Preview
                      </h4>
                      <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-md)] p-3 font-mono text-xs">
                        {Object.entries(selectedDataset.schema).slice(0, 5).map(([key, value]) => (
                          <div key={key} className="flex justify-between py-1">
                            <span className="text-[var(--accent-primary)]">{key}</span>
                            <span className="text-[var(--text-muted)]">{value}</span>
                          </div>
                        ))}
                        {Object.keys(selectedDataset.schema).length > 5 && (
                          <div className="text-[var(--text-subtle)] pt-1">
                            +{Object.keys(selectedDataset.schema).length - 5} more columns
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button size="sm" onClick={() => addToast('Opening preview...', 'info')}>
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => selectedDataset && handleDownload(selectedDataset)}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-[var(--text-muted)]">
                  Select a dataset to view details
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}

