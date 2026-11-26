import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  BatteryCharging,
  Clock,
  Pencil,
  PlugZap,
  Plus,
  Search,
  Trash2,
  Zap,
} from 'lucide-react'
import { useOperatorData } from '@/hooks/useOperatorData'
import { deleteCharger, saveCharger, type ChargerInput } from '@/services/operator'
import type { Charger } from '@/types'
import { PageHeader, SectionCard } from '@/components/ui/Data'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Field, Input, Select } from '@/components/ui/Form'
import { EmptyState, PageLoader, useToast } from '@/components/ui/Feedback'
import { SelectFilter, TableEmpty } from '@/components/dashboard/Kit'
import { usePageTitle } from '@/hooks/usePageTitle'
import { CONNECTOR_OPTIONS } from '@/lib/constants'
import { connectorLabels, formatNaira, speedLabels, cn } from '@/lib/utils'

const STATUS_TONE: Record<Charger['status'], 'success' | 'warning' | 'danger' | 'neutral'> = {
  available: 'success',
  reserved: 'warning',
  charging: 'warning',
  offline: 'danger',
  maintenance: 'danger',
}

const BLANK: ChargerInput = {
  station_id: '',
  name: '',
  charger_code: '',
  connector_type: 'ccs2',
  capacity_kw: 60,
  speed_category: 'fast',
  connector_count: 1,
  price_per_kwh: 180,
  booking_fee: 500,
  status: 'available',
  is_active: true,
}

export default function ChargersPage() {
  const { stations, operatorId, isLoading } = useOperatorData()
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [stationFilter, setStationFilter] = useState(params.get('station') ?? 'all')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Charger | null>(null)
  const [deleting, setDeleting] = useState<Charger | null>(null)
  const [form, setForm] = useState<ChargerInput>(BLANK)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  usePageTitle('Charging equipment')

  const allChargers = useMemo(
    () => stations.flatMap((station) => station.chargers.map((charger) => ({ charger, station }))),
    [stations],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return allChargers.filter(({ charger, station }) => {
      const matchesStation = stationFilter === 'all' || station.id === stationFilter
      const matchesStatus = statusFilter === 'all' || charger.status === statusFilter
      const matchesTerm = !term || charger.name.toLowerCase().includes(term) || charger.charger_code.toLowerCase().includes(term) || station.name.toLowerCase().includes(term)
      return matchesStation && matchesStatus && matchesTerm
    })
  }, [allChargers, stationFilter, statusFilter, search])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...BLANK, station_id: stations[0]?.id ?? '' })
    setOpen(true)
  }

  const openEdit = (charger: Charger) => {
    setEditing(charger)
    setForm({
      station_id: charger.station_id,
      name: charger.name,
      charger_code: charger.charger_code,
      connector_type: charger.connector_type,
      capacity_kw: charger.capacity_kw,
      speed_category: charger.speed_category,
      connector_count: charger.connector_count,
      price_per_kwh: charger.price_per_kwh,
      booking_fee: charger.booking_fee,
      status: charger.status,
      is_active: charger.is_active,
    })
    setOpen(true)
  }

  const save = async () => {
    if (!form.station_id || form.name.trim().length < 2 || form.charger_code.trim().length < 2) {
      toast.error('Missing charger details', 'Station, charger name and code are required.')
      return
    }
    if (form.price_per_kwh <= 0 || form.capacity_kw <= 0) {
      toast.error('Check pricing and capacity', 'Price per kWh and capacity must be greater than zero.')
      return
    }
    setSaving(true)
    try {
      await saveCharger({ ...form, name: form.name.trim(), charger_code: form.charger_code.trim(), ...(editing ? { id: editing.id } : {}) })
      await queryClient.invalidateQueries({ queryKey: ['operator-stations', operatorId] })
      await queryClient.invalidateQueries({ queryKey: ['operator-stats', operatorId] })
      toast.success(editing ? 'Charger updated' : 'Charger added', 'Drivers will see the updated details immediately.')
      setOpen(false)
    } catch (error) {
      toast.error('Could not save charger', (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleting) return
    setRemoving(true)
    try {
      await deleteCharger(deleting.id)
      await queryClient.invalidateQueries({ queryKey: ['operator-stations', operatorId] })
      await queryClient.invalidateQueries({ queryKey: ['operator-stats', operatorId] })
      toast.success('Charger removed')
      setDeleting(null)
    } catch (error) {
      toast.error('Could not remove charger', (error as Error).message)
    } finally {
      setRemoving(false)
    }
  }

  if (isLoading) return <PageLoader label="Loading chargers" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Equipment"
        title="Charging equipment"
        description="Every physical charging point, its connector, speed and price. Keep status accurate so drivers see live availability."
        actions={
          <>
            <a href="#charger-list" className="inline-flex h-10 items-center rounded-xl border border-midnight-900/10 px-4 text-[11px] font-semibold text-charcoal-600 hover:bg-mint-50">View list</a>
            <Button onClick={openCreate} disabled={!stations.length}><Plus className="h-4 w-4" /> Add charger</Button>
          </>
        }
      />

      {!stations.length ? (
        <EmptyState
          icon={<PlugZap className="h-6 w-6" />}
          title="Add a station first"
          description="Chargers belong to a station. Create a location, then add the physical charging points."
          action={<a href="/operator/stations/new" className="inline-flex h-10 items-center rounded-xl bg-midnight-900 px-4 text-[12px] font-semibold text-lime">Add station</a>}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: 'Total chargers', value: allChargers.length, icon: PlugZap, hint: 'Across all stations' },
              { label: 'Available now', value: allChargers.filter(({ charger }) => charger.status === 'available').length, icon: Zap, hint: 'Ready to accept a session' },
              { label: 'In use', value: allChargers.filter(({ charger }) => ['charging', 'reserved'].includes(charger.status)).length, icon: BatteryCharging, hint: 'Reserved or charging' },
              { label: 'Needs attention', value: allChargers.filter(({ charger }) => ['offline', 'maintenance'].includes(charger.status)).length, icon: Clock, hint: 'Offline or maintenance' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{stat.label}</p>
                  <stat.icon className="h-4 w-4 text-midnight-700" />
                </div>
                <p className="mt-2 font-mono text-xl font-medium text-midnight-900">{stat.value}</p>
                <p className="mt-0.5 text-[9.5px] text-muted">{stat.hint}</p>
              </div>
            ))}
          </div>

          <SectionCard padded={false} title="All chargers" description="Status reflects the live operational state.">
            <div id="charger-list" className="flex flex-col gap-3 border-b border-midnight-900/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search charger, code or station" className="input-base h-10 pl-9 text-[12px]" />
              </div>
              <div className="flex flex-wrap gap-2">
                <SelectFilter value={stationFilter} onChange={setStationFilter} label="Station" options={[{ value: 'all', label: 'All stations' }, ...stations.map((station) => ({ value: station.id, label: station.name }))]} />
                <SelectFilter
                  value={statusFilter}
                  onChange={setStatusFilter}
                  label="Status"
                  options={[
                    { value: 'all', label: 'All statuses' },
                    { value: 'available', label: 'Available' },
                    { value: 'reserved', label: 'Reserved' },
                    { value: 'charging', label: 'Charging' },
                    { value: 'offline', label: 'Offline' },
                    { value: 'maintenance', label: 'Maintenance' },
                  ]}
                />
              </div>
            </div>

            {filtered.length ? (
              <div className="divide-y divide-midnight-900/[0.06]">
                {filtered.map(({ charger, station }) => (
                  <div key={charger.id} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-mint-50/50 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', charger.status === 'available' ? 'bg-lime/25 text-midnight-800' : 'bg-charcoal-50 text-charcoal-500')}>
                        <PlugZap className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-[13px] font-semibold text-midnight-900">{charger.name}</p>
                          <Badge tone={STATUS_TONE[charger.status]}>{charger.status}</Badge>
                          {!charger.is_active && <Badge tone="neutral">inactive</Badge>}
                        </div>
                        <p className="mt-0.5 font-mono text-[10px] text-muted">{charger.charger_code} · {station.name} · {station.city}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <span className="rounded-md bg-charcoal-50 px-1.5 py-0.5 font-mono text-[9px] text-charcoal-600">{connectorLabels[charger.connector_type]}</span>
                          <span className="rounded-md bg-charcoal-50 px-1.5 py-0.5 font-mono text-[9px] text-charcoal-600">{charger.capacity_kw} kW · {speedLabels[charger.speed_category]}</span>
                          <span className="rounded-md bg-charcoal-50 px-1.5 py-0.5 font-mono text-[9px] text-charcoal-600">{charger.connector_count} connector{charger.connector_count === 1 ? '' : 's'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 pl-[52px] lg:justify-end lg:pl-0">
                      <div className="text-left lg:text-right">
                        <p className="font-mono text-[12.5px] font-medium text-midnight-900">{formatNaira(charger.price_per_kwh)}<span className="text-[9px] text-muted">/kWh</span></p>
                        <p className="text-[9.5px] text-muted">+ {formatNaira(charger.booking_fee)} booking fee</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(charger)} className="grid h-8 w-8 place-items-center rounded-lg border border-midnight-900/10 text-charcoal-600 hover:bg-white" aria-label="Edit charger"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setDeleting(charger)} className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50" aria-label="Delete charger"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4"><TableEmpty title="No chargers match this view" description="Adjust the filters or add a new charger to this station." action={<Button size="sm" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> Add charger</Button>} /></div>
            )}
          </SectionCard>
        </>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit charger' : 'Add a charger'}
        description="Enter the physical equipment details. Prices include energy only; the booking fee is added at checkout."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={save}>{editing ? 'Save charger' : 'Add charger'}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Station" required className="sm:col-span-2">
            <Select value={form.station_id} onChange={(event) => setForm({ ...form, station_id: event.target.value })}>
              <option value="">Choose a station</option>
              {stations.map((station) => <option key={station.id} value={station.id}>{station.name} — {station.city}</option>)}
            </Select>
          </Field>
          <Field label="Charger name" required>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Bay A · Fast charger" />
          </Field>
          <Field label="Charger code" required hint="Unique asset code printed on the unit.">
            <Input value={form.charger_code} onChange={(event) => setForm({ ...form, charger_code: event.target.value.toUpperCase() })} placeholder="LPH-A-FAST-01" />
          </Field>
          <Field label="Connector type" required>
            <Select value={form.connector_type} onChange={(event) => setForm({ ...form, connector_type: event.target.value as ChargerInput['connector_type'] })}>
              {CONNECTOR_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </Field>
          <Field label="Speed category" required>
            <Select value={form.speed_category} onChange={(event) => setForm({ ...form, speed_category: event.target.value as ChargerInput['speed_category'] })}>
              <option value="slow">Slow (up to 7 kW)</option>
              <option value="fast">Fast (7–50 kW)</option>
              <option value="rapid">Rapid (50–150 kW)</option>
              <option value="ultra">Ultra (150 kW+)</option>
            </Select>
          </Field>
          <Field label="Capacity (kW)" required>
            <Input type="number" min={1} max={500} value={form.capacity_kw} onChange={(event) => setForm({ ...form, capacity_kw: Number(event.target.value) })} />
          </Field>
          <Field label="Connectors available" required>
            <Input type="number" min={1} max={12} value={form.connector_count} onChange={(event) => setForm({ ...form, connector_count: Number(event.target.value) })} />
          </Field>
          <Field label="Price per kWh (₦)" required>
            <Input type="number" min={1} value={form.price_per_kwh} onChange={(event) => setForm({ ...form, price_per_kwh: Number(event.target.value) })} />
          </Field>
          <Field label="Booking fee (₦)" required>
            <Input type="number" min={0} value={form.booking_fee} onChange={(event) => setForm({ ...form, booking_fee: Number(event.target.value) })} />
          </Field>
          <Field label="Status" required>
            <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ChargerInput['status'] })}>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="charging">Charging</option>
              <option value="offline">Offline</option>
              <option value="maintenance">Maintenance</option>
            </Select>
          </Field>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-[12px] text-charcoal-600">
              <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} className="h-4 w-4 rounded border-midnight-900/20 text-lime focus:ring-lime" />
              Visible to drivers
            </label>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Remove this charger?"
        description={`${deleting?.name ?? 'This charger'} will be removed from the station. Existing bookings keep their historical record.`}
        confirmLabel="Remove charger"
        danger
        loading={removing}
      />
    </div>
  )
}
