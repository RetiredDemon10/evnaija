import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-midnight-950/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className={cn(
              'relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-4xl bg-white p-6 shadow-float sm:rounded-3xl sm:p-7',
              size === 'sm' && 'sm:max-w-md',
              size === 'md' && 'sm:max-w-xl',
              size === 'lg' && 'sm:max-w-3xl',
            )}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-midnight-900">{title}</h2>
                {description && <p className="mt-1 text-sm text-muted">{description}</p>}
              </div>
              <button
                onClick={onClose}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-charcoal-50 text-charcoal-600 transition hover:bg-charcoal-100"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
            {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  danger,
  loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            className="h-11 rounded-xl border border-midnight-900/10 px-5 text-sm font-semibold text-charcoal-700 hover:bg-charcoal-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'h-11 rounded-xl px-5 text-sm font-semibold text-white transition disabled:opacity-50',
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-midnight-900 hover:bg-midnight-800',
            )}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="rounded-2xl bg-charcoal-50 p-4 text-sm text-charcoal-600">
        This action will be recorded in the platform audit trail where applicable.
      </div>
    </Modal>
  )
}
