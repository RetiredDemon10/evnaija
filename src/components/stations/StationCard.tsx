import { motion } from 'framer-motion'
import { ArrowUpRight, Clock, MapPin, PlugZap, Star, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Station } from '@/types'
import { SmartImage } from '@/components/common/SmartImage'
import { Badge, Dot } from '@/components/ui/Badge'
import { connectorLabels, formatNaira, speedLabels } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function StationCard({ station, view = 'grid', index = 0, detailBase = '/stations' }: { station: Station; view?: 'grid' | 'list'; index?: number; detailBase?: string }) {
  const cover = station.images?.find((image) => image.is_cover)?.image_url ?? station.images?.[0]?.image_url
  const connectors = Array.from(new Set(station.chargers?.filter((c) => c.is_active).map((c) => c.connector_type)))
  const minPrice = Math.min(...station.chargers?.map((c) => c.price_per_kwh) ?? [0])
  const maxSpeed = station.chargers?.reduce((acc, c) => Math.max(acc, c.capacity_kw), 0) ?? 0
  const available = station.available_chargers > 0

  if (view === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        whileHover={{ y: -3 }}
        transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.4 }}
        className="group flex flex-col overflow-hidden rounded-2xl border border-midnight-900/[0.07] bg-white shadow-card transition-[border-color,box-shadow] hover:border-lime-400/60 hover:shadow-float sm:flex-row"
      >
        <Link to={`${detailBase}/${station.slug}`} className="relative block sm:w-[220px] lg:w-[250px]">
          <SmartImage src={cover} alt={station.name} className="h-44 sm:h-full" imgClassName="group-hover:scale-105" />
          <div className="absolute left-3 top-3">
            {station.is_featured && <Badge tone="lime" className="backdrop-blur">Featured</Badge>}
          </div>
        </Link>
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link to={`${detailBase}/${station.slug}`} className="font-display text-lg font-semibold text-midnight-900 transition group-hover:text-lime-700">
                {station.name}
              </Link>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                <MapPin className="h-3.5 w-3.5" /> {station.address}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 font-mono text-[11px] font-medium text-amber-700">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {station.rating_average.toFixed(1)}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {connectors.slice(0, 4).map((connector) => (
              <span key={connector} className="rounded-md border border-charcoal-200 px-1.5 py-0.5 font-mono text-[10px] text-charcoal-600">
                {connectorLabels[connector]}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 rounded-md bg-charcoal-50 px-1.5 py-0.5 font-mono text-[10px] text-charcoal-600">
              <Zap className="h-2.5 w-2.5" /> {maxSpeed} kW
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-midnight-900/[0.05] pt-3">
            <div className="flex items-center gap-3">
              <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold', available ? 'text-emerald-600' : 'text-red-500')}>
                <Dot tone={available ? 'success' : 'danger'} /> {station.available_chargers} of {station.total_chargers} free
              </span>
              <span className="hidden items-center gap-1 text-[11px] text-muted sm:flex">
                <Clock className="h-3 w-3" /> {station.operating_hours}
              </span>
            </div>
            <div className="text-right">
              <span className="font-mono text-sm font-medium text-midnight-900">{formatNaira(minPrice)}</span>
              <span className="text-[10px] text-muted"> /kWh</span>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.99 }}
      transition={{ delay: Math.min(index * 0.06, 0.4), duration: 0.45 }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-midnight-900/[0.06] bg-white shadow-card transition-[border-color,box-shadow] duration-300 hover:border-lime-400/50 hover:shadow-float"
    >
      <Link to={`${detailBase}/${station.slug}`} className="relative block aspect-[16/10] overflow-hidden">
        <SmartImage src={cover} alt={station.name} className="h-full" imgClassName="transition-transform duration-700 group-hover:scale-[1.06]" />
        <div className="absolute inset-0 bg-gradient-to-t from-midnight-950/50 via-transparent to-transparent" />
        <div className="absolute left-4 top-4 flex items-center gap-2">
          {station.is_featured && (
            <span className="rounded-full bg-lime px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-midnight-900">
              Featured
            </span>
          )}
          <span className={cn('flex items-center gap-1.5 rounded-full border border-white/20 bg-midnight-950/50 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur', !available && 'text-red-200')}>
            <Dot tone={available ? 'success' : 'danger'} />
            {available ? `${station.available_chargers} available` : 'Fully booked'}
          </span>
        </div>
        <div className="absolute bottom-3.5 left-4 right-4 flex items-end justify-between gap-2">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/60">{station.city}, {station.state}</p>
            <h3 className="mt-1 font-display text-lg font-semibold leading-tight text-white">{station.name}</h3>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-lg bg-white/95 px-2 py-1 font-mono text-[10px] font-medium text-charcoal-900 backdrop-blur">
            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> {station.rating_average.toFixed(1)}
          </span>
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-4.5 p-5">
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {station.address}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {connectors.slice(0, 3).map((connector) => (
            <span key={connector} className="rounded-md bg-charcoal-50 px-1.5 py-1 font-mono text-[9.5px] font-medium text-charcoal-600">
              {connectorLabels[connector]}
            </span>
          ))}
          <span className="rounded-md bg-mint px-1.5 py-1 font-mono text-[9.5px] font-medium text-midnight-700">
            {maxSpeed} kW
          </span>
          {station.rating_count > 0 && (
            <span className="ml-auto text-[10px] text-muted">{station.rating_count} reviews</span>
          )}
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">From</p>
            <p className="mt-0.5 font-mono text-[17px] font-medium leading-none text-midnight-900">
              {formatNaira(minPrice)}<span className="text-[10px] font-normal text-muted">/kWh</span>
            </p>
          </div>
          <Link
            to={`${detailBase}/${station.slug}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-midnight-900 px-3.5 text-[11.5px] font-semibold text-white transition group-hover:bg-lime group-hover:text-midnight-900"
          >
            View station <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </motion.article>
  )
}

export function StationMiniCard({ station, detailBase = '/stations' }: { station: Station; detailBase?: string }) {
  const cover = station.images?.[0]?.image_url
  return (
    <Link
      to={`${detailBase}/${station.slug}`}
      className="flex items-center gap-3 rounded-2xl border border-midnight-900/[0.06] bg-white p-2.5 shadow-sm transition hover:border-lime-400/60 hover:shadow-card"
    >
      <SmartImage src={cover} alt={station.name} className="h-12 w-14 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-midnight-900">{station.name}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted">
          <MapPin className="h-2.5 w-2.5" /> {station.city}
        </p>
      </div>
      <span className="shrink-0 font-mono text-[10px] text-emerald-600">{station.available_chargers} free</span>
    </Link>
  )
}
