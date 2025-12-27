import { useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, ArrowRight, Shield, Zap, BarChart3, ExternalLink, Eye, EyeOff } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

// Provider icons as SVG components
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  )
}

const FEATURES = [
  { icon: Shield, title: 'Secure Access', description: 'Enterprise-grade authentication' },
  { icon: Zap, title: 'Fast Deployment', description: 'Deploy models in seconds' },
  { icon: BarChart3, title: 'Real-time Monitoring', description: 'Track performance metrics' },
]

export function Login() {
  const { signInWithGoogle, signInWithGitHub, signInWithEmail, signUpWithEmail, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [browserAuthMessage, setBrowserAuthMessage] = useState(false)

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setLoadingProvider(provider)
    setError(null)
    try {
      if (provider === 'google') {
        await signInWithGoogle()
      } else {
        await signInWithGitHub()
      }
      // Show message that browser opened
      setBrowserAuthMessage(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open browser')
    } finally {
      setLoadingProvider(null)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoadingProvider('email')
    setError(null)
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password)
      } else {
        await signInWithEmail(email, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to authenticate')
    } finally {
      setLoadingProvider(null)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[var(--bg-secondary)] via-[var(--bg-tertiary)] to-[var(--bg-secondary)] p-12 flex-col justify-between relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-20 w-72 h-72 bg-[var(--accent-primary)]/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[var(--accent-secondary)]/20 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <Logo size="lg" showText={true} variant="full" />
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-[var(--text-primary)] leading-tight">
              Manage your ML models<br />
              <span className="gradient-text">with confidence</span>
            </h2>
            <p className="mt-4 text-[var(--text-secondary)] max-w-md">
              Deploy, monitor, and scale your machine learning models with our enterprise-ready platform.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
                  <feature.icon className="w-5 h-5 text-[var(--accent-primary)]" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">{feature.title}</h3>
                  <p className="text-xs text-[var(--text-muted)]">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-xs text-[var(--text-subtle)]">
            © 2025 BabushkaML. ML Made Simple.
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <Logo size="md" variant="icon" />
            <h1 className="text-lg font-bold text-[var(--text-primary)]">BabushkaML</h1>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {isSignUp ? 'Start your ML journey today' : 'Sign in to access your ML dashboard'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-[var(--error)]/10 border border-[var(--error)]/20 rounded-xl text-sm text-[var(--error)]">
              {error}
            </div>
          )}

          {browserAuthMessage && (
            <div className="mb-4 p-4 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 rounded-xl">
              <p className="text-sm text-[var(--text-primary)] font-medium">Browser opened for login</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Complete the sign-in in your browser. Once done, your session will sync automatically.
              </p>
              <button
                onClick={() => setBrowserAuthMessage(false)}
                className="mt-2 text-xs text-[var(--accent-primary)] hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Email Login Form - Primary for Desktop */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className={cn(
                  'w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)]',
                  'rounded-xl text-sm text-[var(--text-primary)]',
                  'placeholder:text-[var(--text-subtle)]',
                  'focus:outline-none focus:border-[var(--accent-primary)]',
                  'transition-colors'
                )}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn(
                    'w-full px-4 py-3 pr-12 bg-[var(--bg-secondary)] border border-[var(--border-primary)]',
                    'rounded-xl text-sm text-[var(--text-primary)]',
                    'placeholder:text-[var(--text-subtle)]',
                    'focus:outline-none focus:border-[var(--accent-primary)]',
                    'transition-colors'
                  )}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-3',
                'bg-[var(--accent-primary)] text-white',
                'rounded-xl text-sm font-medium',
                'transition-all duration-200',
                'hover:brightness-110',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {loadingProvider === 'email' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {isSignUp ? 'Create Account' : 'Sign in'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-[var(--accent-primary)] hover:underline"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border-primary)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-[var(--bg-primary)] text-[var(--text-muted)]">
                or continue with
              </span>
            </div>
          </div>

          {/* OAuth Providers - Open in browser */}
          <div className="space-y-3">
            <button
              onClick={() => handleOAuthLogin('google')}
              disabled={isLoading}
              className={cn(
                'w-full flex items-center justify-center gap-3 px-4 py-3',
                'bg-[var(--bg-secondary)] border border-[var(--border-primary)]',
                'rounded-xl text-sm font-medium text-[var(--text-primary)]',
                'transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'hover:bg-[var(--bg-tertiary)]'
              )}
            >
              {loadingProvider === 'google' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <GoogleIcon className="w-5 h-5" />
                  Continue with Google
                  <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
                </>
              )}
            </button>

            <button
              onClick={() => handleOAuthLogin('github')}
              disabled={isLoading}
              className={cn(
                'w-full flex items-center justify-center gap-3 px-4 py-3',
                'bg-[var(--bg-secondary)] border border-[var(--border-primary)]',
                'rounded-xl text-sm font-medium text-[var(--text-primary)]',
                'transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'hover:bg-[var(--bg-tertiary)]'
              )}
            >
              {loadingProvider === 'github' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <GitHubIcon className="w-5 h-5" />
                  Continue with GitHub
                  <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
                </>
              )}
            </button>
          </div>

          <p className="mt-3 text-center text-[10px] text-[var(--text-subtle)]">
            OAuth will open in your browser
          </p>

          {/* Terms */}
          <p className="mt-6 text-center text-xs text-[var(--text-subtle)]">
            By signing in, you agree to our{' '}
            <a href="https://babushkaml.com/terms" className="text-[var(--accent-primary)] hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="https://babushkaml.com/privacy" className="text-[var(--accent-primary)] hover:underline">Privacy Policy</a>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
