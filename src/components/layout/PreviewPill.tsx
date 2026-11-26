import { AnimatePresence, motion } from 'framer-motion'
import { FlaskConical, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

export function PreviewPill() {
  const { isPreview, user, enterPreview, exitPreview } = useAuth()
  const [open, setOpen] = useState(false)
  if (!isPreview) return null

  const roles = [
    { label: 'Public site', value: null },
    { label: 'Customer', value: 'customer' as const },
    { label: 'Operator', value: 'operator' as const },
    { label: 'Administrator', value: 'admin' as const },
  ]

  return (
    <div className="fixed bottom-4 left-4 z-[80] print:hidden">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            className="mb-2 w-[290px] overflow-hidden rounded-2xl border border-white/10 bg-midnight-900 p-4 text-white shadow-float"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-sm font-semibold">Preview mode</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                  You are exploring the product with sample data. Connect Supabase + Paystack to go live.
                </p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close preview panel" className="text-white/40 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3.5 space-y-1">
              {roles.map((role) => (
                <button
                  key={role.label}
                  onClick={() => {
                    if (role.value) enterPreview(role.value)
                    else exitPreview()
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition',
                    (user?.roles[0] ?? null) === role.value
                      ? 'bg-lime text-midnight-900'
                      : 'text-white/65 hover:bg-white/5 hover:text-white',
                  )}
                >
                  {role.label}
                  <span className="font-mono text-[9px] uppercase tracking-widest opacity-50">View</span>
                </button>
              ))}
            </div>
            <p className="mt-3 border-t border-white/10 pt-3 text-[10px] leading-relaxed text-white/30">
              Payments and writes that require the backend are intentionally disabled in preview.
            </p>
            <Link to="/login" className="mt-2 block text-[10px] font-semibold text-lime/80 hover:text-lime">
              Use demo sign-in →
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-midnight-900/95 py-2 pl-2 pr-3.5 text-[11px] font-medium text-white/70 shadow-float backdrop-blur transition hover:text-white"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-lime/15 text-lime">
          <FlaskConical className="h-3 w-3" />
        </span>
        Preview data
        <span className="h-1.5 w-1.5 rounded-full bg-lime" />
      </button>
    </div>
  )
}
