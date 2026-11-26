import { useState } from 'react'
import { cn } from '@/lib/utils'

export function SmartImage({
  src,
  alt,
  className,
  imgClassName,
  fallback,
}: {
  src?: string | null
  alt: string
  className?: string
  imgClassName?: string
  fallback?: string
}) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const source = error ? fallback : src
  return (
    <div className={cn('relative overflow-hidden bg-midnight-800', className)}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-midnight-800 to-midnight-900" />}
      {source ? (
        <img
          src={source}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setError(true)
            setLoaded(true)
          }}
          className={cn(
            'h-full w-full object-cover transition-all duration-700',
            loaded ? 'scale-100 opacity-100' : 'scale-105 opacity-0',
            imgClassName,
          )}
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-midnight-800 to-midnight-900">
          <svg viewBox="0 0 24 24" className="h-10 w-10 text-lime/30" fill="currentColor" aria-hidden>
            <path d="M13.5 2 5 13h5.5L9.8 22 19 10h-6l.5-8Z" />
          </svg>
        </div>
      )}
    </div>
  )
}
