import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  MapPin,
  PauseCircle,
  Pencil,
  PlugZap,
  Plus,
  Search,
  Star,
  Zap,
} from 'lucide-react'
import { useOperatorData } from '@/hooks/useOperatorData'
import { setStationStatus } from '@/services/operator'
import { PageHeader, SectionCard } from '@/components/ui/Data'
import { Badge } from '@/components/ui/Badge'
import { Button, buttonVariants } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState, PageLoader, useToast } from '@/components/ui/Feedback'
import { SelectFilter } from '@/components/dashboard/Kit'
import { SmartImage } from '@/components/common/SmartImage'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatNaira } from '@/lib/utils'
import type { Station } from '@/types'

const STATUS_TONE: Record<Station['status'], 'success' | 'warning' | 'danger' | 'neutral'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
  suspended: 'danger',
}

export default function StationsListPage() {
  const { stations, isLoading, operatorId } = useOperatorData()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [confirm, setConfirm] = useState<Station | null>(null)
  const [working, setWorking] = useState(false)
  usePageTitle('My stations')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return stations.filter((station) => {
      const matchesStatus = status === 'all' || station.status === status
      const matchesTerm =
        !term ||
        station.name.toLowerCase().includes(term) ||
        station.city.toLowerCase().includes(term) ||
        station.address.toLowerCase().includes(term)
      return matchesStatus && matchesTerm
    })
  }, [stations, search, status])

  const toggleStatus = async () => {
    if (!confirm) return
    setWorking(true)
    try {
      const next = confirm.status === 'suspended' ? 'approved' : 'suspended'
      await setStationStatus(confirm.id, next)
      await queryClient.invalidateQueries({ queryKey: ['operator-stations', operatorId] })
      await queryClient.invalidateQueries({ queryKey: ['operator-stats', operatorId] })
      toast.success(next === 'suspended' ? 'Station paused' : 'Station reactivated', next === 'suspended' ? 'New bookings are paused until you reactivate it.' : 'Drivers can book this station again.')
      setConfirm(null)
    } catch (error) {
      toast.error('Could not update station', (error as Error).message)
    } finally {
      setWorking(false)
    }
  }

  if (isLoading) return <PageLoader label="Loading stations" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Network"
        title="My stations"
        description="Manage locations, pricing and availability. Stations go live after EV Naija verification."
        actions={<Link to="/operator/stations/new" className={buttonVariants({ size: 'md' })}><Plus className="h-4 w-4" /> Add station</Link>}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, city or address" className="input-base h-10 pl-9 text-[12px]" />
        </div>
        <SelectFilter
          value={status}
          onChange={setStatus}
          label="Status"
          options={[
            { value: 'all', label: `All stations (${stations.length})` },
            { value: 'approved', label: 'Approved' },
            { value: 'pending', label: 'Pending review' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'rejected', label: 'Rejected' },
          ]}
        />
      </div>

      {filtered.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((station) => {
            const cover = station.images?.find((image) => image.is_cover)?.image_url ?? station.images?.[0]?.image_url
            const minPrice = station.chargers?.length ? Math.min(...station.chargers.map((charger) => charger.price_per_kwh)) : 0
            const available = station.chargers?.filter((charger) => charger.status === 'available').length ?? 0
            return (
              <article key={station.id} className="overflow-hidden rounded-3xl border border-midnight-900/[0.07] bg-white shadow-card">
                <div className="flex">
                  <div className="relative hidden w-[132px] shrink-0 sm:block">
                    <SmartImage src={cover} alt={station.name} className="absolute inset-0 h-full w-full" imgClassName="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/10" />
                  </div>
                  <div className="min-w-0 flex-1 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={STATUS_TONE[station.status]}>{station.status}</Badge>
                          {station.is_featured && <Badge tone="lime">Featured</Badge>}
                        </div>
                        <h2 className="mt-2 truncate font-display text-base font-semibold text-midnight-900">{station.name}</h2>
                        <p className="mt-1 flex items-center gap-1 text-[10.5px] text-muted"><MapPin className="h-3 w-3" /> {station.address}, {station.city}</p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 font-mono text-[10px] font-medium text-amber-700">
                        <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> {station.rating_average.toFixed(1)}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-mint-50 px-2.5 py-2">
                        <p className="font-mono text-[11px] font-medium text-midnight-900">{station.chargers?.length ?? 0}</p>
                        <p className="text-[8px] uppercase tracking-[0.1em] text-muted">Chargers</p>
                      </div>
                      <div className="rounded-xl bg-mint-50 px-2.5 py-2">
                        <p className="font-mono text-[11px] font-medium text-emerald-700">{available}</p>
                        <p className="text-[8px] uppercase tracking-[0.1em] text-muted">Available</p>
                      </div>
                      <div className="rounded-xl bg-mint-50 px-2.5 py-2">
                        <p className="font-mono text-[11px] font-medium text-midnight-900">{minPrice ? formatNaira(minPrice) : '—'}</p>
                        <p className="text-[8px] uppercase tracking-[0.1em] text-muted">Per kWh</p>
                      </div>
                    </div>

                    <p className="mt-2.5 flex items-center gap-1 text-[9.5px] text-muted"><Clock className="h-2.5 w-2.5" /> {station.operating_hours} · Created {formatDate(station.created_at)}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-midnight-900/[0.06] pt-3">
                      <Link to={`/operator/stations/${station.id}/edit`} className="inline-flex h-8 items-center gap-1 rounded-lg bg-midnight-900 px-2.5 text-[10px] font-semibold text-lime hover:bg-midnight-800"><Pencil className="h-3 w-3" /> Edit</Link>
                      <Link to={`/operator/chargers?station=${station.id}`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-midnight-900/10 px-2.5 text-[10px] font-semibold text-charcoal-600 hover:bg-mint-50"><PlugZap className="h-3 w-3" /> Chargers</Link>
                      <Link to={`/operator/availability?station=${station.id}`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-midnight-900/10 px-2.5 text-[10px] font-semibold text-charcoal-600 hover:bg-mint-50"><Clock className="h-3 w-3" /> Hours</Link>
                      <Link to={`/stations/${station.slug}`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-midnight-900/10 px-2.5 text-[10px] font-semibold text-charcoal-600 hover:bg-mint-50">Public page <ArrowUpRight className="h-3 w-3" /></Link>
                      {station.status !== 'suspended' ? (
                        <button onClick={() => setConfirm(station)} className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-amber-700 hover:bg-amber-50"><PauseCircle className="h-3 w-3" /> Pause</button>
                      ) : (
                        <button onClick={() => setConfirm(station)} className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50"><CheckCircle2 className="h-3 w-3" /> Reactivate</button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title={stations.length ? 'No stations match this view' : 'Add your first station'}
          description={stations.length ? 'Try a different search term or status filter.' : 'List a charging location, add chargers, set your price and start receiving driver bookings.'}
          action={<Link to="/operator/stations/new" className={buttonVariants({ variant: 'dark' })}><Plus className="h-4 w-4" /> Add a station</Link>}
        />
      )}

      <SectionCard title="How station verification works" description="What to expect before going live.">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { title: 'Submit details', text: 'Add the exact address, coordinates, operating hours and at least one charger.', icon: Building2 },
            { title: 'We review', text: 'EV Naija checks ownership, safety information and station accuracy within 2 business days.', icon: Clock },
            { title: 'Go live', text: 'Approved stations appear in search and can accept paid bookings immediately.', icon: Zap },
          ].map((step, index) => (
            <div key={step.title} className="rounded-2xl bg-mint-50 p-4">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-midnight-900 font-mono text-[10px] text-lime">{index + 1}</span>
                <step.icon className="h-3.5 w-3.5 text-midnight-700" />
              </div>
              <p className="mt-2 text-[12px] font-semibold text-midnight-900">{step.title}</p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{step.text}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={toggleStatus}
        title={confirm?.status === 'suspended' ? 'Reactivate this station?' : 'Pause this station?'}
        description={confirm?.status === 'suspended' ? 'Drivers will be able to book this station again, subject to charger availability.' : 'Existing paid bookings remain valid, but no new bookings will be accepted while paused.'}
        confirmLabel={confirm?.status === 'suspended' ? 'Reactivate station' : 'Pause station'}
        danger={confirm?.status !== 'suspended'}
        loading={working}
      />
    </div>
  )
}
