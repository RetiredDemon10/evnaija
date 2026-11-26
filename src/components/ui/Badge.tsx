import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'lime' | 'dark' | 'info'

const tones: Record<Tone, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-600 border-red-200',
  neutral: 'bg-charcoal-50 text-charcoal-600 border-charcoal-200',
  lime: 'bg-lime/25 text-midnight-800 border-lime-400/60',
  dark: 'bg-midnight-900 text-lime border-midnight-700',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none tracking-wide',
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export function Dot({ tone = 'success' }: { tone?: Tone }) {
  const colors: Record<Tone, string> = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    neutral: 'bg-charcoal-300',
    lime: 'bg-lime-500',
    dark: 'bg-lime',
    info: 'bg-sky-500',
  }
  return (
    <span className="relative flex h-2 w-2">
      <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-50', colors[tone])} />
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', colors[tone])} />
    </span>
  )
}
