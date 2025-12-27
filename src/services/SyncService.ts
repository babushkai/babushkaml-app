/**
 * Sync Service
 * 
 * Handles data synchronization between local storage and cloud.
 * - Offline-first: Works without internet
 * - Background sync: Syncs when connection is restored
 * - Conflict resolution: Last-write-wins with timestamps
 */

export interface SyncItem {
  id: string
  type: 'model' | 'dataset' | 'experiment' | 'prediction'
  data: Record<string, unknown>
  localUpdatedAt: string
  cloudUpdatedAt?: string
  syncStatus: 'pending' | 'synced' | 'conflict' | 'error'
}

export interface SyncStatus {
  lastSyncAt: string | null
  pendingCount: number
  isOnline: boolean
  isSyncing: boolean
}

class SyncServiceClass {
  private isOnline: boolean = navigator.onLine
  private isSyncing: boolean = false
  private lastSyncAt: string | null = null
  private pendingItems: Map<string, SyncItem> = new Map()
  private syncListeners: Set<(status: SyncStatus) => void> = new Set()
  private cloudUrl: string = import.meta.env.VITE_API_URL || 'http://localhost:8080'

  constructor() {
    // Monitor connectivity
    window.addEventListener('online', () => {
      this.isOnline = true
      this.notifyListeners()
      this.syncAll() // Auto-sync when back online
    })
    window.addEventListener('offline', () => {
      this.isOnline = false
      this.notifyListeners()
    })

    // Load pending items from storage
    this.loadPendingItems()
  }

  /**
   * Add listener for sync status changes
   */
  addListener(callback: (status: SyncStatus) => void): () => void {
    this.syncListeners.add(callback)
    return () => this.syncListeners.delete(callback)
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return {
      lastSyncAt: this.lastSyncAt,
      pendingCount: this.pendingItems.size,
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
    }
  }

  /**
   * Queue item for sync
   */
  async queueSync(item: Omit<SyncItem, 'syncStatus'>): Promise<void> {
    const syncItem: SyncItem = {
      ...item,
      syncStatus: 'pending',
    }

    this.pendingItems.set(item.id, syncItem)
    this.savePendingItems()
    this.notifyListeners()

    // Try immediate sync if online
    if (this.isOnline) {
      await this.syncItem(syncItem)
    }
  }

  /**
   * Sync a single item
   */
  private async syncItem(item: SyncItem): Promise<boolean> {
    try {
      const endpoint = this.getEndpoint(item.type)
      const response = await fetch(`${this.cloudUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          data: item.data,
          localUpdatedAt: item.localUpdatedAt,
        }),
      })

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`)
      }

      const result = await response.json()

      // Check for conflicts
      if (result.conflict) {
        item.syncStatus = 'conflict'
        item.cloudUpdatedAt = result.cloudUpdatedAt
      } else {
        // Success - remove from pending
        this.pendingItems.delete(item.id)
      }

      this.savePendingItems()
      this.notifyListeners()
      return true
    } catch (error) {
      console.error(`[SyncService] Failed to sync ${item.id}:`, error)
      item.syncStatus = 'error'
      this.savePendingItems()
      this.notifyListeners()
      return false
    }
  }

  /**
   * Sync all pending items
   */
  async syncAll(): Promise<{ success: number; failed: number }> {
    if (!this.isOnline || this.isSyncing) {
      return { success: 0, failed: 0 }
    }

    this.isSyncing = true
    this.notifyListeners()

    let success = 0
    let failed = 0

    for (const item of this.pendingItems.values()) {
      if (item.syncStatus === 'pending' || item.syncStatus === 'error') {
        const result = await this.syncItem(item)
        if (result) {
          success++
        } else {
          failed++
        }
      }
    }

    this.isSyncing = false
    this.lastSyncAt = new Date().toISOString()
    this.notifyListeners()

    return { success, failed }
  }

  /**
   * Pull latest data from cloud
   */
  async pullFromCloud(): Promise<void> {
    if (!this.isOnline) return

    try {
      const response = await fetch(`${this.cloudUrl}/api/state`)
      if (!response.ok) throw new Error('Failed to fetch state')

      const cloudState = await response.json()

      // Store in local storage for offline access
      localStorage.setItem('mlops-cloud-state', JSON.stringify({
        data: cloudState,
        fetchedAt: new Date().toISOString(),
      }))

      this.lastSyncAt = new Date().toISOString()
      this.notifyListeners()
    } catch (error) {
      console.error('[SyncService] Failed to pull from cloud:', error)
    }
  }

  /**
   * Get cached cloud state (for offline use)
   */
  getCachedState<T>(): T | null {
    try {
      const cached = localStorage.getItem('mlops-cloud-state')
      if (cached) {
        const { data } = JSON.parse(cached)
        return data as T
      }
    } catch (error) {
      console.warn('[SyncService] Failed to get cached state:', error)
    }
    return null
  }

  /**
   * Resolve a sync conflict
   */
  async resolveConflict(itemId: string, useLocal: boolean): Promise<void> {
    const item = this.pendingItems.get(itemId)
    if (!item || item.syncStatus !== 'conflict') return

    if (useLocal) {
      // Force push local version
      item.syncStatus = 'pending'
      await this.syncItem(item)
    } else {
      // Discard local changes
      this.pendingItems.delete(itemId)
      this.savePendingItems()
      this.notifyListeners()
    }
  }

  /**
   * Get endpoint for item type
   */
  private getEndpoint(type: SyncItem['type']): string {
    const endpoints: Record<SyncItem['type'], string> = {
      model: '/api/models/sync',
      dataset: '/api/datasets/sync',
      experiment: '/api/experiments/sync',
      prediction: '/api/predictions/sync',
    }
    return endpoints[type]
  }

  /**
   * Notify all listeners
   */
  private notifyListeners() {
    const status = this.getStatus()
    this.syncListeners.forEach(cb => cb(status))
  }

  /**
   * Save pending items to storage
   */
  private savePendingItems() {
    const items = [...this.pendingItems.values()]
    localStorage.setItem('mlops-sync-pending', JSON.stringify(items))
  }

  /**
   * Load pending items from storage
   */
  private loadPendingItems() {
    try {
      const stored = localStorage.getItem('mlops-sync-pending')
      if (stored) {
        const items = JSON.parse(stored) as SyncItem[]
        items.forEach(item => this.pendingItems.set(item.id, item))
      }

      const lastSync = localStorage.getItem('mlops-last-sync')
      if (lastSync) {
        this.lastSyncAt = lastSync
      }
    } catch (error) {
      console.warn('[SyncService] Failed to load pending items:', error)
    }
  }
}

// Singleton instance
export const SyncService = new SyncServiceClass()

