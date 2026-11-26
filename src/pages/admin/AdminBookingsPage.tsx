import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, CheckCircle2, Clock, MapPin, Play, Search, User, Zap } from 'lucide-react'
import { listAllBookings } from '@/services/admin'
import { updateBookingStatusOperator } from '@/services/operator'
import type { Booking } from '@/types'
import { PageHeader, DataTable, Pagination, Tabs, type Column } from '@/components/ui/Data'
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/booking/StatusBadges'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Field, Textarea } from '@/components/ui/Form'
import { DetailRow, ExportButton, SelectFilter, TableEmpty, usePaged } from '@/components/dashboard/Kit'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatDateTime, formatNaira, humanize } from '@/lib/utils'

type Filter = 'all' | 'active' | 'completed' | 'cancelled' | 'unpaid'

export default function AdminBookingsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('all')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<Booking | null>(null)
  const [action, setAction] = useState<{ booking: Booking; status: Booking['status'] } | null>(null)
  const [notes, setNotes] = useState('')
  const [working, setWorking] = useState(false)
  usePageTitle('All bookings')

  const { data: bookings = [], isLoading } = useQuery({ queryKey: ['admin-bookings'], queryFn: listAllBookings })

  const cities = useMemo(() => Array.from(new Set(bookings.map((booking) => booking.station?.city).filter(Boolean))) as string[], [bookings])
  const counts = useMemo(() => ({
    all: bookings.length,
    active: bookings.filter((booking) => ['confirmed', 'checked_in', 'in_progress'].includes(booking.status)).length,
    completed: bookings.filter((booking) => booking.status === 'completed').length,
    cancelled: bookings.filter((booking) => ['cancelled', 'expired', 'refunded'].includes(booking.status)).length,
    unpaid: bookings.filter((booking) => booking.payment_status !== 'success').length,
  }), [bookings])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return bookings.filter((booking) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && ['confirmed', 'checked_in', 'in_progress'].includes(booking.status)) ||
        (filter === 'completed' && booking.status === 'completed') ||
        (filter === 'cancelled' && ['cancelled', 'expired', 'refunded'].includes(booking.status)) ||
        (filter === 'unpaid' && booking.payment_status !== 'success')
      const matchesCity = city === 'all' || booking.station?.city === city
      const matchesSearch =
        !term ||
        booking.booking_reference.toLowerCase().includes(term) ||
        (booking.customer?.full_name ?? '').toLowerCase().includes(term) ||
        (booking.customer?.email ?? '').toLowerCase().includes(term) ||
        (booking.station?.name ?? '').toLowerCase().includes(term)
      return matchesFilter && matchesCity && matchesSearch
    })
  }, [bookings, filter, city, search])

  const { rows, pageCount } = usePaged(filtered, 14, page)

  const nextStatus = (booking: Booking) =>
    booking.status === 'confirmed' ? 'checked_in' : booking.status === 'checked_in' ? 'in_progress' : booking.status === 'in_progress' ? 'completed' : null

  const submitStatus = async () => {
    if (!action) return
    setWorking(true)
    try {
      await updateBookingStatusOperator(action.booking.id, action.status, notes.trim() || 'Admin override')
      await queryClient.invalidateQueries({ queryKey: ['admin-bookings'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-payments'] })
      toast.success('Booking updated', `${action.booking.booking_reference} is now ${action.status.replace('_', ' ')}.`)
      setAction(null)
      setNotes('')
      setDetail(null)
    } catch (error) {
      toast.error('Could not update booking', (error as Error).message)
    } finally {
      setWorking(false)
    }
  }

  const columns: Column<Booking>[] = [
    {
      key: 'reference',
      header: 'Booking',
      render: (booking) => (
        <div>
          <p className="font-mono text-[11px] font-medium text-midnight-900">{booking.booking_reference}</p>
          <p className="text-[9.5px] text-muted">{formatDate(booking.created_at, 'dd MMM yyyy · HH:mm')}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (booking) => (
        <div>
          <p className="text-[11.5px] font-semibold text-midnight-900">{booking.customer?.full_name ?? 'Driver'}</p>
          <p className="text-[9.5px] text-muted">{booking.customer?.email ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'station',
      header: 'Station',
      render: (booking) => (
        <div>
          <p className="text-[11px] text-charcoal-700">{booking.station?.name ?? '—'}</p>
          <p className="flex items-center gap-1 text-[9.5px] text-muted"><MapPin className="h-2.5 w-2.5" /> {booking.station?.city ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'session',
      header: 'Session',
      render: (booking) => (
        <div>
          <p className="text-[10.5px] text-charcoal-700">{formatDate(booking.start_time, 'dd MMM · HH:mm')}</p>
          <p className="text-[9.5px] text-muted">{booking.duration_minutes}m · {booking.energy_kwh.toFixed(1)} kWh</p>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (booking) => <span className="font-mono text-[11.5px] font-medium text-midnight-900">{formatNaira(booking.total_amount)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (booking) => <div className="flex flex-col gap-1"><BookingStatusBadge status={booking.status} /><PaymentStatusBadge status={booking.payment_status} /></div>,
    },
    {
      key: 'actions',
      header: '',
      render: (booking) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => setDetail(booking)} className="inline-flex h-8 items-center rounded-lg border border-midnight-900/10 px-2.5 text-[10px] font-semibold text-charcoal-600 hover:bg-mint-50">View</button>
          {nextStatus(booking) && (
            <button onClick={() => setAction({ booking, status: nextStatus(booking)! })} className="inline-flex h-8 items-center gap-1 rounded-lg bg-midnight-900 px-2.5 text-[10px] font-semibold text-lime hover:bg-midnight-800">
              {booking.status === 'confirmed' ? <><CheckCircle2 className="h-3 w-3" /> In</> : booking.status === 'checked_in' ? <><Play className="h-3 w-3" /> Start</> : <><Zap className="h-3 w-3" /> End</>}
            </button>
          )}
        </div>
      ),
    },
  ]

  if (isLoading) return <PageLoader label="Loading bookings" />

  const revenue = bookings.filter((booking) => booking.payment_status === 'success').reduce((sum, booking) => sum + booking.total_amount, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bookings & finance"
        title="All bookings"
        description="Every reservation on the platform, with payment and session state. Use overrides sparingly and document them."
        actions={<ExportButton filename="ev-naija-bookings.csv" rows={filtered.map((booking) => ({ reference: booking.booking_reference, customer: booking.customer?.full_name ?? '', email: booking.customer?.email ?? '', station: booking.station?.name ?? '', city: booking.station?.city ?? '', start: booking.start_time, duration: booking.duration_minutes, energy: booking.energy_kwh, total: booking.total_amount, commission: booking.platform_commission, operatorEarning: booking.operator_earning, status: booking.status, payment: booking.payment_status }))} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total bookings', value: counts.all, icon: CalendarCheck, hint: 'All time' },
          { label: 'Active', value: counts.active, icon: Clock, hint: 'Confirmed or charging' },
          { label: 'Completed', value: counts.completed, icon: CheckCircle2, hint: 'Sessions delivered' },
          { label: 'Gross paid value', value: formatNaira(revenue, { compact: true }), icon: User, hint: 'Successful payments' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
            <div className="flex items-center justify-between"><p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{stat.label}</p><stat.icon className="h-4 w-4 text-midnight-700" /></div>
            <p className="mt-2 font-mono text-xl font-medium text-midnight-900">{stat.value}</p>
            <p className="mt-0.5 text-[9.5px] text-muted">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          value={filter}
          onChange={(value) => { setFilter(value); setPage(1) }}
          tabs={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'active', label: 'Active', count: counts.active },
            { value: 'completed', label: 'Completed', count: counts.completed },
            { value: 'cancelled', label: 'Cancelled', count: counts.cancelled },
            { value: 'unpaid', label: 'Unpaid', count: counts.unpaid },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search reference, customer or station" className="input-base h-9 pl-9 text-[11px]" />
          </div>
          <SelectFilter value={city} onChange={(value) => { setCity(value); setPage(1) }} options={[{ value: 'all', label: 'All cities' }, ...cities.map((value) => ({ value, label: value }))]} />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        minWidth={900}
        empty={<TableEmpty title="No bookings in this view" description="Try clearing filters or selecting another tab." />}
        mobileRender={(booking) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[12px] font-semibold text-midnight-900">{booking.customer?.full_name ?? 'Driver'}</p>
                <p className="font-mono text-[9px] text-muted">{booking.booking_reference}</p>
              </div>
              <BookingStatusBadge status={booking.status} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] text-muted">
              <span>{booking.station?.name}</span>
              <span className="text-right">{formatDate(booking.start_time, 'dd MMM HH:mm')}</span>
              <span>{formatNaira(booking.total_amount)}</span>
              <span className="text-right"><PaymentStatusBadge status={booking.payment_status} /></span>
            </div>
            <button onClick={() => setDetail(booking)} className="mt-2 text-[10.5px] font-semibold text-lime-700">Open booking details</button>
          </div>
        )}
      />
      <Pagination page={page} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={14} />

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.booking_reference ?? 'Booking'}
        description={detail ? `${detail.customer?.full_name ?? 'Driver'} · ${detail.station?.name ?? 'Station'}` : undefined}
        footer={detail ? (
          <>
            <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
            {nextStatus(detail) && <Button onClick={() => setAction({ booking: detail, status: nextStatus(detail)! })}>Advance status</Button>}
          </>
        ) : undefined}
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <BookingStatusBadge status={detail.status} />
              <PaymentStatusBadge status={detail.payment_status} />
              <Badge tone="neutral">{detail.charger?.name ?? 'Charger'}</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { label: 'Customer', value: `${detail.customer?.full_name ?? '—'} · ${detail.customer?.email ?? ''}` },
                { label: 'Station', value: `${detail.station?.name ?? '—'}, ${detail.station?.city ?? ''}` },
                { label: 'Start', value: formatDateTime(detail.start_time) },
                { label: 'End', value: formatDateTime(detail.end_time) },
                { label: 'Duration', value: `${detail.duration_minutes} minutes` },
                { label: 'Energy', value: `${detail.energy_kwh.toFixed(1)} kWh` },
                { label: 'Vehicle', value: detail.vehicle ? `${detail.vehicle.manufacturer} ${detail.vehicle.model} (${detail.vehicle.registration_number ?? 'no plate'})` : 'Not provided' },
                { label: 'QR check-in', value: detail.qr_code },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-mint-50 px-3 py-2.5">
                  <p className="text-[8.5px] uppercase tracking-[0.12em] text-muted">{item.label}</p>
                  <p className="mt-0.5 break-all text-[10.5px] text-charcoal-700">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="divide-y divide-midnight-900/[0.06] rounded-2xl border border-midnight-900/[0.07] px-4">
              <DetailRow label="Charging fee" value={formatNaira(detail.charging_fee)} mono />
              <DetailRow label="Booking fee" value={formatNaira(detail.booking_fee)} mono />
              <DetailRow label="Service fee" value={formatNaira(detail.service_fee)} mono />
              <DetailRow label="VAT" value={formatNaira(detail.tax_amount)} mono />
              <DetailRow label="Total charged" value={formatNaira(detail.total_amount)} mono />
              <DetailRow label="Platform commission" value={formatNaira(detail.platform_commission)} mono />
              <DetailRow label="Operator earning" value={formatNaira(detail.operator_earning)} mono />
            </div>
            {detail.cancellation_reason && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-[10.5px] text-red-700">Cancelled: {detail.cancellation_reason}</p>}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title="Advance booking status"
        description={action ? `${action.booking.booking_reference} → ${humanize(action.status)}` : undefined}
        footer={<><Button variant="outline" onClick={() => setAction(null)}>Cancel</Button><Button loading={working} onClick={submitStatus}>Confirm status change</Button></>}
      >
        <Field label="Admin note" hint="Stored on the booking status history. Be specific about why you are overriding the operator.">
          <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. Operator confirmed the session ended but did not update the console." />
        </Field>
      </Modal>
    </div>
  )
}
