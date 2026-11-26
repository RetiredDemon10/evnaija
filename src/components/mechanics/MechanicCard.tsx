import { motion } from 'framer-motion'
import { ArrowUpRight, BadgeCheck, Clock, MapPin, Phone, Star, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Mechanic } from '@/types'
import { SmartImage } from '@/components/common/SmartImage'
import { Badge, Dot } from '@/components/ui/Badge'
import { cn, formatNaira } from '@/lib/utils'
import { serviceModeLabel, serviceTypeLabel } from '@/lib/mechanics'

export function MechanicCard({
  mechanic,
  view = 'grid',
  index = 0,
}: {
  mechanic: Mechanic
  view?: 'grid' | 'list'
  index?: number
}) {
  const specialties = mechanic.service_types.slice(0, 3)
  const rate = mechanic.hourly_rate ? `${formatNaira(mechanic.hourly_rate)}/hr` : 'Request a quote'

  if (view === 'list') {
    return (
      <motion.article
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.2) }}
        className="group flex flex-col gap-4 rounded-2xl border border-midnight-900/10 bg-white p-4 transition-shadow hover:shadow-card md:flex-row md:items-center"
      >
        <SmartImage
          src={mechanic.logo_url}
          alt={mechanic.business_name}
          className="h-16 w-16 shrink-0 rounded-xl bg-mint-100"
          imgClassName="object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/mechanics/${mechanic.id}`}
              className="font-display text-base font-semibold text-midnight-950 transition-colors hover:text-brand-700"
            >
              {mechanic.business_name}
            </Link>
            {mechanic.is_verified && (
              <Badge tone="success"><BadgeCheck className="h-3 w-3" /> Verified</Badge>
            )}
            {mechanic.emergency_available && <Badge tone="warning">24/7 callout</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{mechanic.city}, {mechanic.state}</span>
            <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{mechanic.rating_average.toFixed(1)} ({mechanic.rating_count})</span>
            <span className="inline-flex items-center gap-1"><Wrench className="h-3.5 w-3.5" />{mechanic.years_experience} yrs exp.</span>
          </div>
          <p className="mt-2 line-clamp-1 text-xs text-muted">{specialties.map(serviceTypeLabel).join(' · ')}</p>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-4 md:flex-col md:items-end">
          <span className="font-mono text-sm font-semibold text-midnight-950">{rate}</span>
          <Link
            to={`/mechanics/${mechanic.id}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline"
          >
            View profile <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </motion.article>
    )
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.24) }}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-midnight-900/10 bg-white transition-all hover:-translate-y-1 hover:shadow-card"
    >
      <div className="relative h-40 overflow-hidden bg-mint-100">
        <SmartImage
          src={mechanic.logo_url}
          alt={mechanic.business_name}
          className="h-full w-full"
          imgClassName="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {mechanic.is_verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-emerald-700 shadow-sm">
              <BadgeCheck className="h-3 w-3" /> Verified
            </span>
          )}
          {mechanic.emergency_available && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-bold text-midnight-950 shadow-sm">
              Emergency callout
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={`/mechanics/${mechanic.id}`}
              className="font-display text-lg font-semibold leading-tight text-midnight-950 transition-colors hover:text-brand-700"
            >
              {mechanic.business_name}
            </Link>
            <p className="mt-0.5 text-xs text-muted">by {mechanic.owner_name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-mint-50 px-2 py-1 text-xs font-bold text-midnight-950">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {mechanic.rating_average.toFixed(1)}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{mechanic.city}, {mechanic.state}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{mechanic.operating_hours}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {specialties.map((type) => (
            <Badge key={type} tone="neutral">{serviceTypeLabel(type)}</Badge>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted">
          <span className="font-semibold text-midnight-950">{serviceModeLabel(mechanic.service_modes[0] ?? 'mobile')}</span>
          <Dot />
          <span>{mechanic.years_experience} yrs experience</span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-midnight-900/5 pt-4">
          <span className={cn('font-mono text-sm font-semibold text-midnight-950')}>{rate}</span>
          <Link
            to={`/mechanics/${mechanic.id}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline"
          >
            View profile <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </motion.article>
  )
}

export function MechanicMiniCard({ mechanic }: { mechanic: Mechanic }) {
  return (
    <Link
      to={`/mechanics/${mechanic.id}`}
      className="flex items-center gap-3 rounded-xl border border-midnight-900/10 bg-white p-3 transition-shadow hover:shadow-card"
    >
      <SmartImage src={mechanic.logo_url} alt={mechanic.business_name} className="h-12 w-12 rounded-lg bg-mint-100" imgClassName="object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-midnight-950">{mechanic.business_name}</p>
        <p className="flex items-center gap-1 text-[11px] text-muted">
          <MapPin className="h-3 w-3" /> {mechanic.city}, {mechanic.state}
          {mechanic.hourly_rate && <> · <Phone className="h-3 w-3" /> {formatNaira(mechanic.hourly_rate)}/hr</>}
        </p>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-brand-700" />
    </Link>
  )
}
