import { useState, useEffect, useCallback } from 'react'

export type Theme = 'dark' | 'light' | 'system'

const STORAGE_KEY = 'mlops-theme'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark'
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    return stored || 'dark'
  })

  const applyTheme = useCallback((t: Theme) => {
    const root = document.documentElement
    root.setAttribute('data-theme', t)
    
    // Update body background for smooth transitions
    if (t === 'light') {
      document.body.style.background = '#fafbfc'
    } else if (t === 'dark') {
      document.body.style.background = '#0a0b0f'
    } else {
      // System theme - let CSS handle it
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.body.style.background = prefersDark ? '#0a0b0f' : '#fafbfc'
    }
  }, [])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
    applyTheme(newTheme)
  }, [applyTheme])

  // Apply theme on mount and handle system preference changes
  useEffect(() => {
    applyTheme(theme)

    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, applyTheme])

  return { theme, setTheme }
}





