import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock, Clock, Copy, Info, PlugZap, Save, ShieldCheck } from 'lucide-react'
import { useOperatorData } from '@/hooks/useOperatorData'
import { listAvailability, saveAvailability } from '@/services/operator'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader, SectionCard } from '@/components/ui/Data'
import { Button } from '@/components/ui/Button'
import { Field, Select } from '@/components/ui/Form'
import { EmptyState, PageLoader, useToast } from '@/components/ui/Feedback'
import { InfoNote } from '@/components/dashboard/Kit'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cn } from '@/lib/utils'
import type { ChargerAvailability } from '@/types'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

export default function AvailabilityPage() {
  const { stations, operatorId, isLoading } = useOperatorData()
  const [params] = useSearchParams()
  const { isPreview } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [stationId, setStationId] = useState(params.get('station') ?? stations[0]?.id ?? '')
  const [chargerId, setChargerId] = useState('')
  const [rows, setRows] = useState<ChargerAvailability[]>([])
  const [saving, setSaving] = useState(false)
  usePageTitle('Manage availability')

  const chargers = useMemo(() => stations.find((station) => station.id === stationId)?.chargers ?? [], [stations, stationId])
  const activeCharger = chargers.find((charger) => charger.id === chargerId)

  useEffect(() => {
    if (!stationId && stations.length) setStationId(stations[0].id)
  }, [stations, stationId])

  useEffect(() => {
    if (chargers.length && !chargers.some((charger) => charger.id === chargerId)) {
      setChargerId(chargers[0].id)
    }
    if (!chargers.length) setChargerId('')
  }, [chargers, chargerId])

  const availabilityQuery = useQuery({
    queryKey: ['charger-availability', chargerId],
    queryFn: () => listAvailability(chargerId),
    enabled: Boolean(chargerId),
  })

  useEffect(() => {
    if (!availabilityQuery.data) return
    const map = new Map(availabilityQuery.data.map((row) => [row.day_of_week, row]))
    setRows(
      Array.from({ length: 7 }).map((_, day) =>
        map.get(day) ?? {
          id: `${chargerId}-${day}`,
          charger_id: chargerId,
          day_of_week: day,
          opens_at: '06:00',
          closes_at: '22:00',
          is_closed: false,
        },
      ),
    )
  }, [availabilityQuery.data, chargerId])

  const update = (day: number, patch: Partial<ChargerAvailability>) => {
    setRows((current) => current.map((row) => (row.day_of_week === day ? { ...row, ...patch } : row)))
  }

  const applyMonday = () => {
    const monday = rows.find((row) => row.day_of_week === 1)
    if (!monday) return
    setRows((current) => current.map((row) => (row.day_of_week === 0 || row.day_of_week === 6 ? row : { ...row, opens_at: monday.opens_at, closes_at: monday.closes_at, is_closed: monday.is_closed })))
    toast.info('Applied Monday hours', 'Tuesday to Friday updated. Weekend hours were left unchanged.')
  }

  const save = async () => {
    if (!chargerId) return
    const invalid = rows.find((row) => !row.is_closed && row.opens_at >= row.closes_at)
    if (invalid) {
      toast.error('Check opening hours', `${DAYS[invalid.day_of_week]} closes before it opens.`)
      return
    }
    setSaving(true)
    try {
      await saveAvailability(rows)
      await queryClient.invalidateQueries({ queryKey: ['charger-availability', chargerId] })
      if (isPreview) {
        toast.info('Schedule validated', 'Preview mode does not persist changes. Connect Supabase to save live availability.')
      } else {
        toast.success('Availability saved', 'The new weekly schedule applies to future bookings immediately.')
      }
    } catch (error) {
      toast.error('Could not save availability', (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <PageLoader label="Loading availability" />
  if (!stations.length) {
    return (
      <EmptyState
        icon={<PlugZap className="h-6 w-6" />}
        title="No stations to schedule"
        description="Add a station and at least one charger before setting weekly availability."
      />
    )
  }

  const openDays = rows.filter((row) => !row.is_closed).length
  const weeklyHours = rows.filter((row) => !row.is_closed).reduce((total, row) => {
    const [openH, openM] = row.opens_at.split(':').map(Number)
    const [closeH, closeM] = row.closes_at.split(':').map(Number)
    return total + Math.max(0, closeH * 60 + closeM - (openH * 60 + openM)) / 60
  }, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Manage availability"
        description="Control the hours each charger can be booked. Slots outside these windows are never offered to drivers."
        actions={<Button loading={saving} onClick={save} disabled={!chargerId}><Save className="h-4 w-4" /> Save schedule</Button>}
      />

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <SectionCard title="Select equipment" description="Only chargers attached to your stations can be scheduled.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Station" required>
                <Select value={stationId} onChange={(event) => setStationId(event.target.value)}>
                  {stations.map((station) => <option key={station.id} value={station.id}>{station.name} — {station.city}</option>)}
                </Select>
              </Field>
              <Field label="Charger" required>
                <Select value={chargerId} onChange={(event) => setChargerId(event.target.value)}>
                  {chargers.length ? chargers.map((charger) => <option key={charger.id} value={charger.id}>{charger.name} · {charger.charger_code}</option>) : <option value="">No chargers at this station</option>}
                </Select>
              </Field>
            </div>
            {!chargers.length && (
              <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-[11px] text-amber-800">
                This station has no chargers yet. Add equipment first, then set its availability.
              </div>
            )}
          </SectionCard>

          {chargerId ? (
            <SectionCard
              title="Weekly schedule"
              description={activeCharger ? `${activeCharger.name} · times are West Africa Time (WAT)` : 'Times are West Africa Time (WAT)'}
              action={<Button variant="outline" size="sm" onClick={applyMonday} disabled={!rows.length}><Copy className="h-3.5 w-3.5" /> Copy Monday to weekdays</Button>}
            >
              {availabilityQuery.isLoading ? (
                <div className="space-y-2">{Array.from({ length: 7 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-charcoal-50" />)}</div>
              ) : (
                <div className="space-y-2">
                  {WEEK_ORDER.map((day) => {
                    const row = rows.find((item) => item.day_of_week === day)
                    if (!row) return null
                    return (
                      <div key={day} className={cn('flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3', row.is_closed ? 'border-charcoal-100 bg-charcoal-50/60' : 'border-midnight-900/[0.07] bg-white')}>
                        <div className="flex min-w-[110px] items-center gap-2.5">
                          <span className={cn('grid h-8 w-8 place-items-center rounded-lg', row.is_closed ? 'bg-white text-charcoal-300' : 'bg-mint text-midnight-800')}><CalendarClock className="h-3.5 w-3.5" /></span>
                          <div>
                            <p className={cn('text-[12px] font-semibold', row.is_closed ? 'text-charcoal-400' : 'text-midnight-900')}>{DAYS[day]}</p>
                            <p className="text-[9px] text-muted">{row.is_closed ? 'Closed all day' : 'Open for bookings'}</p>
                          </div>
                        </div>
                        <div className="flex flex-1 items-center gap-2">
                          <input
                            type="time"
                            value={row.opens_at}
                            disabled={row.is_closed}
                            onChange={(event) => update(day, { opens_at: event.target.value })}
                            className="h-9 flex-1 rounded-xl border border-midnight-900/10 bg-white px-2 font-mono text-[11px] text-charcoal-700 outline-none focus:border-lime-500 focus:ring-2 focus:ring-lime/30 disabled:opacity-40"
                          />
                          <span className="text-[10px] text-muted">to</span>
                          <input
                            type="time"
                            value={row.closes_at}
                            disabled={row.is_closed}
                            onChange={(event) => update(day, { closes_at: event.target.value })}
                            className="h-9 flex-1 rounded-xl border border-midnight-900/10 bg-white px-2 font-mono text-[11px] text-charcoal-700 outline-none focus:border-lime-500 focus:ring-2 focus:ring-lime/30 disabled:opacity-40"
                          />
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 text-[10.5px] font-medium text-charcoal-600">
                          <input type="checkbox" checked={row.is_closed} onChange={(event) => update(day, { is_closed: event.target.checked })} className="h-4 w-4 rounded border-midnight-900/20 text-lime focus:ring-lime" />
                          Closed
                        </label>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-mint-50 px-4 py-3">
                <span className="flex items-center gap-1.5 text-[10.5px] text-charcoal-600"><Clock className="h-3.5 w-3.5" /> {openDays} open days · {weeklyHours.toFixed(1)} bookable hours/week</span>
                <Button size="sm" loading={saving} onClick={save}><Save className="h-3.5 w-3.5" /> Save</Button>
              </div>
            </SectionCard>
          ) : (
            <EmptyState
              icon={<Clock className="h-6 w-6" />}
              title="Choose a charger"
              description="Select a station and charger above to set its weekly bookable hours."
            />
          )}
        </div>

        <div className="space-y-4">
          <InfoNote title="How availability affects bookings">
            Drivers can only start a session inside these hours. The last bookable slot ends 30 minutes before closing.
            Existing paid bookings are not cancelled if you shorten your hours later.
          </InfoNote>
          <SectionCard title="Scheduling rules">
            <ul className="space-y-3">
              {[
                { title: '30-minute slots', text: 'Bookings are generated in 30-minute increments.' },
                { title: 'Buffer time', text: 'The final slot must end before closing time.' },
                { title: 'Overnight sessions', text: 'Split overnight availability into two windows on separate days.' },
                { title: 'Maintenance', text: 'Set the charger to maintenance to stop new bookings immediately.' },
              ].map((rule) => (
                <li key={rule.title} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-lime/25 text-midnight-800"><ShieldCheck className="h-3 w-3" /></span>
                  <div>
                    <p className="text-[11.5px] font-semibold text-midnight-900">{rule.title}</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{rule.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
          <div className="rounded-3xl bg-midnight-950 p-5 text-white">
            <Info className="h-4 w-4 text-lime" />
            <p className="mt-2 text-[12px] font-semibold">Time zone reminder</p>
            <p className="mt-1 text-[10px] leading-relaxed text-white/45">
              All times are stored and displayed in West Africa Time (UTC+1). If your site operates on generator backup,
              leave a maintenance buffer after power transitions.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
