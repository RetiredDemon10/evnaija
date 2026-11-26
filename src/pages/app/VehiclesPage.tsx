import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BatteryCharging, Car, Check, Pencil, Plus, Trash2, Zap } from 'lucide-react'
import { deleteVehicle, listVehicles, saveVehicle } from '@/services/bookings'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Field, Input, Select } from '@/components/ui/Form'
import { PageHeader } from '@/components/ui/Data'
import { EmptyState, PageLoader } from '@/components/ui/Feedback'
import { InfoNote } from '@/components/dashboard/Kit'
import { usePageTitle } from '@/hooks/usePageTitle'
import { CONNECTOR_OPTIONS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { ConnectorType, Vehicle } from '@/types'
import { cn } from '@/lib/utils'

const CURRENT_YEAR = new Date().getFullYear()

export default function VehiclesPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [deleting, setDeleting] = useState<Vehicle | null>(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  usePageTitle('My vehicles')

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles', user?.id],
    queryFn: () => listVehicles(user?.id),
    enabled: Boolean(user?.id),
  })

  const [form, setForm] = useState({
    manufacturer: '',
    model: '',
    year: CURRENT_YEAR,
    registration_number: '',
    battery_capacity_kwh: 60,
    connector_type: 'ccs2' as ConnectorType,
    is_primary: false,
  })

  const startCreate = () => {
    setEditing(null)
    setForm({
      manufacturer: '',
      model: '',
      year: CURRENT_YEAR,
      registration_number: '',
      battery_capacity_kwh: 60,
      connector_type: 'ccs2',
      is_primary: vehicles.length === 0,
    })
    setOpen(true)
  }

  const startEdit = (vehicle: Vehicle) => {
    setEditing(vehicle)
    setForm({
      manufacturer: vehicle.manufacturer,
      model: vehicle.model,
      year: vehicle.year,
      registration_number: vehicle.registration_number ?? '',
      battery_capacity_kwh: vehicle.battery_capacity_kwh,
      connector_type: vehicle.connector_type,
      is_primary: vehicle.is_primary,
    })
    setOpen(true)
  }

  const handleSave = async () => {
    if (!form.manufacturer.trim() || !form.model.trim()) {
      toast.error('Vehicle details missing', 'Manufacturer and model are required.')
      return
    }
    if (form.battery_capacity_kwh <= 0 || form.battery_capacity_kwh > 300) {
      toast.error('Check battery size', 'Enter a battery capacity between 1 and 300 kWh.')
      return
    }
    setSaving(true)
    try {
      await saveVehicle(
        {
          ...form,
          registration_number: form.registration_number.trim() || null,
          manufacturer: form.manufacturer.trim(),
          model: form.model.trim(),
          ...(editing ? { id: editing.id } : {}),
        },
        user?.id,
      )
      await queryClient.invalidateQueries({ queryKey: ['vehicles', user?.id] })
      toast.success(editing ? 'Vehicle updated' : 'Vehicle added', 'It will be available when you book your next session.')
      setOpen(false)
    } catch (error) {
      toast.error('Could not save vehicle', (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setRemoving(true)
    try {
      await deleteVehicle(deleting.id)
      await queryClient.invalidateQueries({ queryKey: ['vehicles', user?.id] })
      toast.success('Vehicle removed')
      setDeleting(null)
    } catch (error) {
      toast.error('Could not remove vehicle', (error as Error).message)
    } finally {
      setRemoving(false)
    }
  }

  if (isLoading) return <PageLoader label="Loading your garage" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Garage"
        title="My vehicles"
        description="Save the EVs you drive so we can estimate energy needs and suggest compatible chargers."
        actions={<Button onClick={startCreate}><Plus className="h-4 w-4" /> Add vehicle</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div>
          {vehicles.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {vehicles.map((vehicle) => (
                <div key={vehicle.id} className={cn('relative overflow-hidden rounded-3xl border bg-white p-5 shadow-card', vehicle.is_primary ? 'border-lime-400/70' : 'border-midnight-900/[0.07]')}>
                  {vehicle.is_primary && (
                    <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-lime px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-midnight-900"><Check className="h-2.5 w-2.5" /> Primary</span>
                  )}
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-midnight-900 text-lime"><Car className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <p className="truncate font-display text-[15px] font-semibold text-midnight-900">{vehicle.manufacturer} {vehicle.model}</p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{vehicle.year} · {vehicle.registration_number ?? 'No plate'}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-mint-50 px-3 py-2">
                      <p className="font-mono text-[12px] font-medium text-midnight-900">{vehicle.battery_capacity_kwh} kWh</p>
                      <p className="mt-0.5 text-[8.5px] uppercase tracking-[0.1em] text-muted">Battery</p>
                    </div>
                    <div className="rounded-xl bg-mint-50 px-3 py-2">
                      <p className="font-mono text-[12px] font-medium text-midnight-900">{vehicle.connector_type.toUpperCase()}</p>
                      <p className="mt-0.5 text-[8.5px] uppercase tracking-[0.1em] text-muted">Connector</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-midnight-900/[0.06] pt-3">
                    <span className="text-[9.5px] text-muted">Added {formatDate(vehicle.created_at)}</span>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(vehicle)} className="grid h-8 w-8 place-items-center rounded-lg border border-midnight-900/10 text-charcoal-600 hover:bg-mint-50" aria-label="Edit vehicle"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setDeleting(vehicle)} className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50" aria-label="Delete vehicle"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Car className="h-6 w-6" />}
              title="Your garage is empty"
              description="Add the EV you drive to get accurate energy estimates and charger compatibility."
              action={<Button onClick={startCreate}><Plus className="h-4 w-4" /> Add your first vehicle</Button>}
            />
          )}
        </div>

        <div className="space-y-4">
          <InfoNote title="Why we ask for your battery size">
            We cap the estimated energy at your battery capacity, so you are not charged for energy your vehicle cannot
            accept. The operator still bills based on delivered energy.
          </InfoNote>
          <div className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-lime/25 text-midnight-800"><BatteryCharging className="h-4 w-4" /></span>
            <h3 className="mt-3 font-display text-base font-semibold text-midnight-900">Connector compatibility</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Most Nigerian fast chargers support CCS2 and Type 2. We show compatible connectors on every station page,
              but confirm your vehicle’s inlet before booking.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {CONNECTOR_OPTIONS.map((connector) => (
                <span key={connector.value} className="rounded-lg bg-charcoal-50 px-2 py-1 font-mono text-[9.5px] text-charcoal-600">{connector.label}</span>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-midnight-950 p-5 text-white">
            <Zap className="h-4 w-4 text-lime" />
            <p className="mt-2 text-[12px] font-semibold">A full charge is not always the right charge.</p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-white/45">
              For daily driving, charging to 80% is faster and gentler on most lithium-ion packs. Use a 60–90 minute
              session rather than waiting for 100%.
            </p>
          </div>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit vehicle' : 'Add a vehicle'}
        description="These details help us estimate charging time and cost. They are not shared publicly."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSave}>{editing ? 'Save changes' : 'Add vehicle'}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Manufacturer" required>
            <Input value={form.manufacturer} onChange={(event) => setForm({ ...form, manufacturer: event.target.value })} placeholder="Tesla, BYD, Hyundai…" />
          </Field>
          <Field label="Model" required>
            <Input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder="Model 3, Atto 3, Ioniq 5…" />
          </Field>
          <Field label="Year">
            <Input type="number" min={2000} max={CURRENT_YEAR + 1} value={form.year} onChange={(event) => setForm({ ...form, year: Number(event.target.value) })} />
          </Field>
          <Field label="Registration number">
            <Input value={form.registration_number} onChange={(event) => setForm({ ...form, registration_number: event.target.value.toUpperCase() })} placeholder="LSD-834-KJ" />
          </Field>
          <Field label="Battery capacity (kWh)" required>
            <Input type="number" min={1} max={300} step={0.1} value={form.battery_capacity_kwh} onChange={(event) => setForm({ ...form, battery_capacity_kwh: Number(event.target.value) })} />
          </Field>
          <Field label="Connector type" required>
            <Select value={form.connector_type} onChange={(event) => setForm({ ...form, connector_type: event.target.value as ConnectorType })}>
              {CONNECTOR_OPTIONS.map((connector) => (
                <option key={connector.value} value={connector.value}>{connector.label}</option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-[12px] text-charcoal-600 sm:col-span-2">
            <input type="checkbox" checked={form.is_primary} onChange={(event) => setForm({ ...form, is_primary: event.target.checked })} className="h-4 w-4 rounded border-midnight-900/20 text-lime focus:ring-lime" />
            Make this my primary vehicle
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Remove this vehicle?"
        description={`${deleting?.manufacturer ?? ''} ${deleting?.model ?? ''} will be removed from your garage. Existing bookings keep their vehicle record.`}
        confirmLabel="Remove vehicle"
        danger
        loading={removing}
      />
    </div>
  )
}
