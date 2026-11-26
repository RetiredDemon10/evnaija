import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Car,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Mail,
  MapPin,
  Phone,
  Play,
  QrCode,
  ShieldCheck,
  User,
  Zap,
} from 'lucide-react'
import { useOperatorData } from '@/hooks/useOperatorData'
import { listOperatorBookings, updateBookingStatusOperator } from '@/services/operator'
import { PageHeader, SectionCard } from '@/components/ui/Data'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Field, Textarea } from '@/components/ui/Form'
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/booking/StatusBadges'
import { DetailRow, InfoNote } from '@/components/dashboard/Kit'
import { ErrorState, PageLoader, useToast } from '@/components/ui/Feedback'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatDateTime, formatNaira, humanize, cn } from '@/lib/utils'
import type { BookingStatus } from '@/types'

const NEXT: Partial<Record<BookingStatus, { status: BookingStatus; label: string; icon: typeof Check; description: string }>> = {
  confirmed: {
    status: 'checked_in',
    label: 'Check driver in',
    icon: CheckCircle2,
    description: 'Confirm the driver is at the station with the matching vehicle. The charger will be reserved for their session.',
  },
  checked_in: {
    status: 'in_progress',
    label: 'Start charging session',
    icon: Play,
    description: 'Confirm the connector is securely attached and the vehicle is charging before starting.',
  },
  in_progress: {
    status: 'completed',
    label: 'Complete session',
    icon: Zap,
    description: 'End the session only after the vehicle is unplugged. This finalises the operator earnings ledger.',
  },
}

export default function OperatorBookingDetailPage() {
  const { id = '' } = useParams()
  const { stationIds, operatorId, isLoading } = useOperatorData()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [actionOpen, setActionOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [working, setWorking] = useState(false)
  usePageTitle('Booking detail')

  const { data: bookings = [], isLoading: loadingBookings, error, refetch } = useQuery({
    queryKey: ['operator-bookings', operatorId, stationIds],
    queryFn: () => listOperatorBookings(stationIds),
    enabled: Boolean(operatorId) && stationIds.length > 0,
  })

  const booking = bookings.find((item) => item.id === id)
  const next = booking ? NEXT[booking.status] : undefined

  const advance = async () => {
    if (!booking || !next) return
    setWorking(true)
    try {
      await updateBookingStatusOperator(booking.id, next.status, notes.trim() || next.label)
      await queryClient.invalidateQueries({ queryKey: ['operator-bookings'] })
      await queryClient.invalidateQueries({ queryKey: ['operator-stats'] })
      await queryClient.invalidateQueries({ queryKey: ['operator-transactions'] })
      await refetch()
      toast.success(next.label, `${booking.booking_reference} is now ${next.status.replace('_', ' ')}.`)
      setActionOpen(false)
      setNotes('')
    } catch (err) {
      toast.error('Could not update booking', (err as Error).message)
    } finally {
      setWorking(false)
    }
  }

  if (isLoading || loadingBookings) return <PageLoader label="Loading booking" />
  if (error) return <ErrorState description={(error as Error).message} onRetry={() => void refetch()} />
  if (!booking) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
        <p className="font-semibold text-amber-900">Booking not found</p>
        <p className="mt-1 text-sm text-amber-700">It may belong to another operator's station.</p>
        <Link to="/operator/bookings" className="mt-4 inline-flex h-10 items-center rounded-xl bg-midnight-900 px-4 text-[12px] font-semibold text-lime">Back to bookings</Link>
      </div>
    )
  }

  const timeline = [
    { label: 'Booked & paid', value: booking.created_at, done: booking.payment_status === 'success' },
    { label: 'Checked in', value: booking.checked_in_at, done: Boolean(booking.checked_in_at) },
    { label: 'Session started', value: booking.started_at, done: Boolean(booking.started_at) },
    { label: 'Session completed', value: booking.completed_at, done: Boolean(booking.completed_at) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/operator/bookings" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted hover:text-midnight-900"><ArrowLeft className="h-3.5 w-3.5" /> All bookings</Link>
        <div className="flex items-center gap-2"><BookingStatusBadge status={booking.status} /><PaymentStatusBadge status={booking.payment_status} /></div>
      </div>

      <PageHeader
        eyebrow={`Booking ${booking.booking_reference}`}
        title={booking.customer?.full_name ?? 'Driver session'}
        description={`${booking.station?.name ?? 'Station'} · ${formatDate(booking.start_time, 'EEEE, dd MMMM yyyy · HH:mm')}`}
        actions={
          next ? (
            <Button size="lg" onClick={() => setActionOpen(true)}><next.icon className="h-4 w-4" /> {next.label}</Button>
          ) : (
            <Badge tone={booking.status === 'completed' ? 'success' : 'neutral'}>{humanize(booking.status)}</Badge>
          )
        }
      />

      {booking.status === 'pending_payment' && (
        <InfoNote title="Awaiting payment" tone="warning">
          The charger is held but the driver has not completed payment. Do not release the slot manually until the hold
          expires or the booking is cancelled.
        </InfoNote>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <div className="space-y-5">
          <SectionCard title="Session details" description="Verify these details before checking the driver in.">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Station', value: booking.station?.name ?? '—', sub: `${booking.station?.address ?? ''}, ${booking.station?.city ?? ''}`, icon: MapPin },
                { label: 'Charger', value: booking.charger?.name ?? '—', sub: `${booking.charger?.charger_code ?? ''} · ${booking.charger?.capacity_kw ?? 0} kW`, icon: Zap },
                { label: 'Start time', value: formatDate(booking.start_time, 'ddd, dd MMM yyyy'), sub: formatDate(booking.start_time, 'HH:mm'), icon: Clock },
                { label: 'Duration', value: `${booking.duration_minutes} minutes`, sub: `${booking.energy_kwh.toFixed(1)} kWh estimated`, icon: Play },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-mint-50 p-4">
                  <div className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted"><item.icon className="h-3 w-3" /> {item.label}</div>
                  <p className="mt-1.5 text-[12.5px] font-semibold text-midnight-900">{item.value}</p>
                  <p className="mt-0.5 text-[10px] text-muted">{item.sub}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-midnight-900/[0.07] px-4 py-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted"><QrCode className="h-3 w-3" /> Check-in code</p>
              <p className="mt-1.5 break-all font-mono text-[10.5px] text-charcoal-600">{booking.qr_code}</p>
              <p className="mt-1 text-[9px] text-muted">If the driver cannot show their QR, verify their name, vehicle and booking reference before manual check-in.</p>
            </div>
          </SectionCard>

          <SectionCard title="Driver & vehicle" description="Contact details are only visible to the operator for this booking.">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-midnight-900/[0.07] p-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-midnight-900 text-lime"><User className="h-4 w-4" /></span>
                  <div>
                    <p className="text-[12.5px] font-semibold text-midnight-900">{booking.customer?.full_name ?? 'Driver'}</p>
                    <p className="text-[10px] text-muted">Customer</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 text-[10.5px]">
                  {booking.customer?.phone && <p className="flex items-center gap-1.5 text-charcoal-600"><Phone className="h-3 w-3 text-muted" /> {booking.customer.phone}</p>}
                  {booking.customer?.email && <p className="flex items-center gap-1.5 text-charcoal-600"><Mail className="h-3 w-3 text-muted" /> {booking.customer.email}</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-midnight-900/[0.07] p-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-mint text-midnight-800"><Car className="h-4 w-4" /></span>
                  <div>
                    <p className="text-[12.5px] font-semibold text-midnight-900">{booking.vehicle ? `${booking.vehicle.manufacturer} ${booking.vehicle.model}` : 'No vehicle on file'}</p>
                    <p className="text-[10px] text-muted">{booking.vehicle ? `${booking.vehicle.year} · ${booking.vehicle.battery_capacity_kwh} kWh` : 'Verify vehicle at station'}</p>
                  </div>
                </div>
                {booking.vehicle && (
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-charcoal-600">{booking.vehicle.registration_number ?? 'No plate'} · {booking.vehicle.connector_type.toUpperCase()}</p>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Settlement" description="What this session contributes to your business.">
            <div className="divide-y divide-midnight-900/[0.06]">
              <DetailRow label="Charging fee" value={formatNaira(booking.charging_fee)} mono />
              <DetailRow label="Your booking fee" value={formatNaira(booking.booking_fee)} mono />
              <DetailRow label="Platform commission" value={`− ${formatNaira(booking.platform_commission)}`} mono />
              <div className="flex items-center justify-between py-3">
                <span className="text-[12.5px] font-semibold text-midnight-900">Your net earning</span>
                <span className="font-mono text-lg font-medium text-midnight-900">{formatNaira(booking.operator_earning)}</span>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-mint-50 px-3 py-2.5 text-[10px] text-charcoal-600">
              <ShieldCheck className="h-3.5 w-3.5 text-lime-600" /> Earnings settle after completion and are available for payout per the settlement schedule.
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-5">
          <SectionCard title="Progress" description="Keep the status accurate for the driver and ledger.">
            <div className="space-y-0">
              {timeline.map((step, index) => (
                <div key={step.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={cn('grid h-6 w-6 place-items-center rounded-full', step.done ? 'bg-lime text-midnight-900' : 'border border-charcoal-200 bg-white text-charcoal-300')}>
                      {step.done ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                    </span>
                    {index < timeline.length - 1 && <span className={cn('my-1 h-7 w-0.5', step.done ? 'bg-lime/50' : 'bg-charcoal-100')} />}
                  </div>
                  <div className="pb-3">
                    <p className={cn('text-[11.5px] font-semibold', step.done ? 'text-midnight-900' : 'text-charcoal-400')}>{step.label}</p>
                    <p className="mt-0.5 font-mono text-[9.5px] text-muted">{step.value ? formatDateTime(step.value) : 'Pending'}</p>
                  </div>
                </div>
              ))}
            </div>
            {next && <Button className="mt-2 w-full" onClick={() => setActionOpen(true)}><next.icon className="h-4 w-4" /> {next.label}</Button>}
          </SectionCard>

          <SectionCard title="Payment" description="Server-verified transaction.">
            <div className="divide-y divide-midnight-900/[0.06]">
              <DetailRow label="Status" value={<PaymentStatusBadge status={booking.payment_status} />} />
              <DetailRow label="Reference" value={booking.payment?.reference ?? '—'} mono />
              <DetailRow label="Channel" value={humanize(booking.payment?.channel ?? '—')} />
              <DetailRow label="Paid at" value={booking.payment?.paid_at ? formatDateTime(booking.payment.paid_at) : '—'} />
              <DetailRow label="Total charged" value={formatNaira(booking.total_amount)} mono />
            </div>
          </SectionCard>

          <div className="rounded-3xl bg-midnight-950 p-5 text-white">
            <CreditCard className="h-4 w-4 text-lime" />
            <p className="mt-2 text-[12px] font-semibold">Do not accept direct payments</p>
            <p className="mt-1 text-[10px] leading-relaxed text-white/45">
              Asking a driver to pay outside EV Naija bypasses insurance, receipts and dispute protection. Report payment
              requests to support immediately.
            </p>
          </div>
        </aside>
      </div>

      <Modal
        open={actionOpen}
        onClose={() => setActionOpen(false)}
        title={next?.label ?? 'Update booking'}
        description={next?.description}
        footer={
          <>
            <Button variant="outline" onClick={() => setActionOpen(false)}>Cancel</Button>
            <Button loading={working} onClick={advance}>{next?.label ?? 'Confirm'}</Button>
          </>
        }
      >
        <Field label="Operator note (optional)" hint="Recorded on the booking status history for audit purposes.">
          <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. Verified driver licence and QR at bay A." />
        </Field>
        <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-[10.5px] leading-relaxed text-amber-800">
          Only continue if the physical conditions are correct. This action is recorded and cannot be silently undone.
        </div>
      </Modal>
    </div>
  )
}
