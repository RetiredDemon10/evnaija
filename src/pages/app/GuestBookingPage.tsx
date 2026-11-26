import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  Lock,
  Mail,
  MapPin,
  PlugZap,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { getGuestBooking, initializePayment, rememberGuestToken } from '@/services/bookings'
import { connectorLabels, formatDate, formatNaira, speedLabels } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useToast } from '@/components/ui/Feedback'
import { Button, buttonVariants } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageLoader, ErrorState } from '@/components/ui/Feedback'
import { Field, Input } from '@/components/ui/Form'
import { InfoNote } from '@/components/dashboard/Kit'

/**
 * Guest confirmation + payment.
 *
 * Guests are not signed in, so this page is authorised entirely by the
 * per-booking token in the URL. The token is remembered against the payment
 * reference so the payment callback can verify the charge on return.
 */
export default function GuestBookingPage() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const toast = useToast()
  const { isPreview, resetPassword } = useAuth()

  const [paying, setPaying] = useState(false)
  const [claimEmail, setClaimEmail] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [claimSent, setClaimSent] = useState(false)

  const bookingQuery = useQuery({
    queryKey: ['guest-booking', id, token],
    queryFn: () => getGuestBooking(id, token),
    enabled: Boolean(id && token),
  })

  const booking = bookingQuery.data ?? null
  usePageTitle(booking ? `Booking ${booking.booking_reference}` : 'Your guest booking')

  // Remember the token against the booking number too, so Manage Booking and
  // station directions can recognise this guest later in the same tab.
  useEffect(() => {
    if (booking?.booking_reference && token) {
      rememberGuestToken(booking.booking_reference, token)
    }
  }, [booking?.booking_reference, token])

  const station = booking?.station
  const charger = booking?.charger
  const payment = booking?.payment
  const paid = payment?.status === 'success' || booking?.payment_status === 'success'

  const claimValue = useMemo(() => claimEmail || booking?.guest_email || '', [claimEmail, booking?.guest_email])

  const handlePay = async () => {
    if (!booking || !token) return
    setPaying(true)
    try {
      const initialized = await initializePayment(booking.id, token)
      rememberGuestToken(initialized.reference, token)
      window.location.assign(initialized.authorization_url)
    } catch (error) {
      toast.error('Could not start payment', (error as Error).message)
      setPaying(false)
    }
  }

  const handleClaim = async () => {
    if (!claimValue.trim()) return
    setClaiming(true)
    const { error } = await resetPassword(claimValue.trim())
    setClaiming(false)
    if (error) {
      toast.error('Could not send the link', error)
      return
    }
    setClaimSent(true)
  }

  if (!token) {
    return (
      <ErrorState
        title="Booking link incomplete"
        description="This page needs the secure link we emailed you. Open the link from your booking email to pay or manage this booking."
        onRetry={() => undefined}
      />
    )
  }

  if (bookingQuery.isLoading) return <PageLoader label="Loading your booking" />
  if (bookingQuery.error) {
    return <ErrorState description={(bookingQuery.error as Error).message} onRetry={() => void bookingQuery.refetch()} />
  }
  if (!booking) {
    return (
      <ErrorState
        title="Booking not found"
        description="This booking link is invalid or has expired. Start a new reservation to continue."
        onRetry={() => undefined}
      />
    )
  }

  const breakdown = [
    { label: `Charging (${formatNaira(charger?.price_per_kwh ?? 0)}/kWh)`, value: booking.charging_fee },
    { label: 'Operator booking fee', value: booking.booking_fee },
    { label: 'Platform service fee', value: booking.service_fee },
    { label: 'VAT (7.5%)', value: booking.tax_amount },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={station?.slug ? `/stations/${station.slug}` : '/'}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted hover:text-midnight-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to station
        </Link>
        <Badge tone={paid ? 'success' : 'warning'}>
          {paid ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          {paid ? 'Paid & confirmed' : 'Awaiting payment'}
        </Badge>
      </div>

      <div className="mt-5 rounded-3xl border border-midnight-900/[0.07] bg-white p-6 shadow-card">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Guest booking · {booking.booking_reference}</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-midnight-900">
          {paid ? 'Your charger is confirmed' : 'Your charger is held'}
        </h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
          {paid
            ? 'Scan the QR code in your email receipt at the charger to start your session.'
            : 'Complete payment to confirm this booking. The charger is held for a short window.'}
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card sm:p-6">
            <div className="flex items-center gap-2">
              <PlugZap className="h-4 w-4 text-midnight-800" />
              <h2 className="font-display text-base font-semibold text-midnight-900">Reservation details</h2>
            </div>
            <div className="mt-4 space-y-3 text-[12px]">
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted">Station</span>
                <span className="text-right font-medium text-midnight-900">{station?.name}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted">Location</span>
                <span className="flex items-center gap-1 text-right text-charcoal-700">
                  <MapPin className="h-3 w-3" /> {station?.address}, {station?.city}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted">Charger</span>
                <span className="text-right text-charcoal-700">
                  {charger?.name} · {charger?.charger_code}
                  {charger && (
                    <span className="mt-0.5 block text-[10.5px] text-muted">
                      {connectorLabels[charger.connector_type]} · {charger.capacity_kw} kW
                      {charger.speed_category ? ` · ${speedLabels[charger.speed_category]}` : ''}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted">Session</span>
                <span className="text-right text-charcoal-700">
                  {formatDate(booking.start_time, 'EEE, dd MMM · HH:mm')}–{formatDate(booking.end_time, 'HH:mm')}
                  <span className="mt-0.5 block text-[10.5px] text-muted">{booking.duration_minutes} minutes · est. {booking.energy_kwh} kWh</span>
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card sm:p-6">
            <h2 className="font-display text-base font-semibold text-midnight-900">Price breakdown</h2>
            <div className="mt-4 space-y-2.5">
              {breakdown.map((row) => (
                <div key={row.label} className="flex items-center justify-between text-[12px]">
                  <span className="text-muted">{row.label}</span>
                  <span className="font-mono text-charcoal-700">{formatNaira(row.value)}</span>
                </div>
              ))}
              {Number(booking.discount_amount) > 0 && (
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-emerald-700">Credit applied</span>
                  <span className="font-mono text-emerald-600">−{formatNaira(booking.discount_amount)}</span>
                </div>
              )}
            </div>
            <div className="mt-4 flex items-end justify-between border-t border-midnight-900/[0.08] pt-4">
              <div>
                <p className="text-[11px] text-muted">Total to pay</p>
                {booking.hold_expires_at && !paid && (
                  <p className="mt-0.5 text-[9px] text-muted">Held until {formatDate(booking.hold_expires_at, 'HH:mm')}</p>
                )}
              </div>
              <p className="font-mono text-2xl font-medium text-midnight-900">{formatNaira(booking.total_amount)}</p>
            </div>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card">
            {paid ? (
              <div className="text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-lime/20 text-midnight-900">
                  <CheckCircle2 className="h-6 w-6" />
                </span>
                <p className="mt-3 text-[13px] font-semibold text-midnight-900">Payment received</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  {payment?.reference ? `Reference ${payment.reference}.` : ''} Your receipt and QR code have been emailed.
                </p>
              </div>
            ) : (
              <>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Secure checkout</p>
                <h2 className="mt-1 font-display text-lg font-semibold text-midnight-900">Pay with Paystack</h2>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                  Card, bank transfer, USSD and mobile money are supported. Your booking confirms the moment the payment clears.
                </p>
                {isPreview ? (
                  <div className="mt-4">
                    <InfoNote title="Preview mode" tone="warning">
                      Live Paystack checkout is disabled in this preview. Add Supabase and Paystack credentials to complete a real test payment —
                      this preview never marks a booking as paid.
                    </InfoNote>
                  </div>
                ) : (
                  <Button className="mt-4 w-full" size="lg" loading={paying} onClick={() => void handlePay()}>
                    <CreditCard className="h-4 w-4" /> Pay {formatNaira(booking.total_amount)}
                  </Button>
                )}
                <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[9.5px] leading-relaxed text-muted">
                  <ShieldCheck className="h-3 w-3 text-lime-600" /> Payments are processed by Paystack. EV Naija never stores your card.
                </p>
              </>
            )}
          </section>

          <section className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-midnight-800" />
              <h2 className="font-display text-base font-semibold text-midnight-900">Keep this booking</h2>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Set a password for {booking.guest_email ?? 'your email'} to manage this booking, rebook in a tap and keep your receipts in one place.
            </p>
            {claimSent ? (
              <div className="mt-4">
                <InfoNote title="Check your inbox" tone="success">
                  We emailed a secure link to {claimValue}. Open it to set your password and claim this booking.
                </InfoNote>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <Field label="Email" hint="We only send a link if you ask for one.">
                  <Input
                    type="email"
                    value={claimValue}
                    onChange={(event) => setClaimEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </Field>
                <Button
                  variant="outline"
                  className="w-full"
                  loading={claiming}
                  onClick={() => void handleClaim()}
                  disabled={isPreview}
                >
                  <Mail className="h-4 w-4" /> Email me a password link
                </Button>
                {isPreview && (
                  <p className="text-[10px] text-muted">Account claiming requires a configured Supabase project.</p>
                )}
              </div>
            )}
          </section>

          <div className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Station</p>
            <p className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-midnight-900">
              <MapPin className="h-3.5 w-3.5" /> {station?.city}, {station?.state}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">{station?.address}</p>
            <div className="mt-3 flex items-center justify-between border-t border-midnight-900/[0.06] pt-3 text-[10px] text-muted">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {station?.operating_hours}</span>
              <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> EV charging</span>
            </div>
            {station?.google_maps_url && (
              <a
                href={station.google_maps_url}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: 'outline', size: 'sm', className: 'mt-3 w-full' })}
              >
                <MapPin className="h-3.5 w-3.5" /> Open directions
              </a>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
