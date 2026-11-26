import { LayoutGrid, List, Map as MapIcon, SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import type { ConnectorType, ChargingSpeed, StationFilters } from '@/types'
import { CONNECTOR_OPTIONS } from '@/lib/constants'
import { NIGERIA_STATE_NAMES, citiesForState, stateLabel } from '@/lib/nigeria'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export type ViewMode = 'grid' | 'list' | 'map'

export function StationFilterBar({
  filters,
  onChange,
  view,
  onViewChange,
  resultCount,
  compact,
}: {
  filters: StationFilters
  onChange: (filters: StationFilters) => void
  view: ViewMode
  onViewChange: (view: ViewMode) => void
  resultCount: number
  compact?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const update = (patch: Partial<StationFilters>) => onChange({ ...filters, ...patch })
  const cityOptions = filters.state && filters.state !== 'all' ? citiesForState(filters.state) : []
  const activeExtra =
    (filters.availableOnly ? 1 : 0) +
    (filters.minRating ? 1 : 0) +
    (filters.maxPrice ? 1 : 0) +
    (filters.speed && filters.speed !== 'all' ? 1 : 0)

  return (
    <div className={cn('rounded-2xl border border-midnight-900/[0.07] bg-white p-3 shadow-card', compact && 'p-2.5')}>
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input
            value={filters.search ?? ''}
            onChange={(event) => update({ search: event.target.value })}
            placeholder="Station name or address…"
            className="input-base h-10 border-charcoal-200 py-2 text-[13px] lg:col-span-2"
            aria-label="Search stations"
          />
          <select
            value={filters.state ?? 'all'}
            onChange={(event) => update({ state: event.target.value, city: 'all' })}
            className="input-base h-10 py-2 text-[13px]"
            aria-label="Filter by state"
          >
            <option value="all">All states</option>
            {NIGERIA_STATE_NAMES.map((stateName) => (
              <option key={stateName} value={stateName}>{stateLabel(stateName)}</option>
            ))}
          </select>
          <select
            value={filters.city ?? 'all'}
            onChange={(event) => update({ city: event.target.value })}
            disabled={!filters.state || filters.state === 'all'}
            className="input-base h-10 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Filter by city"
          >
            <option value="all">
              {filters.state && filters.state !== 'all' ? `All ${stateLabel(filters.state)} cities` : 'All cities'}
            </option>
            {cityOptions.map((cityOption) => (
              <option key={cityOption} value={cityOption}>{cityOption}</option>
            ))}
          </select>
          <select
            value={filters.connector ?? 'all'}
            onChange={(event) => update({ connector: event.target.value as ConnectorType | 'all' })}
            className="input-base h-10 py-2 text-[13px]"
            aria-label="Filter by connector"
          >
            <option value="all">All connectors</option>
            {CONNECTOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded((value) => !value)}
            className={cn(
              'inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-semibold transition',
              expanded || activeExtra
                ? 'border-midnight-900 bg-midnight-900 text-lime'
                : 'border-midnight-900/10 text-charcoal-600 hover:bg-charcoal-50',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeExtra > 0 && <span className="rounded-full bg-lime px-1.5 py-0.5 font-mono text-[9px] text-midnight-900">{activeExtra}</span>}
          </button>
          <div className="flex rounded-xl border border-midnight-900/10 p-0.5">
            {[
              { mode: 'grid' as const, icon: LayoutGrid, label: 'Grid view' },
              { mode: 'list' as const, icon: List, label: 'List view' },
              { mode: 'map' as const, icon: MapIcon, label: 'Map view' },
            ].map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => onViewChange(mode)}
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-lg transition',
                  view === mode ? 'bg-midnight-900 text-lime' : 'text-muted hover:text-charcoal-700',
                )}
                aria-label={label}
                aria-pressed={view === mode}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 grid gap-4 border-t border-midnight-900/[0.06] pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label-base text-[11px]">Charging speed</label>
            <select
              value={filters.speed ?? 'all'}
              onChange={(event) => update({ speed: event.target.value as ChargingSpeed | 'all' })}
              className="input-base h-9 py-1.5 text-xs"
            >
              <option value="all">Any speed</option>
              <option value="slow">Slow (3–7 kW)</option>
              <option value="fast">Fast (11–22 kW)</option>
              <option value="rapid">Rapid (43–100 kW)</option>
              <option value="ultra">Ultra-fast (150+ kW)</option>
            </select>
          </div>
          <div>
            <label className="label-base text-[11px]">Max price / kWh</label>
            <select
              value={filters.maxPrice ?? ''}
              onChange={(event) => update({ maxPrice: event.target.value ? Number(event.target.value) : undefined })}
              className="input-base h-9 py-1.5 text-xs"
            >
              <option value="">Any price</option>
              <option value="180">Up to ₦180</option>
              <option value="250">Up to ₦250</option>
              <option value="300">Up to ₦300</option>
              <option value="350">Up to ₦350</option>
            </select>
          </div>
          <div>
            <label className="label-base text-[11px]">Minimum rating</label>
            <select
              value={filters.minRating ?? ''}
              onChange={(event) => update({ minRating: event.target.value ? Number(event.target.value) : undefined })}
              className="input-base h-9 py-1.5 text-xs"
            >
              <option value="">Any rating</option>
              <option value="4.5">4.5+ stars</option>
              <option value="4">4.0+ stars</option>
              <option value="3.5">3.5+ stars</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex h-9 flex-1 cursor-pointer items-center justify-between rounded-xl border border-charcoal-200 px-3 text-xs font-medium text-charcoal-700">
              Available now
              <input
                type="checkbox"
                checked={Boolean(filters.availableOnly)}
                onChange={(event) => update({ availableOnly: event.target.checked })}
                className="h-4 w-4 rounded border-charcoal-300 accent-lime-600"
              />
            </label>
            {activeExtra > 0 && (
              <button
                onClick={() => onChange({ search: filters.search, state: filters.state, city: filters.city, connector: filters.connector, sort: filters.sort })}
                className="grid h-9 w-9 place-items-center rounded-xl border border-charcoal-200 text-muted hover:text-red-500"
                aria-label="Clear filters"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
