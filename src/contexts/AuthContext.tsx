import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { supabase, validateLicense, getMachineId } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export interface UserProfile {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  tier: 'personal' | 'pro' | 'team'
}

export interface LicenseInfo {
  valid: boolean
  tier: 'personal' | 'pro' | 'team'
  features: {
    maxProjects: number
    maxStorage: number
    cloudDeploy: boolean
    teamCollaboration: boolean
    maxTeamMembers?: number
    prioritySupport: boolean
    advancedDashboards: boolean
    modelVersioning: boolean
    sso?: boolean
    auditLogs?: boolean
  } | null
  expiresAt?: string
  message?: string
}

interface AuthState {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  license: LicenseInfo | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextType extends AuthState {
  signInWithGoogle: () => Promise<void>
  signInWithGitHub: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>
  logout: () => Promise<void>
  refreshLicense: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

const STORAGE_KEY = 'mlops-auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    license: null,
    isAuthenticated: false,
    isLoading: true,
  })

  const fetchProfileAndLicense = useCallback(async (user: User) => {
    // Fetch profile from Supabase
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // Validate license with landing page API
    const machineId = await getMachineId()
    const license = await validateLicense(user.id, machineId)

    return {
      profile: profile as UserProfile | null,
      license: license as LicenseInfo,
    }
  }, [])

  const refreshLicense = useCallback(async () => {
    if (!state.user) return
    const machineId = await getMachineId()
    const license = await validateLicense(state.user.id, machineId)
    setState(prev => ({ ...prev, license }))
  }, [state.user])

  // Initialize auth state
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { profile, license } = await fetchProfileAndLicense(session.user)
        setState({
          user: session.user,
          profile,
          session,
          license,
          isAuthenticated: true,
          isLoading: false,
        })
      } else {
        setState(prev => ({ ...prev, isLoading: false }))
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { profile, license } = await fetchProfileAndLicense(session.user)
        setState({
          user: session.user,
          profile,
          session,
          license,
          isAuthenticated: true,
          isLoading: false,
        })
      } else if (event === 'SIGNED_OUT') {
        setState({
          user: null,
          profile: null,
          session: null,
          license: null,
          isAuthenticated: false,
          isLoading: false,
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfileAndLicense])

  // Refresh license periodically (every hour)
  useEffect(() => {
    if (!state.isAuthenticated) return
    const interval = setInterval(refreshLicense, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [state.isAuthenticated, refreshLicense])

  // For desktop apps, OAuth opens browser and we can't easily get the callback
  // Use PKCE flow which keeps tokens in the browser, then user can copy a code
  // OR open auth URL in system browser and handle deep link
  
  const signInWithGoogle = async () => {
    // For desktop app: Open OAuth in system browser
    // The callback will be handled by the landing page, which stores the session
    // Then user can use email/password or we can use a device code flow
    
    // For now, open the landing page login in browser
    const { open } = await import('@tauri-apps/plugin-shell')
    await open('https://babushkaml.com/login?from=desktop')
    
    // Show message to user that they should login in browser then return
    // The auth state will sync when they have a session
  }

  const signInWithGitHub = async () => {
    // Same approach - open landing page in browser
    const { open } = await import('@tauri-apps/plugin-shell')
    await open('https://babushkaml.com/login?from=desktop&provider=github')
  }

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    })
    if (error) throw error

    // Create profile after signup
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email: data.user.email!,
        name: name || null,
        tier: 'personal',
      } as never)
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <AuthContext.Provider value={{
      ...state,
      signInWithGoogle,
      signInWithGitHub,
      signInWithEmail,
      signUpWithEmail,
      logout,
      refreshLicense,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
