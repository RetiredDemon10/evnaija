import { lazy, Suspense, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { ArrowDownUp, MapPin, RefreshCw } from 'lucide-react'
import type { ChargingSpeed, ConnectorType, Station, StationFilters } from '@/types'
import { fetchStations } from '@/services/stations'
import { StationCard } from './StationCard'
import { StationFilterBar, type ViewMode } from './StationFilterBar'
const StationMap = lazy(() =>
  import('@/components/map/StationMap').then((module) => ({ default: module.StationMap })),
)
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { StationMiniCard } from './StationCard'
import { cn } from '@/lib/utils'
import { stateForCity, stateLabel } from '@/lib/nigeria'
import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/Button'

export function StationDiscovery({
  detailBase = '/stations',
  compact,
}: {
  detailBase?: string
  compact?: boolean
}) {
  const [searchParams] = useSearchParams()
  const initialCity = searchParams.get('city') ?? 'all'
  const initialState =
    searchParams.get('state') ??
    (initialCity !== 'all' ? stateForCity(initialCity) ?? 'all' : 'all')
  const [filters, setFilters] = useState<StationFilters>({
    search: searchParams.get('q') ?? '',
    state: initialState,
    city: initialCity,
    connector: (searchParams.get('connector') as ConnectorType | null) ?? 'all',
    speed: 'all',
    sort: 'recommended',
  })
  const [view, setView] = useState<ViewMode>('grid')
  const [selected, setSelected] = useState<Station | null>(null)

  const { data: stations = [], isLoading, error, refetch } = useQuery({
    queryKey: ['stations', filters],
    queryFn: () => fetchStations(filters),
  })

  const sorted = useMemo(() => {
    const copy = [...stations]
    if (filters.sort === 'price_asc') {
      copy.sort(
        (a, b) =>
          Math.min(...a.chargers.map((c) => c.price_per_kwh)) -
          Math.min(...b.chargers.map((c) => c.price_per_kwh)),
      )
    } else if (filters.sort === 'price_desc') {
      copy.sort(
        (a, b) =>
          Math.min(...b.chargers.map((c) => c.price_per_kwh)) -
          Math.min(...a.chargers.map((c) => c.price_per_kwh)),
      )
    } else if (filters.sort === 'rating') {
      copy.sort((a, b) => b.rating_average - a.rating_average)
    }
    return copy
  }, [stations, filters.sort])

  return (
    <div className="space-y-5">
      <StationFilterBar
        filters={filters}
        onChange={setFilters}
        view={view}
        onViewChange={setView}
        resultCount={stations.length}
        compact={compact}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">
          <span className="font-mono text-sm font-medium text-midnight-900">{stations.length}</span>{' '}
          station{stations.length === 1 ? '' : 's'} found
          {filters.city && filters.city !== 'all' && <span> in {filters.city}</span>}
          {(!filters.city || filters.city === 'all') && filters.state && filters.state !== 'all' && (
            <span> in {stateLabel(filters.state)}</span>
          )}
          {filters.search && <span> matching “{filters.search}”</span>}
        </p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-muted">
            <ArrowDownUp className="h-3 w-3" />
            Sort
          </label>
          <select
            value={filters.sort}
            onChange={(event) => setFilters({ ...filters, sort: event.target.value as StationFilters['sort'] })}
            className="h-8 rounded-lg border border-midnight-900/10 bg-white px-2 text-[11px] font-medium text-charcoal-700 outline-none"
          >
            <option value="recommended">Recommended</option>
            <option value="price_asc">Lowest price</option>
            <option value="price_desc">Highest price</option>
            <option value="rating">Highest rated</option>
          </select>
          <button
            onClick={() => void refetch()}
            className="grid h-8 w-8 place-items-center rounded-lg border border-midnight-900/10 bg-white text-muted transition hover:text-midnight-900"
            aria-label="Refresh stations"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {error ? (
        <ErrorState description={(error as Error).message} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className={cn('grid gap-5 sm:grid-cols-2', view === 'grid' && 'lg:grid-cols-3')}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-3xl bg-white p-3 shadow-card">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <div className="space-y-3 p-3 pt-5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : stations.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-6 w-6" />}
          title="No stations match those filters"
          description="Try widening your search — remove the connector filter, pick a different city, or clear the price limit."
          action={
            <button
              onClick={() => setFilters({ search: '', state: 'all', city: 'all', connector: 'all', speed: 'all', sort: 'recommended' })}
              className={buttonVariants({ variant: 'dark', size: 'sm' })}
            >
              Clear all filters
            </button>
          }
        />
      ) : view === 'map' ? (
        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <div className="lg:sticky lg:top-24 lg:h-[620px]">
            <Suspense
              fallback={
                <div className="grid h-[420px] place-items-center rounded-3xl border border-midnight-900/[0.07] bg-mint-50 lg:h-full">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Loading map</span>
                </div>
              }
            >
              <StationMap
                stations={stations}
                selectedId={selected?.id}
                onSelect={setSelected}
                height={620}
                className="h-[420px] lg:h-full"
              />
            </Suspense>
          </div>
          <div className="hide-scrollbar max-h-[620px] space-y-2.5 overflow-y-auto pr-1">
            {(selected ? [selected, ...stations.filter((s) => s.id !== selected.id)] : stations).map((station) => (
              <div key={station.id} onClick={() => setSelected(station)}>
                <StationMiniCard station={station} detailBase={detailBase} />
              </div>
            ))}
            {selected && (
              <div className="rounded-2xl border border-lime-400/50 bg-lime/10 p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-midnight-600">Selected station</p>
                <p className="mt-1 font-display text-sm font-semibold text-midnight-900">{selected.name}</p>
                <p className="mt-0.5 text-[11px] text-charcoal-500">{selected.address}</p>
                <Link
                  to={`${detailBase}/${selected.slug}`}
                  className={buttonVariants({ size: 'sm', className: 'mt-3 w-full' })}
                >
                  View station details
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={cn('grid gap-5', view === 'grid' && 'sm:grid-cols-2 lg:grid-cols-3')}>
          {sorted.map((station, index) => (
            <div key={station.id} className={view === 'list' ? 'sm:col-span-2' : undefined}>
              <StationCard view={view} station={station} index={index} detailBase={detailBase} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
