import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import QRCode from 'react-qr-code'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CalendarCheck,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  MapPin,
  Navigation,
  PlugZap,
  QrCode as QrCodeIcon,
  Receipt,
  Repeat2,
  ShieldCheck,
  Star,
  XCircle,
  Zap,
} from 'lucide-react'
import { cancelBooking, getBooking, initializePayment } from '@/services/bookings'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Feedback'
import { Button, buttonVariants } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageLoader, ErrorState, EmptyState } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Form'
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/booking/StatusBadges'
import { DetailRow, InfoNote } from '@/components/dashboard/Kit'
import { usePageTitle } from '@/hooks/usePageTitle'
import { recurrenceShortLabels } from '@/lib/recurrence'
import { formatDate, formatDateTime, formatNaira, humanize, timeUntil, cn } from '@/lib/utils'

export default function BookingDetailPage() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isPreview } = useAuth()
  const toast = useToast()
  const [paying, setPaying] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const created = searchParams.get('created') === '1'

  const { data: booking, isLoading, error, refetch } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => getBooking(id),
    enabled: Boolean(id),
  })

  usePageTitle(booking ? `Booking ${booking.booking_reference}` : 'Booking details')

  if (isLoading) return <PageLoader label="Loading booking" />
  if (error) return <ErrorState description={(error as Error).message} onRetry={() => void refetch()} />
  if (!booking) {
    return (
      <EmptyState
        icon={<CalendarCheck className="h-6 w-6" />}
        title="Booking not found"
        description="This booking does not exist, or it belongs to another account."
        action={<Link to="/app/bookings" className={buttonVariants({ variant: 'dark' })}>Back to bookings</Link>}
      />
    )
  }

  const pending = booking.status === 'pending_payment'
  const cancelled = ['cancelled', 'expired', 'refunded'].includes(booking.status)
  const completed = booking.status === 'completed'
  const canCancel = ['pending_payment', 'confirmed'].includes(booking.status)
  const canShowQr = ['confirmed', 'checked_in', 'in_progress', 'completed'].includes(booking.status)
  const directions =
    booking.station?.google_maps_url ??
    (booking.station ? `https://www.google.com/maps/dir/?api=1&destination=${booking.station.latitude},${booking.station.longitude}` : undefined)

  const handlePay = async () => {
    setPaying(true)
    try {
      const payment = await initializePayment(booking.id)
      window.location.href = payment.authorization_url
    } catch (err) {
      toast.error('Checkout could not start', (err as Error).message)
      setPaying(false)
    }
  }

  const handleCancel = async () => {
    if (cancelReason.trim().length < 6) {
      toast.error('Add a short reason', 'Tell us why you are cancelling this booking.')
      return
    }
    setCancelling(true)
    try {
      await cancelBooking(booking.id, cancelReason.trim())
      await queryClient.invalidateQueries({ queryKey: ['booking', booking.id] })
      await queryClient.invalidateQueries({ queryKey: ['customer-bookings'] })
      await refetch()
      toast.success(
        'Booking cancelled',
        booking.payment_status === 'success'
          ? 'Any eligible refund will be processed to your original payment method.'
          : 'No payment was taken for this booking.',
      )
      setCancelOpen(false)
      setCancelReason('')
    } catch (err) {
      toast.error('Could not cancel booking', (err as Error).message)
    } finally {
      setCancelling(false)
    }
  }

  const downloadQr = () => {
    const svg = document.getElementById('booking-qr-svg')
    if (!svg) return
    const data = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `EV-Naija-${booking.booking_reference}.svg`
    link.click()
    URL.revokeObjectURL(url)
  }

  const addToCalendar = () => {
    const stamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//EV Naija//Booking//EN',
      'BEGIN:VEVENT',
      `UID:${booking.booking_reference}@evnaija.ng`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(booking.start_time)}`,
      `DTEND:${stamp(booking.end_time)}`,
      `SUMMARY:EV charging — ${booking.station?.name ?? 'EV Naija station'}`,
      `LOCATION:${booking.station?.address ?? ''}, ${booking.station?.city ?? ''}`,
      `DESCRIPTION:Booking ${booking.booking_reference}. Charger ${booking.charger?.name ?? ''}. Show your QR code at the station.`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `EV-Naija-${booking.booking_reference}.ics`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/app/bookings" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted hover:text-midnight-900">
          <ArrowLeft className="h-3.5 w-3.5" /> All bookings
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {booking.series_id && (
            <Badge tone="neutral"><Repeat2 className="h-3 w-3" /> Recurring plan</Badge>
          )}
          <BookingStatusBadge status={booking.status} />
          <PaymentStatusBadge status={booking.payment_status} />
        </div>
      </div>

      {booking.series && (
        <InfoNote title="Part of a recurring plan">
          This {recurrenceShortLabels[booking.series.frequency].toLowerCase()} plan has created {booking.series.bookings_created} of {booking.series.occurrences} sessions.
          Future sessions are never charged automatically. Reserve each next one from{' '}
          <Link to="/app/bookings" className="font-semibold text-midnight-900 underline decoration-lime-500 decoration-2 underline-offset-2">
            My bookings
          </Link>.
        </InfoNote>
      )}

      {created && pending && (
        <InfoNote title="Charger held — payment needed" tone="warning">
          {isPreview
            ? 'Preview mode: this sample booking is held but live Paystack checkout is disabled, so no payment will be taken. Configure Supabase and Paystack to run a real test payment.'
            : 'We are holding your charger for 15 minutes. Complete payment below to confirm your reservation.'}
        </InfoNote>
      )}

      {booking.status === 'checked_in' && (
        <InfoNote title="Checked in" tone="success">Your charger is unlocked. Plug in and start your session — the operator will mark it complete.</InfoNote>
      )}
      {completed && (
        <InfoNote title="Session complete" tone="success">This charging session is complete. Download your receipt or leave a verified review.</InfoNote>
      )}
      {cancelled && (
        <InfoNote title="Booking cancelled" tone="warning">
          This booking is {humanize(booking.status)}. {booking.cancellation_reason ? `Reason: ${booking.cancellation_reason}.` : ''}{' '}
          {booking.payment_status === 'success'
            ? 'Refund eligibility depends on how close to the session start it was cancelled.'
            : 'No payment was taken for this booking.'}
        </InfoNote>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-3xl border border-midnight-900/[0.07] bg-white shadow-card">
            <div className="border-b border-midnight-900/[0.06] px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">Booking reference</p>
                  <p className="mt-1 font-mono text-lg font-medium text-midnight-900">{booking.booking_reference}</p>
                </div>
                <Badge tone={pending ? 'warning' : completed ? 'success' : 'lime'}>
                  {pending ? `Expires in ${timeUntil(booking.hold_expires_at ?? booking.start_time)}` : formatDate(booking.start_time, 'EEE, dd MMM yyyy')}
                </Badge>
              </div>
              <h1 className="mt-4 font-display text-2xl font-semibold tracking-[-0.03em] text-midnight-900">{booking.station?.name ?? 'Charging station'}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted"><MapPin className="h-3.5 w-3.5" /> {booking.station?.address}, {booking.station?.city}</p>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <div className="rounded-2xl bg-mint-50 p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">Schedule</p>
                <p className="mt-2 text-[13px] font-semibold text-midnight-900">{formatDate(booking.start_time, 'EEEE, dd MMMM yyyy')}</p>
                <p className="mt-1 font-mono text-[12px] text-charcoal-600">{formatDate(booking.start_time, 'HH:mm')} – {formatDate(booking.end_time, 'HH:mm')}</p>
                <p className="mt-1 text-[10px] text-muted">{booking.duration_minutes} minutes reserved</p>
              </div>
              <div className="rounded-2xl bg-mint-50 p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">Charger</p>
                <p className="mt-2 text-[13px] font-semibold text-midnight-900">{booking.charger?.name ?? 'Reserved charger'}</p>
                <p className="mt-1 font-mono text-[12px] text-charcoal-600">{booking.charger?.capacity_kw ?? 0} kW · {booking.charger?.connector_type.toUpperCase() ?? ''}</p>
                <p className="mt-1 text-[10px] text-muted">{booking.charger?.charger_code}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-midnight-900/[0.06] px-5 py-4 sm:px-6">
              {directions && (
                <a href={directions} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <Navigation className="h-3.5 w-3.5" /> Directions
                </a>
              )}
              <Button variant="outline" size="sm" onClick={addToCalendar}>
                <CalendarPlus className="h-3.5 w-3.5" /> Add to calendar
              </Button>
              {canShowQr && (
                <Button variant="outline" size="sm" onClick={downloadQr}>
                  <Download className="h-3.5 w-3.5" /> Download QR
                </Button>
              )}
              {canCancel && (
                <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => setCancelOpen(true)}>
                  <XCircle className="h-3.5 w-3.5" /> Cancel booking
                </Button>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-midnight-900">Payment breakdown</h2>
                <p className="mt-0.5 text-[11px] text-muted">Server-verified amounts, including VAT.</p>
              </div>
              <Receipt className="h-4 w-4 text-muted" />
            </div>
            <div className="mt-4 divide-y divide-midnight-900/[0.06]">
              <DetailRow label={`Charging (${booking.energy_kwh.toFixed(1)} kWh)`} value={formatNaira(booking.charging_fee)} mono />
              <DetailRow label="Operator booking fee" value={formatNaira(booking.booking_fee)} mono />
              <DetailRow label="Platform service fee" value={formatNaira(booking.service_fee)} mono />
              <DetailRow label="VAT" value={formatNaira(booking.tax_amount)} mono />
              {booking.discount_amount > 0 && <DetailRow label="Discount" value={`− ${formatNaira(booking.discount_amount)}`} mono />}
              <div className="flex items-center justify-between py-3">
                <span className="text-[13px] font-semibold text-midnight-900">Total</span>
                <span className="font-mono text-lg font-medium text-midnight-900">{formatNaira(booking.total_amount)}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-mint-50 px-3 py-2.5 text-[10.5px]">
              <span className="flex items-center gap-1.5 text-muted"><ShieldCheck className="h-3.5 w-3.5 text-lime-600" /> Payment reference</span>
              <span className="font-mono text-charcoal-700">{booking.payment?.reference ?? 'Not created'}</span>
            </div>
          </section>

          <section className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card sm:p-6">
            <h2 className="font-display text-base font-semibold text-midnight-900">Booking timeline</h2>
            <div className="mt-5 space-y-0">
              {[
                { label: 'Booking created', value: booking.created_at, active: true },
                { label: 'Payment verified', value: booking.payment?.paid_at ?? null, active: booking.payment_status === 'success' },
                { label: 'Checked in', value: booking.checked_in_at, active: Boolean(booking.checked_in_at) },
                { label: 'Session started', value: booking.started_at, active: Boolean(booking.started_at) },
                { label: 'Session completed', value: booking.completed_at, active: Boolean(booking.completed_at) },
              ].map((step, index, list) => (
                <div key={step.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={cn('grid h-6 w-6 place-items-center rounded-full', step.active ? 'bg-lime text-midnight-900' : 'border border-charcoal-200 bg-white text-charcoal-300')}>
                      {step.active ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                    </span>
                    {index < list.length - 1 && <span className={cn('my-1 h-6 w-0.5', step.active ? 'bg-lime/50' : 'bg-charcoal-100')} />}
                  </div>
                  <div className="pb-4">
                    <p className={cn('text-[12px] font-semibold', step.active ? 'text-midnight-900' : 'text-charcoal-400')}>{step.label}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted">{step.value ? formatDateTime(step.value) : 'Pending'}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          {pending && (
            <section className="rounded-3xl border border-lime-400/60 bg-white p-5 shadow-card">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-lime text-midnight-900"><CreditCard className="h-4 w-4" /></span>
                <div>
                  <p className="text-[12px] font-semibold text-midnight-900">Complete payment</p>
                  <p className="text-[10px] text-muted">Your slot expires {timeUntil(booking.hold_expires_at ?? booking.start_time)}</p>
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between rounded-2xl bg-mint-50 px-4 py-3">
                <span className="text-[11px] text-muted">Amount due</span>
                <span className="font-mono text-xl font-medium text-midnight-900">{formatNaira(booking.total_amount)}</span>
              </div>
              <Button className="mt-4 w-full" size="lg" loading={paying} onClick={handlePay} disabled={isPreview}>
                <CreditCard className="h-4 w-4" /> Pay with Paystack
              </Button>
              {isPreview && (
                <p className="mt-2.5 flex items-start gap-1.5 text-[10px] leading-relaxed text-amber-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Live checkout is disabled in preview mode. No card will be charged.
                </p>
              )}
              <p className="mt-2.5 text-center text-[9px] leading-relaxed text-muted">
                Card, bank transfer or USSD · Verified server-side before confirmation
              </p>
            </section>
          )}

          {canShowQr && (
            <section className="overflow-hidden rounded-3xl border border-midnight-900/[0.07] bg-white shadow-card">
              <div className="border-b border-midnight-900/[0.06] px-5 py-4">
                <div className="flex items-center gap-2">
                  <QrCodeIcon className="h-4 w-4 text-midnight-800" />
                  <h2 className="font-display text-base font-semibold text-midnight-900">Your check-in QR</h2>
                </div>
                <p className="mt-0.5 text-[10.5px] text-muted">Show this at the station. Do not share it.</p>
              </div>
              <div className="flex flex-col items-center p-5">
                <div className="rounded-2xl border border-midnight-900/10 bg-white p-4">
                  <QRCode id="booking-qr-svg" value={booking.qr_code} size={176} fgColor="#071B22" bgColor="#FFFFFF" />
                </div>
                <p className="mt-3 font-mono text-[10px] tracking-[0.12em] text-charcoal-500">{booking.booking_reference}</p>
                <button onClick={downloadQr} className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-semibold text-lime-700 hover:underline">
                  <Download className="h-3 w-3" /> Download QR
                </button>
                <div className="mt-4 w-full rounded-xl bg-mint-50 px-3 py-2.5 text-center text-[10px] leading-relaxed text-charcoal-600">
                  Arrive within 15 minutes of your start time. The operator scans this code to unlock the charger.
                </div>
              </div>
            </section>
          )}

          {completed && (
            <section className="rounded-3xl border border-lime-400/50 bg-lime/15 p-5">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-midnight-900" />
                <p className="text-[12px] font-semibold text-midnight-900">{booking.review ? 'Review submitted' : 'How was this session?'}</p>
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-charcoal-600">
                {booking.review
                  ? 'Thanks for helping other drivers choose the right station.'
                  : 'Your verified review takes under a minute and helps the whole network.'}
              </p>
              {!booking.review && (
                <Link to={`/app/reviews?booking=${booking.id}`} className={buttonVariants({ variant: 'dark', size: 'sm', className: 'mt-3' })}>
                  <Star className="h-3.5 w-3.5" /> Write a review
                </Link>
              )}
            </section>
          )}

          <section className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-midnight-800" />
              <h2 className="font-display text-base font-semibold text-midnight-900">Need to change something?</h2>
            </div>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">
              Bookings cannot be edited after payment. Cancel and rebook, or contact support and we will help.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/app/support" className={buttonVariants({ variant: 'outline', size: 'sm' })}>Contact support</Link>
              {cancelled && <Link to={`/app/bookings/new/${booking.station_id}?charger=${booking.charger_id}`} className={buttonVariants({ size: 'sm' })}>Rebook</Link>}
            </div>
          </section>

          <section className="rounded-3xl border border-midnight-900/[0.07] bg-midnight-950 p-5 text-white">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-lime">Operator</p>
            <p className="mt-2 text-[12.5px] font-semibold">{booking.station?.operator?.business_name ?? 'Verified EV Naija operator'}</p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-white/45">
              {booking.station?.operator?.business_description ?? 'This station is verified and monitored by EV Naija.'}
            </p>
            {booking.station?.contact_phone && (
              <p className="mt-2 text-[10.5px] text-white/55">Station phone: {booking.station.contact_phone}</p>
            )}
          </section>
        </aside>
      </div>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this booking?"
        description="Cancellations are subject to the refund policy. Free cancellation applies up to 2 hours before the session."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep booking</Button>
            <Button variant="danger" loading={cancelling} onClick={handleCancel}>Cancel booking</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-800">
            <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5" /> Before you cancel</p>
            <p className="mt-1">The platform service fee is non-refundable. Charging fees may be partially refunded depending on timing.</p>
          </div>
          <label className="label-base" htmlFor="cancel-reason">Why are you cancelling?</label>
          <Textarea id="cancel-reason" rows={3} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Plans changed, charger unavailable, booked by mistake…" />
        </div>
      </Modal>
    </div>
  )
}
