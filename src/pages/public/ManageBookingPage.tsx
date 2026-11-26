import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  CalendarCheck,
  Check,
  LifeBuoy,
  LockKeyhole,
  MapPin,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { bookingIsConfirmed, listRememberedGuestTokens, lookupBooking } from '@/services/bookings'
import type { Booking } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button, buttonVariants } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { EmptyState, ErrorState, useToast } from '@/components/ui/Feedback'
import { InfoNote } from '@/components/dashboard/Kit'
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/booking/StatusBadges'
import { formatDate, formatDateTime, formatNaira, cn } from '@/lib/utils'

interface LookupState {
  loading: boolean
  error: string | null
  booking: Booking | null
  searched: boolean
}

const INITIAL: LookupState = { loading: false, error: null, booking: null, searched: false }

function timeline(booking: Booking) {
  return [
    { label: 'Booking created', value: booking.created_at, active: true },
    { label: 'Payment verified', value: booking.payment?.paid_at ?? null, active: booking.payment_status === 'success' },
    { label: 'Checked in', value: booking.checked_in_at, active: Boolean(booking.checked_in_at) },
    { label: 'Session started', value: booking.started_at, active: Boolean(booking.started_at) },
    { label: 'Session completed', value: booking.completed_at, active: Boolean(booking.completed_at) },
  ]
}

function nextStep(booking: Booking): string {
  switch (booking.status) {
    case 'pending_payment':
      return 'Your charger is held. Complete payment from your confirmation page to lock in the slot.'
    case 'confirmed':
      return 'You are all set. Arrive within 15 minutes of your start time and show your QR code at the charger.'
    case 'checked_in':
      return 'Your charger is unlocked. Plug in and start your session.'
    case 'in_progress':
      return 'Your charging session is running. The operator will mark it complete when you finish.'
    case 'completed':
      return 'This session is complete. You can download your receipt or leave a verified review.'
    case 'cancelled':
    case 'expired':
    case 'refunded':
      return 'This booking is no longer active. Contact support if you need help with a refund.'
    default:
      return 'We are tracking this booking. Contact support if anything looks wrong.'
  }
}

export default function ManageBookingPage() {
  const [params] = useSearchParams()
  const { user } = useAuth()
  const toast = useToast()
  const [reference, setReference] = useState(params.get('ref') ?? params.get('reference') ?? '')
  const [secret, setSecret] = useState(
    params.get('secret') ?? params.get('token') ?? (params.get('link') ? decodeURIComponent(params.get('link') ?? '') : ''),
  )
  const [state, setState] = useState<LookupState>(INITIAL)
  usePageTitle('Manage your booking')

  const runLookup = async (ref: string, sec: string) => {
    if (!ref.trim() || !sec.trim()) {
      toast.error('Two details needed', 'Enter your booking number and the email or secure link you booked with.')
      return
    }
    setState({ loading: true, error: null, booking: null, searched: true })
    try {
      const booking = await lookupBooking(ref, sec)
      setState({ loading: false, error: null, booking, searched: true })
    } catch (error) {
      setState({ loading: false, error: (error as Error).message, booking: null, searched: true })
    }
  }

  // Deep links from confirmation emails can prefill and search immediately.
  useEffect(() => {
    if (reference.trim() && secret.trim()) void runLookup(reference, secret)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const booking = state.booking
  const tokenFromLink = secret.match(/[?&]token=([^&]+)/i)?.[1]
  const matchedToken = tokenFromLink ?? (/^[0-9a-f]{64}$/i.test(secret.trim()) ? secret.trim() : null)
  const remembered = listRememberedGuestTokens().find((item) => item.reference === booking?.booking_reference)
  const guestToken = matchedToken ?? remembered?.token ?? null
  const confirmed = booking ? bookingIsConfirmed(booking) : false
  const directions = booking?.station?.google_maps_url
    ?? (booking?.station
      ? `https://www.google.com/maps/dir/?api=1&destination=${booking.station.latitude ?? ''},${booking.station.longitude ?? ''}`
      : null)

  return (
    <div className="bg-mint-50 pb-20">
      <section className="border-b border-midnight-900/[0.06] bg-white">
        <div className="container-page py-16 pt-32 lg:py-24 lg:pt-36">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-lime-400/60 bg-lime/15 px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-midnight-800" />
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-midnight-800">Manage booking</span>
            </div>
            <h1 className="mt-5 font-display text-4xl font-semibold tracking-[-0.04em] text-midnight-900 sm:text-5xl">
              Track your charging session.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-charcoal-600">
              Enter your booking number and the email you booked with, or paste the secure link from your confirmation.
              No account needed.
            </p>
          </div>
        </div>
      </section>

      <div className="container-page pt-10">
        <div className="mx-auto max-w-3xl space-y-6">
          <section className="rounded-3xl border border-midnight-900/[0.07] bg-white p-6 shadow-card sm:p-8">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void runLookup(reference, secret)
              }}
              className="space-y-5"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Booking number" required hint="For example, EVN-7K4M2Q">
                  <Input
                    value={reference}
                    onChange={(event) => setReference(event.target.value.toUpperCase())}
                    placeholder="EVN-XXXXXX"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Email or secure link" required hint="The email you booked with, or your confirmation link">
                  <Input
                    value={secret}
                    onChange={(event) => setSecret(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </Field>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-[10.5px] text-muted">
                  <LockKeyhole className="h-3.5 w-3.5" /> We never show your QR code here.
                </p>
                <Button type="submit" loading={state.loading} size="md">
                  <Search className="h-4 w-4" /> Track booking
                </Button>
              </div>
            </form>
          </section>

          {state.error && (
            <ErrorState title="Lookup unavailable" description={state.error} />
          )}

          {state.searched && !state.loading && !state.error && !booking && (
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title="No booking matched those details"
              description="Check the booking number and email. Guest bookings can also be found by pasting the secure link from the confirmation page."
              action={
                <Link to="/contact" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  Ask support for help
                </Link>
              }
            />
          )}

          {booking && (
            <div className="space-y-5">
              <section className="overflow-hidden rounded-3xl border border-midnight-900/[0.07] bg-white shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-midnight-900/[0.06] px-6 py-5">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">Booking number</p>
                    <p className="mt-1 font-mono text-xl font-medium text-midnight-900">{booking.booking_reference}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <BookingStatusBadge status={booking.status} />
                    <PaymentStatusBadge status={booking.payment_status} />
                  </div>
                </div>

                <div className="grid gap-4 p-6 sm:grid-cols-2">
                  <div className="rounded-2xl bg-mint-50 p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">Station</p>
                    <p className="mt-2 text-[13px] font-semibold text-midnight-900">{booking.station?.name ?? 'Charging station'}</p>
                    <p className="mt-1 flex items-start gap-1.5 text-[11px] text-muted">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {booking.station?.address}, {booking.station?.city}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-mint-50 p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">Schedule</p>
                    <p className="mt-2 text-[13px] font-semibold text-midnight-900">
                      {formatDate(booking.start_time, 'EEEE, dd MMMM yyyy')}
                    </p>
                    <p className="mt-1 font-mono text-[12px] text-charcoal-600">
                      {formatDate(booking.start_time, 'HH:mm')} – {formatDate(booking.end_time, 'HH:mm')}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-mint-50 p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">Charger</p>
                    <p className="mt-2 text-[13px] font-semibold text-midnight-900">{booking.charger?.name ?? 'Reserved charger'}</p>
                    <p className="mt-1 font-mono text-[11px] text-charcoal-600">
                      {booking.charger?.capacity_kw ?? 0} kW · {booking.charger?.connector_type.toUpperCase() ?? '—'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-mint-50 p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">Amount</p>
                    <p className="mt-2 font-mono text-lg font-medium text-midnight-900">{formatNaira(booking.total_amount)}</p>
                    <p className="mt-1 text-[10px] text-muted">
                      Payment {booking.payment?.reference ?? 'not created'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-midnight-900/[0.06] px-6 py-4">
                  {guestToken && (
                    <Link
                      to={`/book/confirmation/${booking.id}?token=${encodeURIComponent(guestToken)}`}
                      className={buttonVariants({ size: 'sm' })}
                    >
                      <QrLink /> Open full booking
                    </Link>
                  )}
                  {!guestToken && user && (
                    <Link to={`/app/bookings/${booking.id}`} className={buttonVariants({ size: 'sm' })}>
                      <ArrowRight className="h-3.5 w-3.5" /> Open in my bookings
                    </Link>
                  )}
                  {confirmed && directions && (
                    <a href={directions} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                      <MapPin className="h-3.5 w-3.5" /> Directions
                    </a>
                  )}
                  {!confirmed && (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-charcoal-50 px-3 py-2 text-[10.5px] text-muted">
                      <LockKeyhole className="h-3.5 w-3.5" /> Map & directions unlock after payment
                    </span>
                  )}
                  <Link to="/contact" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                    <LifeBuoy className="h-3.5 w-3.5" /> Contact support
                  </Link>
                </div>
              </section>

              <InfoNote title="Where things stand" tone={confirmed ? 'success' : 'info'}>
                {nextStep(booking)}
              </InfoNote>

              <section className="rounded-3xl border border-midnight-900/[0.07] bg-white p-6 shadow-card">
                <h2 className="font-display text-base font-semibold text-midnight-900">Booking timeline</h2>
                <div className="mt-5">
                  {timeline(booking).map((step, index, list) => (
                    <div key={step.label} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className={cn(
                          'grid h-6 w-6 place-items-center rounded-full',
                          step.active ? 'bg-lime text-midnight-900' : 'border border-charcoal-200 bg-white text-charcoal-300',
                        )}>
                          {step.active ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                        </span>
                        {index < list.length - 1 && (
                          <span className={cn('my-1 h-6 w-0.5', step.active ? 'bg-lime/50' : 'bg-charcoal-100')} />
                        )}
                      </div>
                      <div className="pb-4">
                        <p className={cn('text-[12px] font-semibold', step.active ? 'text-midnight-900' : 'text-charcoal-400')}>
                          {step.label}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-muted">
                          {step.value ? formatDateTime(step.value) : 'Pending'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-midnight-900/[0.06] bg-white px-5 py-4">
                <p className="flex items-center gap-2 text-[11px] text-muted">
                  <ShieldCheck className="h-4 w-4 text-lime-600" /> Status is verified from our records, never simulated.
                </p>
                {user ? (
                  <Link to="/app/bookings" className="inline-flex items-center gap-1 text-[11px] font-semibold text-lime-700 hover:underline">
                    My bookings <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : (
                  <Link to="/login" className="inline-flex items-center gap-1 text-[11px] font-semibold text-lime-700 hover:underline">
                    Sign in to see all bookings <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function QrLink() {
  return <CalendarCheck className="h-3.5 w-3.5" />
}
