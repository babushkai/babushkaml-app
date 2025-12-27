/**
 * BabushkaML Logo Component
 * Replace the logo.png with your custom logo
 */

import { useState, useEffect } from 'react'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  variant?: 'icon' | 'full'
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
}

export function Logo({ className = '', size = 'md', showText = false, variant = 'icon' }: LogoProps) {
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const imgSrc = e.currentTarget.src
    console.error('Logo image failed to load:', imgSrc)
    console.error('Full URL:', window.location.origin + '/babushkaml5.png')
    setImgError(true)
  }
  
  const handleImageLoad = () => {
    console.log('Logo image loaded successfully')
    setImgLoaded(true)
  }
  
  // Log when component mounts to debug
  useEffect(() => {
    console.log('Logo component mounted, attempting to load:', '/babushkaml5.png')
  }, [])

  // Fallback to gradient icon if logo image not found
  const fallbackIcon = (
    <div className={`${sizeClasses[size]} rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center ${className}`}>
      <svg
        className={`${size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-8 h-8'} text-white`}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Simple Babushka (matryoshka doll) icon */}
        <path
          d="M12 2C8.13 2 5 5.13 5 9C5 11.38 6.19 13.47 8 14.74V21C8 21.55 8.45 22 9 22H15C15.55 22 16 21.55 16 21V14.74C17.81 13.47 19 11.38 19 9C19 5.13 15.87 2 12 2ZM12 4C14.76 4 17 6.24 17 9C17 10.88 15.79 12.5 14 13.24V20H10V13.24C8.21 12.5 7 10.88 7 9C7 6.24 9.24 4 12 4ZM12 6C10.9 6 10 6.9 10 8C10 9.1 10.9 10 12 10C13.1 10 14 9.1 14 8C14 6.9 13.1 6 12 6Z"
          fill="currentColor"
        />
      </svg>
    </div>
  )

  // Try to load custom logo, fallback to icon if not found
  if (imgError) {
    return fallbackIcon
  }

  // Icon variant - just show the logo image
  // Logo is portrait (1696x2528), aspect ratio ~0.67:1 (width:height), so it's taller than wide
  if (variant === 'icon') {
    const width = size === 'sm' ? '24px' : size === 'md' ? '32px' : size === 'lg' ? '48px' : '64px'
    // Aspect ratio is ~0.67:1 (width:height), so height = width / 0.67 ≈ width * 1.49
    const height = size === 'sm' ? '36px' : size === 'md' ? '48px' : size === 'lg' ? '72px' : '96px'
    
    return (
      <div className={`${className} flex items-center justify-center`} style={{ background: 'transparent' }}>
        <img
          src="/babushkaml5.png"
          alt="BabushkaML Logo"
          className="object-contain"
          style={{ 
            width: width,
            height: height,
            maxWidth: '100%',
            maxHeight: '100%',
            display: imgError ? 'none' : 'block',
            background: 'transparent'
          }}
          onError={handleImageError}
          onLoad={handleImageLoad}
          loading="lazy"
        />
        {!imgLoaded && !imgError && (
          <div className={`${sizeClasses[size]} flex items-center justify-center animate-pulse bg-[var(--bg-tertiary)] rounded`}>
            <div className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    )
  }

  // Full variant - logo with optional text
  // Logo is portrait (1696x2528), aspect ratio ~0.67:1 (width:height)
  const width = size === 'sm' ? '24px' : size === 'md' ? '32px' : size === 'lg' ? '48px' : '64px'
  const height = size === 'sm' ? '36px' : size === 'md' ? '48px' : size === 'lg' ? '72px' : '96px'
  
  return (
    <div className={`flex items-center gap-3 ${className}`} style={{ background: 'transparent' }}>
      <img
        src="/babushkaml5.png"
        alt="BabushkaML Logo"
        className="object-contain"
        style={{ 
          width: width,
          height: height,
          maxWidth: '100%',
          maxHeight: '100%',
          display: imgError ? 'none' : 'block',
          background: 'transparent'
        }}
        onError={handleImageError}
        onLoad={handleImageLoad}
        loading="lazy"
      />
      {!imgLoaded && !imgError && (
        <div className={`${sizeClasses[size]} flex items-center justify-center animate-pulse bg-[var(--bg-tertiary)] rounded`}>
          <div className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {showText && (
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">BabushkaML</h1>
          <p className="text-xs text-[var(--text-muted)]">ML Made Simple</p>
        </div>
      )}
    </div>
  )
}

