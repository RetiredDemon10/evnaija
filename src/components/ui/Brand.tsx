import { motion, useInView, useMotionValue, useSpring } from 'framer-motion'
import { Star } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn, initials } from '@/lib/utils'

/** The EV Naija bolt mark — the core brand symbol, also used as the favicon. */
export function BoltMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="16" fill="#071B22" />
      <path d="M35 7 17 36h13l-3 21 20-31H34l1-19Z" fill="#C6F36A" />
    </svg>
  )
}

export function Logo({
  variant = 'dark',
  className,
  compact: _compact,
}: {
  variant?: 'dark' | 'light'
  className?: string
  compact?: boolean
}) {
  const [failed, setFailed] = useState(false)

  return (
    <Link to="/" className={cn('group inline-flex items-center', className)} aria-label="EV Naija home">
      {failed ? (
        <span className="inline-flex items-center gap-2">
          <BoltMark className="h-9 w-9 transition-transform duration-300 group-hover:scale-[1.03]" />
          <span
            className={cn(
              'font-display text-[20px] font-semibold leading-none tracking-[-0.035em]',
              variant === 'light' ? 'text-white' : 'text-midnight-900',
            )}
          >
            EV <span className={variant === 'light' ? 'text-lime' : 'text-lime-500'}>Naija</span>
          </span>
        </span>
      ) : (
        <img
          src="/ev-naija-logo.png"
          alt="EV Naija"
          width={480}
          height={159}
          className="h-10 w-auto max-w-[180px] object-contain transition-transform duration-300 group-hover:scale-[1.03]"
          loading="eager"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </Link>
  )
}

export function StarRating({
  value,
  size = 14,
  interactive,
  onChange,
  showValue,
  className,
}: {
  value: number
  size?: number
  interactive?: boolean
  onChange?: (value: number) => void
  showValue?: boolean
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="flex items-center gap-0.5" role={interactive ? 'radiogroup' : 'img'} aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(star)}
            className={cn(interactive && 'cursor-pointer transition hover:scale-110', !interactive && 'pointer-events-none')}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
          >
            <Star
              width={size}
              height={size}
              className={star <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-charcoal-100 text-charcoal-200'}
            />
          </button>
        ))}
      </span>
      {showValue && <span className="font-mono text-xs font-medium text-charcoal-700">{value.toFixed(1)}</span>}
    </span>
  )
}

export function Avatar({
  name,
  src,
  size = 36,
  className,
}: {
  name: string
  src?: string | null
  size?: number
  className?: string
}) {
  return src ? (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className={cn('shrink-0 rounded-full object-cover', className)}
      style={{ width: size, height: size }}
      loading="lazy"
    />
  ) : (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-midnight-900 font-display text-xs font-semibold text-lime',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </span>
  )
}

export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  once = true,
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
  once?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function Counter({
  to,
  prefix = '',
  suffix = '',
  className,
  decimals = 0,
}: {
  to: number
  prefix?: string
  suffix?: string
  className?: string
  decimals?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { duration: 1400, bounce: 0 })

  useEffect(() => {
    if (inView) motionValue.set(to)
  }, [inView, motionValue, to])

  useEffect(() => {
    return spring.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = `${prefix}${latest.toLocaleString('en-NG', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}${suffix}`
      }
    })
  }, [spring, prefix, suffix, decimals])

  return <span ref={ref} className={className}>{prefix}0{suffix}</span>
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  light,
  className,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  align?: 'left' | 'center'
  light?: boolean
  className?: string
  action?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 md:flex-row md:items-end md:justify-between',
        align === 'center' && 'items-center text-center md:flex-col md:items-center',
        className,
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
        {eyebrow && (
          <span className={cn('eyebrow', light ? 'text-lime' : 'text-lime-700')}>
            <span className={cn('h-1.5 w-1.5 rounded-full', light ? 'bg-lime' : 'bg-lime-600')} />
            {eyebrow}
          </span>
        )}
        <h2
          className={cn(
            'mt-3 font-display text-3xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-4xl lg:text-[2.85rem]',
            light ? 'text-white' : 'text-midnight-900',
          )}
        >
          {title}
        </h2>
        {description && (
          <p className={cn('mt-4 text-[15px] leading-relaxed', light ? 'text-white/55' : 'text-charcoal-500')}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-midnight-900/[0.07]', className)} />
}
