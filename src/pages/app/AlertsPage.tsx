import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellRing, CalendarClock, MapPin, Plus, Tag, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { cancelPriceAlert, createPriceAlert, deletePriceAlert, listPriceAlerts } from '@/services/alerts'
import { fetchStations } from '@/services/stations'
import { PageHeader, SectionCard } from '@/components/ui/Data'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Form'
import { EmptyState, PageLoader, useToast } from '@/components/ui/Feedback'
import { InfoNote } from '@/components/dashboard/Kit'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatNaira, relativeTime } from '@/lib/utils'
import type { PriceAlertKind } from '@/types'

export default function AlertsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  usePageTitle('Price & availability alerts')

  const userId = user?.id ?? ''
  const [stationId, setStationId] = useState('')
  const [kind, setKind] = useState<PriceAlertKind>('price_drop')
  const [target, setTarget] = useState('180')
  const [creating, setCreating] = useState(false)

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['price-alerts', userId],
    queryFn: () => listPriceAlerts(userId),
    enabled: Boolean(userId),
  })
  const { data: stations = [] } = useQuery({ queryKey: ['alerts-stations'], queryFn: () => fetchStations({}) })

  const selectedStation = stations.find((station) => station.id === stationId)
  const stationPrices = selectedStation?.chargers.map((charger) => charger.price_per_kwh) ?? []
  const lowestPrice = stationPrices.length ? Math.min(...stationPrices) : null

  const create = async () => {
    if (!stationId) {
      toast.error('Choose a station first')
      return
    }
    if (kind === 'price_drop' && (!Number(target) || Number(target) <= 0)) {
      toast.error('Enter the price you would like to pay')
      return
    }
    setCreating(true)
    try {
      await createPriceAlert(userId, {
        stationId,
        kind,
        targetPrice: kind === 'price_drop' ? Number(target) : null,
      })
      await queryClient.invalidateQueries({ queryKey: ['price-alerts', userId] })
      toast.success('Alert saved', kind === 'price_drop' ? `We will notify you when the price drops below ${formatNaira(Number(target))}/kWh.` : 'We will notify you as soon as a charger frees up.')
      setStationId('')
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const cancel = async (id: string) => {
    try {
      await cancelPriceAlert(id)
      await queryClient.invalidateQueries({ queryKey: ['price-alerts', userId] })
      toast.info('Alert cancelled')
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  const remove = async (id: string) => {
    try {
      await deletePriceAlert(id)
      await queryClient.invalidateQueries({ queryKey: ['price-alerts', userId] })
      toast.success('Alert removed')
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  if (isLoading) return <PageLoader label="Loading your alerts…" />

  const active = alerts.filter((alert) => alert.status === 'active')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Price & availability alerts"
        description="Tell us the price you want to pay, or ask to be told the moment a charger frees up."
        eyebrow="Smart charging"
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Your alerts" description={`${active.length} active`}>
          {alerts.length ? (
            <ul className="space-y-3">
              {alerts.map((alert) => (
                <li
                  key={alert.id}
                  className="flex flex-col gap-3 rounded-2xl border border-midnight-900/[0.07] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint text-midnight-800">
                      {alert.kind === 'price_drop' ? <Tag className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-midnight-900">{alert.station?.name ?? 'Station'}</p>
                      <p className="flex items-center gap-1.5 text-[11px] text-muted">
                        <MapPin className="h-3 w-3" /> {alert.station?.city ?? '—'}
                        <span aria-hidden>·</span>
                        {alert.kind === 'price_drop'
                          ? `Notify below ${formatNaira(alert.target_price ?? 0)}/kWh`
                          : 'Notify when a charger frees up'}
                      </p>
                      <p className="mt-1 text-[11px] text-muted">
                        {alert.status === 'active' ? `Added ${relativeTime(alert.created_at)}` : `Cancelled ${relativeTime(alert.created_at)}`}
                        {alert.last_notified_at ? ` · last notified ${relativeTime(alert.last_notified_at)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={alert.status === 'active' ? 'success' : alert.status === 'triggered' ? 'lime' : 'neutral'}>
                      {alert.status}
                    </Badge>
                    {alert.status === 'active' ? (
                      <Button variant="outline" size="sm" onClick={() => cancel(alert.id)}>
                        Cancel
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => remove(alert.id)} aria-label="Remove alert">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<BellRing className="h-5 w-5" />}
              title="No alerts yet"
              description="Create your first alert and we will watch prices and availability for you."
            />
          )}
        </SectionCard>

        <SectionCard title="Create an alert" description="Pick a station and what you want to be told about.">
          <div className="space-y-4">
            <Field label="Station" required>
              <Select value={stationId} onChange={(event) => setStationId(event.target.value)}>
                <option value="">Choose a station…</option>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.name} — {station.city}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Alert type">
              <Select value={kind} onChange={(event) => setKind(event.target.value as PriceAlertKind)}>
                <option value="price_drop">Price drop</option>
                <option value="availability">Charger availability</option>
              </Select>
            </Field>

            {kind === 'price_drop' && (
              <Field
                label="Target price (₦ per kWh)"
                hint={lowestPrice !== null ? `Lowest listed price: ${formatNaira(lowestPrice)}/kWh` : 'We will notify you when any charger at the station drops below this.'}
              >
                <Input type="number" min={1} value={target} onChange={(event) => setTarget(event.target.value)} />
              </Field>
            )}

            <Button variant="dark" onClick={create} loading={creating} className="w-full">
              <Plus className="h-4 w-4" /> Save alert
            </Button>

            <InfoNote title="How alerts reach you">
              Price and availability alerts are delivered through the channels you enable in your notification settings (email, SMS or WhatsApp).
            </InfoNote>

            <Link to="/stations" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-lime-700 hover:underline">
              <Bell className="h-3.5 w-3.5" /> Browse stations to set more alerts
            </Link>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
