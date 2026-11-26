import { useState } from 'react'
import { LayoutGrid, List, Map as MapIcon, SlidersHorizontal, X } from 'lucide-react'
import type { MechanicFilters } from '@/types'
import { MECHANIC_MODE_OPTIONS, MECHANIC_SERVICE_TYPES } from '@/lib/mechanics'
import { NIGERIA_STATE_NAMES, citiesForState, stateLabel } from '@/lib/nigeria'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export type ViewMode = 'grid' | 'list' | 'map'

export function MechanicFilterBar({
  filters,
  onChange,
  view,
  onViewChange,
  resultCount,
  compact,
}: {
  filters: MechanicFilters
  onChange: (filters: MechanicFilters) => void
  view: ViewMode
  onViewChange: (view: ViewMode) => void
  resultCount: number
  compact?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const update = (patch: Partial<MechanicFilters>) => onChange({ ...filters, ...patch })
  const cityOptions = filters.state && filters.state !== 'all' ? citiesForState(filters.state) : []
  const activeExtra =
    (filters.state && filters.state !== 'all' ? 1 : 0) +
    (filters.city && filters.city !== 'all' ? 1 : 0) +
    (filters.serviceType && filters.serviceType !== 'all' ? 1 : 0) +
    (filters.mode && filters.mode !== 'all' ? 1 : 0) +
    (filters.minRating ? 1 : 0) +
    (filters.emergencyOnly ? 1 : 0)

  return (
    <div className="mb-6 rounded-2xl border border-midnight-900/10 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={filters.search ?? ''}
            onChange={(event) => update({ search: event.target.value })}
            placeholder="Search mechanics, brands or city"
            aria-label="Search EV mechanics"
            className="input-base w-full pl-9"
          />
        </div>
        <Button variant="outline" onClick={() => setExpanded((value) => !value)} className="gap-2">
          <SlidersHorizontal className="h-4 w-4" /> Filters
          {activeExtra > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">{activeExtra}</span>}
        </Button>
        {!compact && (
          <div className="flex items-center rounded-xl border border-midnight-900/10 bg-charcoal-50 p-1">
            {([
              { value: 'grid', label: 'Grid', icon: LayoutGrid },
              { value: 'list', label: 'List', icon: List },
              { value: 'map', label: 'Map', icon: MapIcon },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onViewChange(option.value)}
                aria-label={`${option.label} view`}
                aria-pressed={view === option.value}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  view === option.value ? 'bg-white text-midnight-950 shadow-sm' : 'text-muted hover:text-midnight-900',
                )}
              >
                <option.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{option.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {expanded && (
        <div className="mt-4 grid gap-3 border-t border-midnight-900/5 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="label-base">State</span>
            <select
              className="input-base"
              value={filters.state ?? 'all'}
              onChange={(event) => update({ state: event.target.value, city: 'all' })}
            >
              <option value="all">All states</option>
              {NIGERIA_STATE_NAMES.map((state) => (
                <option key={state} value={state}>{stateLabel(state)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label-base">City</span>
            <select
              className="input-base"
              value={filters.city ?? 'all'}
              onChange={(event) => update({ city: event.target.value })}
              disabled={!cityOptions.length}
            >
              <option value="all">All cities</option>
              {cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label-base">Speciality</span>
            <select
              className="input-base"
              value={filters.serviceType ?? 'all'}
              onChange={(event) => update({ serviceType: event.target.value as MechanicFilters['serviceType'] })}
            >
              <option value="all">All services</option>
              {MECHANIC_SERVICE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label-base">Service mode</span>
            <select
              className="input-base"
              value={filters.mode ?? 'all'}
              onChange={(event) => update({ mode: event.target.value as MechanicFilters['mode'] })}
            >
              <option value="all">Any mode</option>
              {MECHANIC_MODE_OPTIONS.map((mode) => (
                <option key={mode.value} value={mode.value}>{mode.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label-base">Minimum rating</span>
            <select
              className="input-base"
              value={filters.minRating ?? 0}
              onChange={(event) => update({ minRating: Number(event.target.value) })}
            >
              <option value={0}>Any rating</option>
              <option value={4}>4.0+</option>
              <option value={4.5}>4.5+</option>
              <option value={4.8}>4.8+</option>
            </select>
          </label>
          <label className="block">
            <span className="label-base">Sort by</span>
            <select
              className="input-base"
              value={filters.sort ?? 'recommended'}
              onChange={(event) => update({ sort: event.target.value as MechanicFilters['sort'] })}
            >
              <option value="recommended">Recommended</option>
              <option value="rating">Highest rated</option>
              <option value="experience">Most experienced</option>
              <option value="rate">Lowest hourly rate</option>
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2">
            <input
              type="checkbox"
              checked={filters.emergencyOnly ?? false}
              onChange={(event) => update({ emergencyOnly: event.target.checked })}
              className="h-4 w-4 rounded border-midnight-900/20 accent-brand-600"
            />
            <span className="text-xs font-semibold text-midnight-900">Emergency callout available</span>
          </label>
          <div className="flex items-end justify-between gap-2 pb-2">
            <span className="text-xs text-muted">{resultCount} {resultCount === 1 ? 'mechanic' : 'mechanics'} found</span>
            {activeExtra > 0 && (
              <Button variant="ghost" size="sm" onClick={() => onChange({ search: filters.search, sort: filters.sort })} className="gap-1">
                <X className="h-3 w-3" /> Clear
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
