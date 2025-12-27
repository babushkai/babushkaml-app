import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { supabase, validateLicense, getMachineId } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

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

    // Listen for OAuth callback from local server
    let unlistenOAuth: (() => void) | undefined
    
    const setupOAuthListener = async () => {
      try {
        // Listen for OAuth callback events from the Rust backend
        unlistenOAuth = await listen<{ 
          access_token?: string; 
          refresh_token?: string;
          code?: string; 
          error?: string 
        }>('oauth-callback', async (event) => {
          console.log('[Auth] OAuth callback received:', event.payload)
          
          if (event.payload.error) {
            console.error('[Auth] OAuth error:', event.payload.error)
            return
          }
          
          // Handle tokens directly (from landing page)
          if (event.payload.access_token && event.payload.refresh_token) {
            console.log('[Auth] Setting session from tokens...')
            try {
              const { data, error } = await supabase.auth.setSession({
                access_token: event.payload.access_token,
                refresh_token: event.payload.refresh_token,
              })
              
              if (error) {
                console.error('[Auth] Failed to set session:', error)
                return
              }
              
              if (data.session) {
                console.log('[Auth] Session set successfully!')
                const { profile, license } = await fetchProfileAndLicense(data.session.user)
                setState({
                  user: data.session.user,
                  profile,
                  session: data.session,
                  license,
                  isAuthenticated: true,
                  isLoading: false,
                })
              }
            } catch (err) {
              console.error('[Auth] Error setting session:', err)
            }
            return
          }
          
          // Handle code exchange (fallback)
          if (event.payload.code) {
            console.log('[Auth] Exchanging code for session...')
            try {
              const { data, error } = await supabase.auth.exchangeCodeForSession(event.payload.code)
              
              if (error) {
                console.error('[Auth] Failed to exchange code:', error)
                return
              }
              
              if (data.session) {
                console.log('[Auth] Session obtained successfully!')
                const { profile, license } = await fetchProfileAndLicense(data.session.user)
                setState({
                  user: data.session.user,
                  profile,
                  session: data.session,
                  license,
                  isAuthenticated: true,
                  isLoading: false,
                })
              }
            } catch (err) {
              console.error('[Auth] Error exchanging code:', err)
            }
          }
        })
        console.log('[Auth] OAuth listener setup complete')
      } catch (err) {
        console.error('[Auth] Failed to setup OAuth listener:', err)
      }
    }
    
    setupOAuthListener()

    return () => {
      subscription.unsubscribe()
      if (unlistenOAuth) {
        unlistenOAuth()
      }
    }
  }, [fetchProfileAndLicense])

  // Refresh license periodically (every hour)
  useEffect(() => {
    if (!state.isAuthenticated) return
    const interval = setInterval(refreshLicense, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [state.isAuthenticated, refreshLicense])

  // For desktop apps, OAuth opens browser with redirect back to the app via deep link
  // Flow: App → Browser (OAuth) → Landing page callback → Deep link back to app
  
  // Start local OAuth server and get callback URL
  const startLocalOAuthServer = async (): Promise<string> => {
    try {
      const result = await invoke<{ port: number; callback_url: string }>('start_oauth_server')
      console.log('[Auth] Local OAuth server started:', result)
      return result.callback_url
    } catch (err) {
      console.error('[Auth] Failed to start OAuth server:', err)
      throw err
    }
  }

  const signInWithGoogle = async () => {
    try {
      // Start local server to receive tokens
      const callbackUrl = await startLocalOAuthServer()
      console.log('[Auth] Local server ready at:', callbackUrl)
      
      // Get OAuth URL from Supabase - redirect directly to localhost
      // The localhost server will extract tokens from hash fragment via JS
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          skipBrowserRedirect: true,
          redirectTo: callbackUrl,
        },
      })
      
      if (error) throw error
      if (!data.url) throw new Error('No OAuth URL returned')
      
      // Open the OAuth URL in the system browser
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(data.url)
      
      console.log('[Auth] Opened Google OAuth in browser')
    } catch (err) {
      console.error('[Auth] Google OAuth error:', err)
      throw err
    }
  }

  const signInWithGitHub = async () => {
    try {
      // Start local server to receive tokens
      const callbackUrl = await startLocalOAuthServer()
      console.log('[Auth] Local server ready at:', callbackUrl)
      
      // Get OAuth URL from Supabase - redirect directly to localhost
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          skipBrowserRedirect: true,
          redirectTo: callbackUrl,
        },
      })
      
      if (error) throw error
      if (!data.url) throw new Error('No OAuth URL returned')
      
      // Open the OAuth URL in the system browser
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(data.url)
      
      console.log('[Auth] Opened GitHub OAuth in browser')
    } catch (err) {
      console.error('[Auth] GitHub OAuth error:', err)
      throw err
    }
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
