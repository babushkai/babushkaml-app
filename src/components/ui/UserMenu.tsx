import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  Shield,
  Bell,
  HelpCircle,
  Crown,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

interface UserMenuProps {
  onNavigate: (page: 'settings') => void
}

export function UserMenu({ onNavigate }: UserMenuProps) {
  const { user, profile, license, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  if (!user) return null

  const displayName = profile?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'User'
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url
  const userEmail = user.email || ''
  const tier = license?.tier || profile?.tier || 'personal'

  const menuItems = [
    {
      icon: User,
      label: 'Profile',
      onClick: () => {
        onNavigate('settings')
        setIsOpen(false)
      },
    },
    {
      icon: Settings,
      label: 'Settings',
      onClick: () => {
        onNavigate('settings')
        setIsOpen(false)
      },
    },
    {
      icon: Bell,
      label: 'Notifications',
      onClick: () => {
        onNavigate('settings')
        setIsOpen(false)
      },
    },
    {
      icon: HelpCircle,
      label: 'Help & Support',
      onClick: () => {
        window.open('https://babushkaml.com/docs', '_blank')
      },
    },
  ]

  const tierColors = {
    personal: 'bg-[var(--text-muted)]/10 text-[var(--text-muted)]',
    pro: 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]',
    team: 'bg-amber-500/10 text-amber-500',
  }

  const tierIcons = {
    personal: Shield,
    pro: Sparkles,
    team: Crown,
  }

  const TierIcon = tierIcons[tier]

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-xl',
          'bg-[var(--bg-secondary)] border border-[var(--border-primary)]',
          'hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-accent)]',
          'transition-all duration-200',
          isOpen && 'bg-[var(--bg-tertiary)] border-[var(--border-accent)]'
        )}
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-lg overflow-hidden bg-[var(--bg-tertiary)]">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
              <User className="w-4 h-4" />
            </div>
          )}
        </div>
        
        {/* Name (hidden on mobile) */}
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium text-[var(--text-primary)] leading-tight">
            {displayName}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] leading-tight">
            {userEmail}
          </p>
        </div>
        
        <ChevronDown className={cn(
          'w-4 h-4 text-[var(--text-muted)] transition-transform duration-200',
          isOpen && 'rotate-180'
        )} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute right-0 top-full mt-2 w-72',
              'bg-[var(--bg-secondary)] border border-[var(--border-primary)]',
              'rounded-xl shadow-xl overflow-hidden z-50'
            )}
          >
            {/* User Info */}
            <div className="p-4 border-b border-[var(--border-secondary)]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-[var(--bg-tertiary)]">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                      <User className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[var(--text-primary)] truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    {userEmail}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize',
                      tierColors[tier]
                    )}>
                      <TierIcon className="w-3 h-3" />
                      {tier}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-2">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
                    'text-sm text-[var(--text-secondary)]',
                    'hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]',
                    'transition-colors'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Upgrade CTA (for personal tier) */}
            {tier === 'personal' && (
              <div className="p-2 border-t border-[var(--border-secondary)]">
                <a
                  href="https://babushkaml.com/#pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg',
                    'text-sm font-medium text-white',
                    'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)]',
                    'hover:brightness-110 transition-all'
                  )}
                >
                  <Sparkles className="w-4 h-4" />
                  Upgrade to Pro
                </a>
              </div>
            )}

            {/* Logout */}
            <div className="p-2 border-t border-[var(--border-secondary)]">
              <button
                onClick={() => {
                  logout()
                  setIsOpen(false)
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
                  'text-sm text-[var(--error)]',
                  'hover:bg-[var(--error)]/10',
                  'transition-colors'
                )}
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
