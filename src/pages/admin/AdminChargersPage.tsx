import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowUpRight, BatteryCharging, MapPin, PlugZap, Search, Zap } from 'lucide-react'
import { listAllStations, setChargerStatusAdmin, writeAuditLog } from '@/services/admin'
import type { Charger, Station } from '@/types'
import { PageHeader, DataTable, Pagination, type Column } from '@/components/ui/Data'
import { Badge } from '@/components/ui/Badge'
import { ExportButton, SelectFilter, TableEmpty, usePaged } from '@/components/dashboard/Kit'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { connectorLabels, formatNaira, speedLabels } from '@/lib/utils'

type Row = { id: string; charger: Charger; station: Station }

const STATUS_TONE: Record<Charger['status'], 'success' | 'warning' | 'danger' | 'neutral'> = {
  available: 'success',
  reserved: 'warning',
  charging: 'warning',
  offline: 'danger',
  maintenance: 'danger',
}

export default function AdminChargersPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [stationFilter, setStationFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [working, setWorking] = useState('')
  usePageTitle('Charging equipment')

  const { data: stations = [], isLoading } = useQuery({ queryKey: ['admin-stations'], queryFn: listAllStations })

  const allRows = useMemo<Row[]>(
    () => stations.flatMap((station) => station.chargers.map((charger) => ({ id: charger.id, charger, station }))),
    [stations],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return allRows.filter(({ charger, station }) => {
      const matchesStation = stationFilter === 'all' || station.id === stationFilter
      const matchesStatus = statusFilter === 'all' || charger.status === statusFilter
      const matchesSearch = !term || charger.name.toLowerCase().includes(term) || charger.charger_code.toLowerCase().includes(term) || station.name.toLowerCase().includes(term) || station.city.toLowerCase().includes(term)
      return matchesStation && matchesStatus && matchesSearch
    })
  }, [allRows, stationFilter, statusFilter, search])

  const { rows, pageCount } = usePaged(filtered, 14, page)

  const updateStatus = async (charger: Charger, status: Charger['status']) => {
    setWorking(charger.id)
    try {
      await setChargerStatusAdmin(charger.id, status)
      if (user) {
        await writeAuditLog(user.id, 'charger.status_changed', 'charger', charger.id, {
          charger: charger.charger_code,
          previous: charger.status,
          next: status,
        })
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-stations'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
      toast.success('Charger status updated', `${charger.charger_code} is now ${status}.`)
    } catch (error) {
      toast.error('Could not update charger', (error as Error).message)
    } finally {
      setWorking('')
    }
  }

  const columns: Column<Row>[] = [
    {
      key: 'charger',
      header: 'Equipment',
      render: ({ charger }) => (
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint text-midnight-800"><PlugZap className="h-3.5 w-3.5" /></span>
          <div>
            <p className="text-[12px] font-semibold text-midnight-900">{charger.name}</p>
            <p className="font-mono text-[9px] text-muted">{charger.charger_code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'station',
      header: 'Station',
      render: ({ station }) => (
        <div>
          <p className="text-[11px] text-charcoal-700">{station.name}</p>
          <p className="flex items-center gap-1 text-[9.5px] text-muted"><MapPin className="h-2.5 w-2.5" /> {station.city}</p>
        </div>
      ),
    },
    {
      key: 'spec',
      header: 'Specification',
      render: ({ charger }) => (
        <div className="text-[10px] text-charcoal-600">
          <p>{connectorLabels[charger.connector_type]} · {charger.capacity_kw} kW</p>
          <p className="text-muted">{speedLabels[charger.speed_category]} · {charger.connector_count} connector{charger.connector_count === 1 ? '' : 's'}</p>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      render: ({ charger }) => (
        <div>
          <p className="font-mono text-[11.5px] text-midnight-900">{formatNaira(charger.price_per_kwh)}<span className="text-[9px] text-muted">/kWh</span></p>
          <p className="text-[9px] text-muted">Fee {formatNaira(charger.booking_fee)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: ({ charger }) => <Badge tone={STATUS_TONE[charger.status]}>{charger.status}</Badge>,
    },
    {
      key: 'actions',
      header: 'Set status',
      render: ({ charger }) => (
        <select
          value={charger.status}
          disabled={working === charger.id}
          onChange={(event) => void updateStatus(charger, event.target.value as Charger['status'])}
          className="h-8 rounded-lg border border-midnight-900/10 bg-white px-2 text-[10px] font-medium text-charcoal-600 outline-none focus:border-lime-500 focus:ring-2 focus:ring-lime/30 disabled:opacity-50"
        >
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="charging">Charging</option>
          <option value="offline">Offline</option>
          <option value="maintenance">Maintenance</option>
        </select>
      ),
    },
  ]

  if (isLoading) return <PageLoader label="Loading equipment" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketplace"
        title="Charging equipment"
        description="All physical charging points across the platform. Changing status here overrides the operator's setting immediately."
        actions={<ExportButton filename="ev-naija-chargers.csv" rows={filtered.map(({ charger, station }) => ({ charger: charger.name, code: charger.charger_code, station: station.name, city: station.city, connector: connectorLabels[charger.connector_type], capacityKw: charger.capacity_kw, pricePerKwh: charger.price_per_kwh, status: charger.status, active: charger.is_active ? 'Yes' : 'No' }))} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total chargers', value: allRows.length, icon: PlugZap, hint: 'Physical units' },
          { label: 'Connectors', value: allRows.reduce((sum, row) => sum + row.charger.connector_count, 0), icon: Zap, hint: 'Charge points' },
          { label: 'Available', value: allRows.filter((row) => row.charger.status === 'available').length, icon: BatteryCharging, hint: 'Ready to charge' },
          { label: 'Offline / maintenance', value: allRows.filter((row) => ['offline', 'maintenance'].includes(row.charger.status)).length, icon: MapPin, hint: 'Needs operator action' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
            <div className="flex items-center justify-between"><p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{stat.label}</p><stat.icon className="h-4 w-4 text-midnight-700" /></div>
            <p className="mt-2 font-mono text-xl font-medium text-midnight-900">{stat.value}</p>
            <p className="mt-0.5 text-[9.5px] text-muted">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search charger, code or station" className="input-base h-10 pl-9 text-[12px]" />
        </div>
        <div className="flex flex-wrap gap-2">
          <SelectFilter value={stationFilter} onChange={(value) => { setStationFilter(value); setPage(1) }} label="Station" options={[{ value: 'all', label: 'All stations' }, ...stations.map((station) => ({ value: station.id, label: station.name }))]} />
          <SelectFilter value={statusFilter} onChange={(value) => { setStatusFilter(value); setPage(1) }} label="Status" options={[{ value: 'all', label: 'All statuses' }, { value: 'available', label: 'Available' }, { value: 'reserved', label: 'Reserved' }, { value: 'charging', label: 'Charging' }, { value: 'offline', label: 'Offline' }, { value: 'maintenance', label: 'Maintenance' }]} />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        minWidth={820}
        empty={<TableEmpty title="No equipment in this view" description="Adjust filters, or wait for operators to add chargers." />}
        mobileRender={({ charger, station }) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[12.5px] font-semibold text-midnight-900">{charger.name}</p>
                <p className="font-mono text-[9px] text-muted">{charger.charger_code}</p>
              </div>
              <Badge tone={STATUS_TONE[charger.status]}>{charger.status}</Badge>
            </div>
            <p className="mt-1.5 text-[10px] text-muted">{station.name} · {station.city}</p>
            <div className="mt-2 flex items-center justify-between border-t border-midnight-900/[0.06] pt-2 text-[10px]">
              <span className="text-charcoal-600">{connectorLabels[charger.connector_type]} · {charger.capacity_kw} kW</span>
              <span className="font-mono text-midnight-900">{formatNaira(charger.price_per_kwh)}/kWh</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <select value={charger.status} onChange={(event) => void updateStatus(charger, event.target.value as Charger['status'])} className="h-8 rounded-lg border border-midnight-900/10 bg-white px-2 text-[10px]">
                <option value="available">Available</option>
                <option value="offline">Offline</option>
                <option value="maintenance">Maintenance</option>
              </select>
              <Link to={`/stations/${station.slug}`} className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-lime-700">Station <ArrowUpRight className="h-3 w-3" /></Link>
            </div>
          </div>
        )}
      />
      <Pagination page={page} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={14} />

      <div className="flex items-start gap-2 rounded-2xl border border-midnight-900/[0.07] bg-white px-4 py-3.5">
        <BatteryCharging className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" />
        <p className="text-[10.5px] leading-relaxed text-charcoal-500">
          Status changes are logged against your admin account. Operators are responsible for physical availability; use
          this override only for safety, outages or verification issues.
        </p>
      </div>
    </div>
  )
}
