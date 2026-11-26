import { motion } from 'framer-motion'
import { ArrowLeft, Check, ShieldCheck, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Logo } from '@/components/ui/Brand'
import { SmartImage } from '@/components/common/SmartImage'
import { IMAGES } from '@/lib/images'

export function AuthLayout({
  children,
  title,
  subtitle,
  image = IMAGES.teslaCharging,
  mode = 'customer',
}: {
  children: ReactNode
  title: string
  subtitle: string
  image?: string
  mode?: 'customer' | 'operator'
}) {
  const points =
    mode === 'operator'
      ? [
          'List unlimited charging equipment',
          'Receive paid bookings from verified drivers',
          'Real-time revenue and settlement ledger',
          'Dedicated operator support',
        ]
      : [
          'Book verified chargers across 3 cities',
          'Secure Paystack payments and receipts',
          'Manage vehicles, reviews and favourites',
          'Live booking and availability updates',
        ]

  return (
    <div className="min-h-screen bg-mint-50 lg:grid lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-midnight-950 lg:flex lg:flex-col lg:justify-between lg:p-10">
        <SmartImage src={image} alt="Electric vehicle charging" className="absolute inset-0 h-full" imgClassName="object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-b from-midnight-950/70 via-midnight-950/60 to-midnight-950" />
        <div className="pointer-events-none absolute inset-0 dotted-grid opacity-[0.07]" />
        <div className="relative">
          <Logo variant="light" />
        </div>
        <div className="relative max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 backdrop-blur">
            <Zap className="h-3 w-3 text-lime" />
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/60">
              {mode === 'operator' ? 'Charging partner programme' : 'Nigeria’s EV charging network'}
            </span>
          </div>
          <h2 className="mt-5 font-display text-[34px] font-semibold leading-[1.06] tracking-[-0.035em] text-white">
            {mode === 'operator'
              ? 'Build the charging business Nigeria needs.'
              : 'Every journey starts with a reliable charge.'}
          </h2>
          <ul className="mt-6 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-center gap-2.5 text-sm text-white/60">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-lime/15 text-lime">
                  <Check className="h-3 w-3" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative flex items-center justify-between border-t border-white/10 pt-5 text-[10px] text-white/30">
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-lime/70" /> PCI-DSS compliant payments via Paystack</span>
          <span>Lagos · Abuja · Port Harcourt</span>
        </div>
      </div>

      <div className="relative flex min-h-screen flex-col bg-white">
        <div className="flex items-center justify-between px-6 py-5 sm:px-10">
          <div className="lg:hidden">
            <Logo />
          </div>
          <Link
            to="/"
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-midnight-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to site
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-12 pt-4 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="w-full max-w-[420px]"
          >
            <h1 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.035em] text-midnight-900">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>
            <div className="mt-7">{children}</div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
