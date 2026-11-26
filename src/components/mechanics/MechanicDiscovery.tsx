import { lazy, Suspense, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Search, Wrench } from 'lucide-react'
import type { MechanicFilters } from '@/types'
import { fetchMechanics } from '@/services/mechanics'
import { MechanicCard, MechanicMiniCard } from './MechanicCard'
import { MechanicFilterBar, type ViewMode } from './MechanicFilterBar'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Button, buttonVariants } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const MechanicMap = lazy(() =>
  import('@/components/map/MechanicMap').then((module) => ({ default: module.MechanicMap })),
)

function filtersFromParams(params: URLSearchParams): MechanicFilters {
  return {
    search: params.get('q') ?? '',
    state: params.get('state') ?? 'all',
    city: params.get('city') ?? 'all',
    serviceType: (params.get('service') as MechanicFilters['serviceType']) ?? 'all',
    mode: (params.get('mode') as MechanicFilters['mode']) ?? 'all',
    minRating: Number(params.get('rating') ?? 0),
    emergencyOnly: params.get('emergency') === 'true',
    sort: (params.get('sort') as MechanicFilters['sort']) ?? 'recommended',
  }
}

export function MechanicDiscovery({ compact }: { compact?: boolean }) {
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<ViewMode>('grid')
  const filters = useMemo(() => filtersFromParams(params), [params])
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['mechanics', filters],
    queryFn: () => fetchMechanics(filters),
    staleTime: 60_000,
  })

  const updateFilters = (next: MechanicFilters) => {
    const search = new URLSearchParams()
    if (next.search) search.set('q', next.search)
    if (next.state && next.state !== 'all') search.set('state', next.state)
    if (next.city && next.city !== 'all') search.set('city', next.city)
    if (next.serviceType && next.serviceType !== 'all') search.set('service', next.serviceType)
    if (next.mode && next.mode !== 'all') search.set('mode', next.mode)
    if (next.minRating) search.set('rating', String(next.minRating))
    if (next.emergencyOnly) search.set('emergency', 'true')
    if (next.sort && next.sort !== 'recommended') search.set('sort', next.sort)
    setParams(search, { replace: true })
  }

  const mechanics = data ?? []
  return (
    <div>
      <MechanicFilterBar
        filters={filters}
        onChange={updateFilters}
        view={view}
        onViewChange={setView}
        resultCount={mechanics.length}
        compact={compact}
      />

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-80 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load mechanics"
          description={(error as Error).message}
          onRetry={() => void refetch()}
        />
      ) : mechanics.length === 0 ? (
        <EmptyState
          icon={<Search className="h-7 w-7" />}
          title="No mechanics match those filters"
          description="Try widening your search area or clearing a filter to see more EV specialists."
          action={
            <Button variant="outline" onClick={() => updateFilters({})}>
              Clear filters
            </Button>
          }
        />
      ) : view === 'map' ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Suspense fallback={<Skeleton className="h-[520px] rounded-3xl" />}>
            <MechanicMap mechanics={mechanics} height={520} />
          </Suspense>
          <aside className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {mechanics.map((mechanic) => <MechanicMiniCard key={mechanic.id} mechanic={mechanic} />)}
          </aside>
        </div>
      ) : (
        <>
          <div className={cn('grid gap-5', view === 'list' ? 'grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-3')}>
            {mechanics.map((mechanic, index) => (
              <MechanicCard key={mechanic.id} mechanic={mechanic} view={view} index={index} />
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-muted">
            Showing {mechanics.length} EV {mechanics.length === 1 ? 'mechanic' : 'mechanics'} · All listings are reviewed by the EV Naija team
          </p>
        </>
      )}

      {!compact && (
        <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-2xl bg-midnight-950 p-6 text-white sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-lime/15 text-lime"><Wrench className="h-5 w-5" /></span>
            <div>
              <p className="font-display text-base font-semibold">Are you an EV technician?</p>
              <p className="text-xs text-white/60">Join the directory and get discovered by EV owners across Nigeria.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/register/mechanic" className={buttonVariants({ variant: 'primary', size: 'sm' })}>Register your workshop</Link>
            <Link to="/how-it-works" className="inline-flex items-center gap-1 text-xs font-semibold text-white/70 hover:text-white">
              Learn more <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
