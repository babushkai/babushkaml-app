import { createClient } from '@supabase/supabase-js'

// Database types matching the landing page schema
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          name: string | null
          avatar_url: string | null
          tier: 'personal' | 'pro' | 'team'
          created_at: string
          updated_at: string
        }
      }
      licenses: {
        Row: {
          id: string
          user_id: string
          key: string
          tier: 'pro' | 'team'
          status: 'active' | 'expired' | 'revoked'
          expires_at: string | null
          created_at: string
          machine_ids: string[]
          max_machines: number
        }
      }
    }
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// API URL for license validation (your landing page)
export const API_URL = import.meta.env.VITE_API_URL || 'https://babushkaml.com'

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Validate license with the landing page API
export async function validateLicense(userId: string, machineId?: string) {
  try {
    const response = await fetch(`${API_URL}/api/license/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, machineId }),
    })
    return await response.json()
  } catch (error) {
    console.error('License validation failed:', error)
    return { valid: false, tier: 'personal', features: null }
  }
}

// Get unique machine ID (for device tracking)
export async function getMachineId(): Promise<string> {
  // Try to get from Tauri if available
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const machineId = await invoke('get_machine_id')
      return machineId as string
    } catch {
      // Fall back to browser fingerprint
    }
  }
  
  // Browser fallback - generate and persist a unique ID
  let machineId = localStorage.getItem('babushkaml_machine_id')
  if (!machineId) {
    machineId = crypto.randomUUID()
    localStorage.setItem('babushkaml_machine_id', machineId)
  }
  return machineId
}

