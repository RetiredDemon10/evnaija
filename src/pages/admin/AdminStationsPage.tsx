import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Building2, MapPin, PauseCircle, PlayCircle, Search, Star, Zap } from 'lucide-react'
import { listAllStations, listOperators, setStationStatusAdmin, writeAuditLog } from '@/services/admin'
import type { Station } from '@/types'
import { PageHeader, DataTable, Pagination, type Column } from '@/components/ui/Data'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Modal'
import { ExportButton, SelectFilter, TableEmpty, usePaged } from '@/components/dashboard/Kit'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatNaira } from '@/lib/utils'

const STATUS_TONE: Record<Station['status'], 'success' | 'warning' | 'danger' | 'neutral'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
  suspended: 'danger',
}

export default function AdminStationsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [city, setCity] = useState('all')
  const [page, setPage] = useState(1)
  const [confirm, setConfirm] = useState<{ station: Station; action: 'suspend' | 'activate' } | null>(null)
  const [working, setWorking] = useState(false)
  usePageTitle('Charging stations')

  const { data: stations = [], isLoading } = useQuery({ queryKey: ['admin-stations'], queryFn: listAllStations })
  const { data: operators = [] } = useQuery({ queryKey: ['admin-operators'], queryFn: listOperators })

  const cities = useMemo(() => Array.from(new Set(stations.map((station) => station.city))), [stations])
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return stations.filter((station) => {
      const matchesStatus = status === 'all' || station.status === status
      const matchesCity = city === 'all' || station.city === city
      const matchesSearch = !term || station.name.toLowerCase().includes(term) || station.address.toLowerCase().includes(term) || (station.operator?.business_name ?? '').toLowerCase().includes(term)
      return matchesStatus && matchesCity && matchesSearch
    })
  }, [stations, status, city, search])

  const { rows, pageCount } = usePaged(filtered, 12, page)

  const operatorName = (station: Station) => station.operator?.business_name ?? operators.find((operator) => operator.id === station.operator_id)?.business_name ?? 'Operator'

  const runAction = async () => {
    if (!confirm) return
    setWorking(true)
    try {
      const nextStatus: Station['status'] = confirm.action === 'suspend' ? 'suspended' : 'approved'
      await setStationStatusAdmin(confirm.station.id, nextStatus)
      if (user) {
        await writeAuditLog(user.id, confirm.action === 'suspend' ? 'station.suspended' : 'station.activated', 'station', confirm.station.id, {
          name: confirm.station.name,
          previousStatus: confirm.station.status,
        })
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-stations'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
      toast.success(confirm.action === 'suspend' ? 'Station suspended' : 'Station activated', confirm.action === 'suspend' ? 'It is hidden from new bookings. Existing bookings remain valid.' : 'The station can accept bookings again.')
      setConfirm(null)
    } catch (error) {
      toast.error('Could not update station', (error as Error).message)
    } finally {
      setWorking(false)
    }
  }

  const toggleFeatured = async (station: Station) => {
    try {
      await setStationStatusAdmin(station.id, station.status, !station.is_featured)
      if (user) {
        await writeAuditLog(user.id, station.is_featured ? 'station.unfeatured' : 'station.featured', 'station', station.id, { name: station.name })
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-stations'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
      toast.success(station.is_featured ? 'Removed from featured' : 'Added to featured', station.name)
    } catch (error) {
      toast.error('Could not update feature status', (error as Error).message)
    }
  }

  const columns: Column<Station>[] = [
    {
      key: 'station',
      header: 'Station',
      render: (station) => (
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-[12px] font-semibold text-midnight-900">{station.name}</p>
            {station.is_featured && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
          </div>
          <p className="flex items-center gap-1 text-[9.5px] text-muted"><MapPin className="h-2.5 w-2.5" /> {station.city}, {station.state}</p>
        </div>
      ),
    },
    {
      key: 'operator',
      header: 'Operator',
      render: (station) => <span className="text-[10.5px] text-charcoal-600">{operatorName(station)}</span>,
    },
    {
      key: 'equipment',
      header: 'Equipment',
      render: (station) => (
        <div className="text-[10px] text-charcoal-600">
          <p>{station.chargers?.length ?? 0} chargers</p>
          <p className="text-muted">{station.chargers?.reduce((sum, charger) => sum + charger.connector_count, 0) ?? 0} points</p>
        </div>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (station) => (
        <span className="flex items-center gap-1 font-mono text-[10.5px] text-charcoal-600">
          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> {station.rating_average.toFixed(1)} <span className="text-muted">({station.rating_count})</span>
        </span>
      ),
    },
    {
      key: 'commission',
      header: 'Created',
      render: (station) => <span className="text-[10px] text-muted">{formatDate(station.created_at)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (station) => <Badge tone={STATUS_TONE[station.status]}>{station.status}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (station) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => void toggleFeatured(station)} title={station.is_featured ? 'Remove featured' : 'Make featured'} className={`grid h-8 w-8 place-items-center rounded-lg border ${station.is_featured ? 'border-amber-200 bg-amber-50 text-amber-600' : 'border-midnight-900/10 text-charcoal-500 hover:bg-mint-50'}`}>
            <Star className={`h-3.5 w-3.5 ${station.is_featured ? 'fill-amber-400' : ''}`} />
          </button>
          {station.status === 'suspended' ? (
            <button onClick={() => setConfirm({ station, action: 'activate' })} className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"><PlayCircle className="h-3 w-3" /> Activate</button>
          ) : (
            <button onClick={() => setConfirm({ station, action: 'suspend' })} className="inline-flex h-8 items-center gap-1 rounded-lg bg-red-50 px-2.5 text-[10px] font-semibold text-red-600 hover:bg-red-100"><PauseCircle className="h-3 w-3" /> Suspend</button>
          )}
          <Link to={`/stations/${station.slug}`} className="grid h-8 w-8 place-items-center rounded-lg border border-midnight-900/10 text-charcoal-600 hover:bg-mint-50" title="Open public page"><ArrowUpRight className="h-3.5 w-3.5" /></Link>
        </div>
      ),
    },
  ]

  if (isLoading) return <PageLoader label="Loading stations" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketplace"
        title="Charging stations"
        description="Every listed location across the platform. Suspend stations that breach safety or accuracy standards."
        actions={
          <>
            <Link to="/admin/verification" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-midnight-900/10 px-4 text-[11px] font-semibold text-charcoal-600 hover:bg-mint-50"><Building2 className="h-4 w-4" /> Verification queue</Link>
            <ExportButton filename="ev-naija-stations.csv" rows={filtered.map((station) => ({ name: station.name, operator: operatorName(station), city: station.city, state: station.state, status: station.status, featured: station.is_featured ? 'Yes' : 'No', chargers: station.chargers?.length ?? 0, rating: station.rating_average }))} />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Total stations', value: stations.length, icon: MapPin },
          { label: 'Live', value: stations.filter((station) => station.status === 'approved').length, icon: Zap },
          { label: 'Pending', value: stations.filter((station) => station.status === 'pending').length, icon: Building2 },
          { label: 'Suspended', value: stations.filter((station) => station.status === 'suspended').length, icon: PauseCircle },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
            <div className="flex items-center justify-between"><p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{stat.label}</p><stat.icon className="h-4 w-4 text-midnight-700" /></div>
            <p className="mt-2 font-mono text-xl font-medium text-midnight-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search station, address or operator" className="input-base h-10 pl-9 text-[12px]" />
        </div>
        <div className="flex flex-wrap gap-2">
          <SelectFilter value={status} onChange={(value) => { setStatus(value); setPage(1) }} label="Status" options={[{ value: 'all', label: 'All statuses' }, { value: 'approved', label: 'Approved' }, { value: 'pending', label: 'Pending' }, { value: 'rejected', label: 'Rejected' }, { value: 'suspended', label: 'Suspended' }]} />
          <SelectFilter value={city} onChange={(value) => { setCity(value); setPage(1) }} label="City" options={[{ value: 'all', label: 'All cities' }, ...cities.map((value) => ({ value, label: value }))]} />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        minWidth={780}
        empty={<TableEmpty title="No stations match this view" description="Adjust filters or review the verification queue." />}
        mobileRender={(station) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[12.5px] font-semibold text-midnight-900">{station.name}</p>
                <p className="text-[10px] text-muted">{operatorName(station)} · {station.city}</p>
              </div>
              <Badge tone={STATUS_TONE[station.status]}>{station.status}</Badge>
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-midnight-900/[0.06] pt-2.5 text-[10px] text-muted">
              <span>{station.chargers?.length ?? 0} chargers · {station.rating_average.toFixed(1)}★</span>
              <Link to={`/stations/${station.slug}`} className="font-semibold text-lime-700">Public page</Link>
            </div>
          </div>
        )}
      />
      <Pagination page={page} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={12} />

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={runAction}
        title={confirm?.action === 'suspend' ? 'Suspend this station?' : 'Activate this station?'}
        description={confirm?.action === 'suspend' ? 'Drivers cannot create new bookings while suspended. Existing paid bookings remain valid. The operator will be notified.' : 'The station becomes visible in search and can accept new bookings if its operator is approved.'}
        confirmLabel={confirm?.action === 'suspend' ? 'Suspend station' : 'Activate station'}
        danger={confirm?.action === 'suspend'}
        loading={working}
      />
    </div>
  )
}
