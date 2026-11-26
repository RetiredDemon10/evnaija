import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

type ToastTone = 'success' | 'error' | 'info'
interface ToastItem {
  id: string
  title: string
  description?: string
  tone: ToastTone
}

interface ToastContextValue {
  toast: (input: { title: string; description?: string; tone?: ToastTone }) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    ({ title, description, tone = 'info' }: { title: string; description?: string; tone?: ToastTone }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      setItems((current) => [...current.slice(-3), { id, title, description, tone }])
      window.setTimeout(() => remove(id), 5000)
    },
    [remove],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast({ title, description, tone: 'success' }),
      error: (title, description) => toast({ title, description, tone: 'error' }),
      info: (title, description) => toast({ title, description, tone: 'info' }),
    }),
    [toast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[200] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-6 sm:top-6 sm:items-end">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-float backdrop-blur-xl',
                item.tone === 'success' && 'border-lime/30 bg-midnight-900/95 text-white',
                item.tone === 'error' && 'border-red-400/30 bg-midnight-900/95 text-white',
                item.tone === 'info' && 'border-white/10 bg-midnight-900/95 text-white',
              )}
              role="status"
            >
              <span
                className={cn(
                  'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full',
                  item.tone === 'success' && 'bg-lime text-midnight-900',
                  item.tone === 'error' && 'bg-red-500 text-white',
                  item.tone === 'info' && 'bg-white/10 text-lime',
                )}
              >
                {item.tone === 'success' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : item.tone === 'error' ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <Info className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 text-xs leading-relaxed text-white/60">{item.description}</p>
                )}
              </div>
              <button
                onClick={() => remove(item.id)}
                className="text-white/40 transition hover:text-white"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-charcoal-100', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-3xl border border-dashed border-midnight-900/10 bg-white/60 px-6 py-14 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-mint text-midnight-700">
          {icon}
        </div>
      )}
      <h3 className="font-display text-lg font-semibold text-midnight-900">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
      <h3 className="mt-3 font-display text-lg font-semibold text-red-800">{title}</h3>
      <p className="mt-1 text-sm text-red-600">{description ?? 'Please try again in a moment.'}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm"
        >
          Try again
        </button>
      )}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-5 w-5 animate-spin rounded-full border-2 border-midnight-900/20 border-t-midnight-900',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  )
}

export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-midnight-900">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-lime/30 border-t-lime" />
      </div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">{label}</p>
    </div>
  )
}
