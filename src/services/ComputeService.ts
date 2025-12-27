/**
 * Hybrid Compute Service
 * 
 * Provides seamless switching between local (on-device) and cloud computation.
 * - Local: Uses Core ML / ONNX Runtime for inference
 * - Cloud: Uses backend API for heavy computation
 */

import { Capacitor } from '@capacitor/core'

export type ComputeMode = 'local' | 'cloud' | 'auto'

export interface InferenceResult {
  predictions: number[]
  probabilities: number[][]
  latency_ms: number
  compute_mode: ComputeMode
  model_name: string
}

export interface ComputeConfig {
  mode: ComputeMode
  cloudUrl: string
  localModelPath?: string
  maxLocalModelSize: number // MB
  preferLocalWhenOffline: boolean
}

const DEFAULT_CONFIG: ComputeConfig = {
  mode: 'auto',
  cloudUrl: import.meta.env.VITE_API_URL || 'http://localhost:8080',
  maxLocalModelSize: 50, // 50MB max for local models
  preferLocalWhenOffline: true,
}

class ComputeServiceClass {
  private config: ComputeConfig = DEFAULT_CONFIG
  private isNative: boolean = Capacitor.isNativePlatform()
  private localModels: Map<string, boolean> = new Map()
  private isOnline: boolean = navigator.onLine

  constructor() {
    // Monitor online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true
      console.log('[ComputeService] Online')
    })
    window.addEventListener('offline', () => {
      this.isOnline = false
      console.log('[ComputeService] Offline')
    })
  }

  /**
   * Configure the compute service
   */
  configure(config: Partial<ComputeConfig>) {
    this.config = { ...this.config, ...config }
    this.saveConfig()
  }

  /**
   * Get current configuration
   */
  getConfig(): ComputeConfig {
    return { ...this.config }
  }

  /**
   * Check if we should use local compute
   */
  private shouldUseLocal(modelId: string): boolean {
    if (this.config.mode === 'cloud') return false
    if (this.config.mode === 'local') return true

    // Auto mode: prefer local when offline or if model is cached
    if (!this.isOnline && this.config.preferLocalWhenOffline) {
      return this.hasLocalModel(modelId)
    }

    // Use local if model is cached and small enough
    return this.hasLocalModel(modelId)
  }

  /**
   * Check if model is available locally
   */
  hasLocalModel(modelId: string): boolean {
    return this.localModels.has(modelId)
  }

  /**
   * Download model for local inference
   */
  async downloadModel(modelId: string, modelName: string): Promise<boolean> {
    if (!this.isNative) {
      console.warn('[ComputeService] Local models only supported on native platforms')
      return false
    }

    try {
      // Fetch model metadata
      const response = await fetch(`${this.config.cloudUrl}/api/models/${modelId}/download`)
      if (!response.ok) throw new Error('Failed to fetch model')

      const blob = await response.blob()
      const sizeMB = blob.size / (1024 * 1024)

      if (sizeMB > this.config.maxLocalModelSize) {
        console.warn(`[ComputeService] Model too large for local storage: ${sizeMB.toFixed(2)}MB`)
        return false
      }

      // In a real implementation, you would:
      // 1. Convert to Core ML format if needed
      // 2. Save to device storage using Capacitor Filesystem
      // 3. Register with Core ML / ONNX Runtime

      // For now, mark as available
      this.localModels.set(modelId, true)
      this.saveLocalModels()

      console.log(`[ComputeService] Downloaded model: ${modelName} (${sizeMB.toFixed(2)}MB)`)
      return true
    } catch (error) {
      console.error('[ComputeService] Failed to download model:', error)
      return false
    }
  }

  /**
   * Remove local model
   */
  async removeLocalModel(modelId: string): Promise<boolean> {
    this.localModels.delete(modelId)
    this.saveLocalModels()
    return true
  }

  /**
   * Run inference
   */
  async predict(
    modelId: string,
    input: number[][],
    options?: { forceMode?: ComputeMode }
  ): Promise<InferenceResult> {
    const useLocal = options?.forceMode === 'local' || 
      (options?.forceMode !== 'cloud' && this.shouldUseLocal(modelId))

    if (useLocal) {
      return this.predictLocal(modelId, input)
    } else {
      return this.predictCloud(modelId, input)
    }
  }

  /**
   * Run local inference using Core ML / ONNX Runtime
   */
  private async predictLocal(modelId: string, input: number[][]): Promise<InferenceResult> {
    const startTime = performance.now()

    // In a real implementation, you would:
    // 1. Load the Core ML / ONNX model
    // 2. Prepare input tensor
    // 3. Run inference
    // 4. Process output

    // Mock local inference for demo
    await new Promise(resolve => setTimeout(resolve, 50)) // Simulate inference time

    const predictions = input.map(() => Math.round(Math.random()))
    const probabilities = input.map(() => {
      const p = Math.random()
      return [1 - p, p]
    })

    return {
      predictions,
      probabilities,
      latency_ms: performance.now() - startTime,
      compute_mode: 'local',
      model_name: modelId,
    }
  }

  /**
   * Run cloud inference via API
   */
  private async predictCloud(modelId: string, input: number[][]): Promise<InferenceResult> {
    if (!this.isOnline) {
      throw new Error('No internet connection. Enable a local model for offline inference.')
    }

    const startTime = performance.now()

    const response = await fetch(`${this.config.cloudUrl}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id: modelId, input }),
    })

    if (!response.ok) {
      throw new Error(`Cloud inference failed: ${response.statusText}`)
    }

    const result = await response.json()

    return {
      predictions: result.predictions,
      probabilities: result.probabilities,
      latency_ms: performance.now() - startTime,
      compute_mode: 'cloud',
      model_name: result.model_name,
    }
  }

  /**
   * Get compute status
   */
  getStatus() {
    return {
      isNative: this.isNative,
      isOnline: this.isOnline,
      mode: this.config.mode,
      localModelsCount: this.localModels.size,
      cloudUrl: this.config.cloudUrl,
    }
  }

  /**
   * Save config to localStorage
   */
  private saveConfig() {
    localStorage.setItem('mlops-compute-config', JSON.stringify(this.config))
  }

  /**
   * Save local models list
   */
  private saveLocalModels() {
    localStorage.setItem('mlops-local-models', JSON.stringify([...this.localModels.keys()]))
  }

  /**
   * Load saved state
   */
  loadSavedState() {
    try {
      const configStr = localStorage.getItem('mlops-compute-config')
      if (configStr) {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(configStr) }
      }

      const modelsStr = localStorage.getItem('mlops-local-models')
      if (modelsStr) {
        const modelIds = JSON.parse(modelsStr) as string[]
        modelIds.forEach(id => this.localModels.set(id, true))
      }
    } catch (error) {
      console.warn('[ComputeService] Failed to load saved state:', error)
    }
  }
}

// Singleton instance
export const ComputeService = new ComputeServiceClass()
ComputeService.loadSavedState()

