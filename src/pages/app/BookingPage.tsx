import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import {
  ArrowLeft,
  BellRing,
  CalendarCheck,
  Car,
  Check,
  Clock,
  Coins,
  CreditCard,
  MapPin,
  PlugZap,
  Repeat2,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { createBooking, createBookingSeries, createGuestBooking, listVehicles } from '@/services/bookings'
import { applyCreditToBooking, getLoyaltyAccount } from '@/services/rewards'
import { joinWaitlist, listWaitlist } from '@/services/waitlist'
import { fetchAvailableSlots, fetchStation } from '@/services/stations'
import type { BookingFrequency, Charger, Station, Vehicle } from '@/types'
import { quoteBooking } from '@/lib/pricing'
import { formatSchedulePreview, recurrenceLabels } from '@/lib/recurrence'
import { connectorLabels, formatNaira, speedLabels, cn, formatDate } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useToast } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageLoader, ErrorState } from '@/components/ui/Feedback'
import { Field, Input, Select } from '@/components/ui/Form'
import { InfoNote } from '@/components/dashboard/Kit'
import { SmartImage } from '@/components/common/SmartImage'

const DURATIONS = [30, 60, 90, 120, 180]

export default function BookingPage() {
  const { stationId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const initialCharger = searchParams.get('charger') ?? ''
  const requestedDate = searchParams.get('date') ?? ''

  const [chargerId, setChargerId] = useState(initialCharger)
  const [date, setDate] = useState(() =>
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : format(new Date(), 'yyyy-MM-dd'),
  )
  const [slotStart, setSlotStart] = useState('')
  const [duration, setDuration] = useState(60)
  const [vehicleId, setVehicleId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [recurring, setRecurring] = useState(false)
  const [frequency, setFrequency] = useState<BookingFrequency>('weekly')
  const [occurrences, setOccurrences] = useState(4)
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [preferredTime, setPreferredTime] = useState('')
  const [joiningWaitlist, setJoiningWaitlist] = useState(false)
  const [useCredit, setUseCredit] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestAcceptedTerms, setGuestAcceptedTerms] = useState(false)

  // Guests reserve without an account: the server provisions a guest profile
  // and returns a per-booking token. Signed-in customers use the normal flow.
  const guestMode = !user
  const guestEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(guestEmail.trim())
  const guestPhoneValid = /^(\+?234|0)[789][01]\d{8}$/.test(guestPhone.replace(/\s+/g, ''))
  const guestDetailsValid = guestName.trim().length >= 3 && guestEmailValid && guestPhoneValid

  const stationQuery = useQuery({
    queryKey: ['station', stationId],
    queryFn: () => fetchStation(stationId),
    enabled: Boolean(stationId),
  })
  const vehiclesQuery = useQuery({
    queryKey: ['vehicles', user?.id],
    queryFn: () => listVehicles(user?.id),
    enabled: Boolean(user?.id),
  })
  const waitlistQuery = useQuery({
    queryKey: ['waitlist', user?.id],
    queryFn: () => listWaitlist(user?.id),
    enabled: Boolean(user?.id),
  })
  const loyaltyQuery = useQuery({
    queryKey: ['loyalty-account', user?.id],
    queryFn: () => getLoyaltyAccount(user!.id),
    enabled: Boolean(user?.id),
  })

  const station = stationQuery.data
  const vehicles = vehiclesQuery.data ?? []
  const chargers = useMemo(
    () => station?.chargers.filter((charger) => charger.is_active && ['available', 'reserved', 'charging'].includes(charger.status)) ?? [],
    [station],
  )
  const selectedCharger: Charger | undefined = chargers.find((charger) => charger.id === chargerId) ?? chargers[0]
  const effectiveChargerId = selectedCharger?.id ?? ''

  const slotsQuery = useQuery({
    queryKey: ['slots', effectiveChargerId, date],
    queryFn: () => fetchAvailableSlots(effectiveChargerId, date),
    enabled: Boolean(effectiveChargerId),
  })

  const vehicle: Vehicle | undefined = vehicles.find((item) => item.id === vehicleId)
  const quote = selectedCharger ? quoteBooking(selectedCharger, duration, vehicle) : null
  const rewardCredit = loyaltyQuery.data?.credit_balance ?? 0
  const creditCap = quote ? quote.serviceFee + quote.taxAmount : 0
  const creditApplied = useCredit && quote ? Math.min(rewardCredit, creditCap, quote.totalAmount) : 0
  const payableTotal = quote ? Math.max(0, quote.totalAmount - creditApplied) : 0

  usePageTitle(station ? `Book ${station.name}` : 'Book a charger')

  const dateOptions = Array.from({ length: 10 }).map((_, index) => {
    const value = addDays(new Date(), index)
    return {
      value: format(value, 'yyyy-MM-dd'),
      day: format(value, 'EEE'),
      date: format(value, 'dd'),
      month: format(value, 'MMM'),
    }
  })
  if (!dateOptions.some((option) => option.value === date)) {
    const requested = new Date(`${date}T12:00:00`)
    if (!Number.isNaN(requested.getTime())) {
      dateOptions.unshift({
        value: date,
        day: format(requested, 'EEE'),
        date: format(requested, 'dd'),
        month: format(requested, 'MMM'),
      })
    }
  }

  const slots = slotsQuery.data ?? []
  const slotIndex = slots.findIndex((slot) => slot.start === slotStart)
  const requiredSlots = Math.ceil(duration / 30)
  const slotRun = slotIndex >= 0 ? slots.slice(slotIndex, slotIndex + requiredSlots) : []
  const slotValid = slotIndex >= 0 && slotRun.length === requiredSlots && slotRun.every((slot) => slot.available)
  const hasAvailability = slots.some((slot) => slot.available)
  const existingWaitlist = (waitlistQuery.data ?? []).find(
    (entry) =>
      entry.station_id === stationId &&
      entry.desired_date === date &&
      (entry.status === 'pending' || entry.status === 'notified') &&
      (entry.charger_id === null || entry.charger_id === effectiveChargerId),
  )
  const schedulePreview = slotValid
    ? formatSchedulePreview(slotStart, frequency, Math.min(occurrences, 4))
    : []

  const handleBook = async () => {
    if (!selectedCharger || !slotStart) return
    if (!slotValid) {
      toast.error('Choose an available slot', 'The selected time is too close to another reservation or the station closing time.')
      return
    }
    const input = {
      stationId: stationId,
      chargerId: selectedCharger.id,
      vehicleId: vehicleId || null,
      startTime: slotStart,
      durationMinutes: duration,
    }

    if (guestMode) {
      if (!guestDetailsValid) {
        toast.error('Check your details', 'Enter your name, a valid email address and a Nigerian mobile number to reserve as a guest.')
        return
      }
      if (!guestAcceptedTerms) {
        toast.error('Accept the terms', 'Please accept the Terms of Service and Privacy Policy to reserve as a guest.')
        return
      }
      setSubmitting(true)
      try {
        const { booking, guestToken } = await createGuestBooking({
          ...input,
          fullName: guestName.trim(),
          email: guestEmail.trim(),
          phone: guestPhone.replace(/\s+/g, ''),
        })
        toast.success('Charger held', 'Complete payment within 15 minutes to confirm your booking.')
        navigate(`/book/confirmation/${booking.id}?token=${encodeURIComponent(guestToken)}&created=1`)
      } catch (error) {
        toast.error('Could not start guest checkout', (error as Error).message)
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!user) return
    setSubmitting(true)
    try {
      const booking = recurring
        ? await createBookingSeries({ ...input, frequency, occurrences })
        : await createBooking(input)

      if (!recurring && useCredit && creditApplied > 0) {
        try {
          await applyCreditToBooking(booking.id, user.id)
        } catch (creditError) {
          toast.info('Reward credit not applied', (creditError as Error).message)
        }
      }

      toast.success(
        recurring ? 'Recurring plan created' : 'Charger held',
        recurring
          ? 'Your first session is held. Reserve each next session from My bookings — future sessions are never charged automatically.'
          : 'Complete payment within 15 minutes to confirm your booking.',
      )
      navigate(`/app/bookings/${booking.id}?created=1${recurring ? '&series=1' : ''}`)
    } catch (error) {
      toast.error('Could not create booking', (error as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleJoinWaitlist = async () => {
    if (!user || !station) return
    setJoiningWaitlist(true)
    try {
      await joinWaitlist(
        {
          stationId: stationId,
          chargerId: effectiveChargerId || null,
          desiredDate: date,
          preferredStart: preferredTime || (slotStart ? format(new Date(slotStart), 'HH:mm') : null),
        },
        user.id,
      )
      await waitlistQuery.refetch()
      setWaitlistOpen(false)
      toast.success('You are on the waitlist', 'We will alert you here and on this device if a matching slot opens.')
    } catch (error) {
      toast.error('Could not join the waitlist', (error as Error).message)
    } finally {
      setJoiningWaitlist(false)
    }
  }

  if (stationQuery.isLoading) return <PageLoader label="Loading charger details" />
  if (stationQuery.error) {
    return <ErrorState description={(stationQuery.error as Error).message} onRetry={() => void stationQuery.refetch()} />
  }
  if (!station) {
    return (
      <ErrorState
        title="Station unavailable"
        description="This station could not be found or is not accepting bookings right now."
        onRetry={() => navigate('/app/stations')}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={guestMode ? `/stations/${station.slug}` : `/app/stations/${station.slug}`} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted hover:text-midnight-900">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to station
        </Link>
        <Badge tone="lime"><ShieldCheck className="h-3 w-3" /> Verified station</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-3xl border border-midnight-900/[0.07] bg-white shadow-card">
            <div className="relative h-44 sm:h-52">
              <SmartImage
                src={station.images?.find((image) => image.is_cover)?.image_url ?? station.images?.[0]?.image_url}
                alt={station.name}
                className="absolute inset-0 h-full w-full"
                imgClassName="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-midnight-950 via-midnight-950/40 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-white">{station.name}</h1>
                <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-white/60">
                  <MapPin className="h-3.5 w-3.5" /> {station.address}, {station.city}
                </p>
              </div>
            </div>
          </div>

          <section className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card sm:p-6">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-midnight-900 font-mono text-[11px] text-lime">1</span>
              <h2 className="font-display text-base font-semibold text-midnight-900">Choose your charger</h2>
            </div>
            <div className="mt-4 grid gap-2.5">
              {chargers.length ? (
                chargers.map((charger) => {
                  const selected = effectiveChargerId === charger.id
                  return (
                    <button
                      key={charger.id}
                      onClick={() => { setChargerId(charger.id); setSlotStart('') }}
                      className={cn(
                        'flex flex-col gap-2 rounded-2xl border p-4 text-left transition sm:flex-row sm:items-center sm:justify-between',
                        selected ? 'border-lime-500 bg-lime/10' : 'border-midnight-900/[0.08] hover:border-lime-400/60',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', selected ? 'bg-lime text-midnight-900' : 'bg-mint text-midnight-800')}>
                          <PlugZap className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-[13px] font-semibold text-midnight-900">{charger.name} · {charger.charger_code}</p>
                          <p className="mt-0.5 text-[11px] text-muted">
                            {connectorLabels[charger.connector_type]} · {charger.capacity_kw} kW · {speedLabels[charger.speed_category]}
                          </p>
                        </div>
                      </div>
                      <div className="pl-12 text-left sm:pl-0 sm:text-right">
                        <p className="font-mono text-[12.5px] font-medium text-midnight-900">{formatNaira(charger.price_per_kwh)}<span className="text-[9px] text-muted">/kWh</span></p>
                        <p className="text-[9.5px] text-muted">+ {formatNaira(charger.booking_fee)} booking fee</p>
                      </div>
                    </button>
                  )
                })
              ) : (
                <div className="rounded-2xl bg-charcoal-50 p-5 text-center text-[12px] text-muted">
                  No chargers at this station are accepting bookings right now.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card sm:p-6">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-midnight-900 font-mono text-[11px] text-lime">2</span>
              <h2 className="font-display text-base font-semibold text-midnight-900">Pick a date &amp; start time</h2>
            </div>
            <div className="hide-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
              {dateOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => { setDate(option.value); setSlotStart('') }}
                  className={cn(
                    'flex w-[64px] shrink-0 flex-col items-center rounded-2xl border py-2.5 transition',
                    date === option.value ? 'border-midnight-900 bg-midnight-900 text-white' : 'border-midnight-900/10 bg-white text-charcoal-600 hover:border-lime-400',
                  )}
                >
                  <span className="text-[9px] uppercase tracking-[0.1em] opacity-60">{option.day}</span>
                  <span className="mt-0.5 font-mono text-lg font-medium">{option.date}</span>
                  <span className="text-[9px] opacity-60">{option.month}</span>
                </button>
              ))}
            </div>

            <div className="mt-5">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-charcoal-600">
                <Clock className="h-3.5 w-3.5" /> Available start times
                <span className="font-normal text-muted">· {formatDate(`${date}T12:00:00`, 'EEEE, dd MMMM')}</span>
              </p>
              {slotsQuery.isLoading ? (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {Array.from({ length: 10 }).map((_, index) => <div key={index} className="h-9 animate-pulse rounded-xl bg-charcoal-100" />)}
                </div>
              ) : hasAvailability ? (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
                  {slots.map((slot) => {
                    const active = slotStart === slot.start
                    return (
                      <button
                        key={slot.start}
                        disabled={!slot.available}
                        onClick={() => setSlotStart(slot.start)}
                        className={cn(
                          'h-9 rounded-xl border font-mono text-[11px] font-medium transition',
                          active && 'border-lime-500 bg-lime text-midnight-900',
                          !active && slot.available && 'border-midnight-900/10 bg-white text-charcoal-600 hover:border-lime-400',
                          !slot.available && 'cursor-not-allowed border-charcoal-100 bg-charcoal-50 text-charcoal-300 line-through',
                        )}
                      >
                        {slot.label}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="mt-3 rounded-2xl bg-charcoal-50 p-5 text-center text-[12px] text-muted">
                  No open slots on this date. Try another day or charger.
                </div>
              )}
            </div>

            {!guestMode && (
            <div className="mt-4 rounded-2xl border border-dashed border-midnight-900/15 bg-charcoal-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-midnight-800 shadow-sm">
                    <BellRing className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[12px] font-semibold text-midnight-900">Waiting for a specific time?</p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">
                      Join the waitlist and we will alert you if a matching slot opens on {formatDate(`${date}T12:00:00`, 'EEE, dd MMM')}.
                    </p>
                  </div>
                </div>
                {existingWaitlist ? (
                  <Badge tone="lime"><Check className="h-3 w-3" /> On the waitlist</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setWaitlistOpen((open) => !open)}
                  >
                    <BellRing className="h-3.5 w-3.5" /> {waitlistOpen ? 'Close' : 'Join waitlist'}
                  </Button>
                )}
              </div>
              {waitlistOpen && !existingWaitlist && (
                <div className="mt-3 grid gap-3 border-t border-midnight-900/[0.06] pt-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Field label="Preferred start time" hint="Optional. Leave blank to watch the whole day.">
                    <Input
                      type="time"
                      value={preferredTime}
                      onChange={(event) => setPreferredTime(event.target.value)}
                    />
                  </Field>
                  <Button onClick={() => void handleJoinWaitlist()} loading={joiningWaitlist}>
                    <BellRing className="h-4 w-4" /> Notify me
                  </Button>
                </div>
              )}
            </div>
            )}
          </section>

          <section className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card sm:p-6">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-midnight-900 font-mono text-[11px] text-lime">3</span>
              <h2 className="font-display text-base font-semibold text-midnight-900">Session details</h2>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="How long do you need?" required>
                <div className="grid grid-cols-3 gap-2">
                  {DURATIONS.map((minutes) => (
                    <button
                      key={minutes}
                      onClick={() => setDuration(minutes)}
                      className={cn(
                        'h-10 rounded-xl border font-mono text-[11px] font-medium transition',
                        duration === minutes ? 'border-midnight-900 bg-midnight-900 text-lime' : 'border-midnight-900/10 bg-white text-charcoal-600 hover:border-lime-400',
                      )}
                    >
                      {minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Which vehicle?" hint={vehicles.length ? 'Used only to estimate your energy needs.' : 'Add a vehicle to improve your estimate.'}>
                <Select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
                  <option value="">No vehicle selected</option>
                  {vehicles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.manufacturer} {item.model} ({item.battery_capacity_kwh} kWh)
                    </option>
                  ))}
                </Select>
                {!vehicles.length && !guestMode && (
                  <Link to="/app/vehicles" className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-semibold text-lime-700 hover:underline">
                    <Car className="h-3 w-3" /> Add your first vehicle
                  </Link>
                )}
                {guestMode && (
                  <p className="mt-2 text-[10.5px] text-muted">No vehicle needed — we estimate energy from the charger output.</p>
                )}
              </Field>
            </div>
            {slotValid && (
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-mint-50 px-4 py-3 text-[11px] text-charcoal-600">
                <CalendarCheck className="h-4 w-4 text-midnight-800" />
                <span className="font-semibold text-midnight-900">{formatDate(slotStart, 'EEE, dd MMM')} · {formatDate(slotStart, 'HH:mm')}–{formatDate(new Date(new Date(slotStart).getTime() + duration * 60_000).toISOString(), 'HH:mm')}</span>
                <span className="text-muted">· {duration} minutes</span>
              </div>
            )}
          </section>

          {!guestMode && (
          <section className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-mint text-midnight-800">
                  <Repeat2 className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-display text-base font-semibold text-midnight-900">Make it a recurring plan</h2>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                    Create this first booking now, then reserve each next session with one tap. Future sessions are never charged automatically.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={recurring}
                aria-label="Make this a recurring plan"
                onClick={() => setRecurring((value) => !value)}
                className={cn(
                  'relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors',
                  recurring ? 'bg-lime' : 'bg-charcoal-200',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all',
                    recurring ? 'left-[22px]' : 'left-0.5',
                  )}
                />
              </button>
            </div>

            {recurring && (
              <div className="mt-4 grid gap-4 border-t border-midnight-900/[0.06] pt-4 sm:grid-cols-2">
                <Field label="How often?">
                  <div className="grid grid-cols-3 gap-2">
                    {(['weekly', 'biweekly', 'monthly'] as BookingFrequency[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFrequency(value)}
                        className={cn(
                          'h-10 rounded-xl border px-2 text-[10.5px] font-semibold transition',
                          frequency === value
                            ? 'border-midnight-900 bg-midnight-900 text-lime'
                            : 'border-midnight-900/10 bg-white text-charcoal-600 hover:border-lime-400',
                        )}
                      >
                        {recurrenceLabels[value]}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Sessions in this plan" hint="The count includes this first booking.">
                  <Select value={String(occurrences)} onChange={(event) => setOccurrences(Number(event.target.value))}>
                    {[2, 4, 6, 8, 12].map((count) => (
                      <option key={count} value={count}>{count} sessions</option>
                    ))}
                  </Select>
                </Field>
                <div className="rounded-2xl bg-mint-50 p-4 sm:col-span-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-midnight-900">
                    <CalendarCheck className="h-3.5 w-3.5" /> Schedule preview
                  </p>
                  {schedulePreview.length ? (
                    <>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {schedulePreview.map((item) => (
                          <span key={item} className="rounded-lg bg-white px-2.5 py-1 font-mono text-[10px] text-charcoal-700 shadow-sm">
                            {item}
                          </span>
                        ))}
                        {occurrences > 4 && (
                          <span className="rounded-lg bg-midnight-900 px-2.5 py-1 font-mono text-[10px] text-lime">
                            +{occurrences - 4} more
                          </span>
                        )}
                      </div>
                      <p className="mt-2.5 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted">
                        <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-lime-600" />
                        You pay for the first session after this step. We do not auto-charge future sessions; open the plan in My bookings when you are ready to reserve the next one.
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-[10.5px] text-muted">Pick an available start time to preview the schedule.</p>
                  )}
                </div>
              </div>
            )}
          </section>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <section className="overflow-hidden rounded-3xl border border-midnight-900/[0.07] bg-white shadow-card">
            <div className="border-b border-midnight-900/[0.06] px-5 py-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Booking summary</p>
              <h2 className="mt-1 font-display text-lg font-semibold text-midnight-900">Price breakdown</h2>
            </div>
            <div className="p-5">
              {quote ? (
                <>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-muted">Est. energy</span>
                      <span className="font-mono text-charcoal-700">{quote.energyKwh.toFixed(1)} kWh</span>
                    </div>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-muted">Charging ({formatNaira(quote.pricePerKwh)}/kWh)</span>
                      <span className="font-mono text-charcoal-700">{formatNaira(quote.chargingFee)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-muted">Operator booking fee</span>
                      <span className="font-mono text-charcoal-700">{formatNaira(quote.bookingFee)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-muted">Platform service fee</span>
                      <span className="font-mono text-charcoal-700">{formatNaira(quote.serviceFee)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-muted">VAT (7.5%)</span>
                      <span className="font-mono text-charcoal-700">{formatNaira(quote.taxAmount)}</span>
                    </div>
                    {creditApplied > 0 && (
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="flex items-center gap-1 text-emerald-700">
                          <Coins className="h-3 w-3" /> Reward credit
                        </span>
                        <span className="font-mono text-emerald-600">−{formatNaira(creditApplied)}</span>
                      </div>
                    )}
                  </div>

                  {!recurring && rewardCredit > 0 && (
                    <label className="mt-4 flex cursor-pointer items-start justify-between gap-3 rounded-2xl border border-lime-400/50 bg-lime/10 px-4 py-3">
                      <span>
                        <span className="block text-[12px] font-semibold text-midnight-900">Use reward credit</span>
                        <span className="mt-0.5 block text-[10.5px] text-muted">
                          {formatNaira(rewardCredit)} available · up to {formatNaira(creditCap)} off this booking
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={useCredit}
                        onChange={(event) => setUseCredit(event.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-midnight-900/20 text-lime focus:ring-lime"
                      />
                    </label>
                  )}

                  <div className="mt-4 flex items-end justify-between border-t border-midnight-900/[0.08] pt-4">
                    <div>
                      <p className="text-[11px] text-muted">Total to pay</p>
                      <p className="mt-0.5 text-[9px] text-muted">Held for 15 minutes</p>
                    </div>
                    <p className="font-mono text-2xl font-medium text-midnight-900">{formatNaira(payableTotal)}</p>
                  </div>
                  {recurring && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-mint-50 px-3 py-2 text-[10px] text-midnight-800">
                      <Repeat2 className="h-3.5 w-3.5 shrink-0" />
                      <span><strong>{recurrenceLabels[frequency]}</strong> · {occurrences} sessions · first booking today</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[12px] text-muted">Select an available charger to see your price.</p>
              )}

              {guestMode && (
                <div className="mt-5 space-y-3 rounded-2xl border border-midnight-900/[0.08] bg-charcoal-50/60 p-4">
                  <div>
                    <p className="text-[12px] font-semibold text-midnight-900">Reserve as a guest</p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">
                      No account needed. We email your receipt and QR code, and you can set a password later to manage this booking.
                    </p>
                  </div>
                  <Field label="Full name" required>
                    <Input value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="e.g. Ada Obi" autoComplete="name" />
                  </Field>
                  <Field label="Email" required hint="Your receipt and QR code go here.">
                    <Input type="email" value={guestEmail} onChange={(event) => setGuestEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" />
                  </Field>
                  <Field label="Phone" required hint="For the charger operator on arrival.">
                    <Input value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} placeholder="0803 123 4567" inputMode="tel" autoComplete="tel" />
                  </Field>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-white p-3 text-[10.5px] leading-relaxed text-muted">
                    <input
                      type="checkbox"
                      required
                      checked={guestAcceptedTerms}
                      onChange={(event) => setGuestAcceptedTerms(event.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded accent-lime-600"
                    />
                    <span>
                      I accept the <Link to="/legal/terms" className="font-semibold text-lime-700 hover:underline">Terms of Service</Link>,{' '}
                      <Link to="/legal/privacy" className="font-semibold text-lime-700 hover:underline">Privacy Policy</Link> and{' '}
                      <Link to="/legal/cancellation" className="font-semibold text-lime-700 hover:underline">Cancellation Policy</Link>.
                    </span>
                  </label>
                </div>
              )}

              <Button
                className="mt-5 w-full"
                size="lg"
                disabled={!slotValid || !selectedCharger}
                loading={submitting}
                onClick={handleBook}
              >
                {guestMode ? <ShieldCheck className="h-4 w-4" /> : recurring ? <Repeat2 className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                {guestMode ? 'Reserve as guest' : recurring ? 'Create recurring plan' : 'Reserve & continue to payment'}
              </Button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[9.5px] leading-relaxed text-muted">
                <ShieldCheck className="h-3 w-3 text-lime-600" /> Server-verified pricing. Free cancellation up to 2 hours before.
              </p>
            </div>
          </section>

          <div className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Station</p>
            <p className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-midnight-900"><MapPin className="h-3.5 w-3.5" /> {station.city}, {station.state}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">{station.address}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {station.amenities.slice(0, 4).map((amenity) => (
                <span key={amenity} className="inline-flex items-center gap-1 rounded-lg bg-mint-50 px-2 py-1 text-[9.5px] font-medium text-charcoal-600"><Check className="h-2.5 w-2.5 text-lime-600" /> {amenity}</span>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-midnight-900/[0.06] pt-3 text-[10px] text-muted">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {station.operating_hours}</span>
              <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> {station.available_chargers} free now</span>
            </div>
          </div>

          <InfoNote title="What happens after payment?">
            Your booking is confirmed once Paystack verifies the payment. You will get a QR code to scan at the charger,
            plus an email receipt and calendar-ready details.
          </InfoNote>
        </aside>
      </div>
    </div>
  )
}
