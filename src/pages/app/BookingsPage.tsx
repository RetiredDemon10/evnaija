import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  BellRing,
  CalendarCheck,
  CalendarClock,
  Clock,
  MapPin,
  PlugZap,
  Repeat2,
  Search,
  Star,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  bookNextSeriesOccurrence,
  cancelBookingSeries,
  listBookingSeries,
  listCustomerBookings,
} from '@/services/bookings'
import { cancelWaitlist, listWaitlist } from '@/services/waitlist'
import type { Booking, BookingSeries, WaitlistEntry } from '@/types'
import { PageHeader, Tabs, DataTable, SectionCard, type Column } from '@/components/ui/Data'
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/booking/StatusBadges'
import { Badge } from '@/components/ui/Badge'
import { TableEmpty, ExportButton } from '@/components/dashboard/Kit'
import { Button, buttonVariants } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { usePageTitle } from '@/hooks/usePageTitle'
import { isFuture as isFutureDate, parseISO } from 'date-fns'
import { recurrenceShortLabels, seriesRemaining } from '@/lib/recurrence'
import { formatDate, formatDateTime, formatNaira } from '@/lib/utils'

const isFuture = (date: string) => isFutureDate(parseISO(date))

type Filter = 'all' | 'upcoming' | 'completed' | 'cancelled'

export default function BookingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [seriesToCancel, setSeriesToCancel] = useState<BookingSeries | null>(null)
  const [busySeries, setBusySeries] = useState<string | null>(null)
  const [busyWaitlist, setBusyWaitlist] = useState<string | null>(null)
  usePageTitle('My bookings')

  const { data: bookings = [], isLoading, error, refetch } = useQuery({
    queryKey: ['customer-bookings', user?.id],
    queryFn: () => listCustomerBookings(user?.id),
    enabled: Boolean(user?.id),
  })
  const seriesQuery = useQuery({
    queryKey: ['booking-series', user?.id],
    queryFn: () => listBookingSeries(user?.id),
    enabled: Boolean(user?.id),
  })
  const waitlistQuery = useQuery({
    queryKey: ['waitlist', user?.id],
    queryFn: () => listWaitlist(user?.id),
    enabled: Boolean(user?.id),
  })

  const activeSeries = (seriesQuery.data ?? []).filter((series) => series.status === 'active')
  const openWaitlist = (waitlistQuery.data ?? []).filter(
    (entry) => entry.status === 'pending' || entry.status === 'notified',
  )

  const handleBookNext = async (series: BookingSeries) => {
    setBusySeries(series.id)
    try {
      const booking = await bookNextSeriesOccurrence(series.id)
      await queryClient.invalidateQueries({ queryKey: ['customer-bookings', user?.id] })
      await queryClient.invalidateQueries({ queryKey: ['booking-series', user?.id] })
      toast.success('Next session held', 'Complete payment within 15 minutes to confirm it.')
      navigate(`/app/bookings/${booking.id}?created=1&series=1`)
    } catch (err) {
      toast.error('Could not reserve the next session', (err as Error).message)
    } finally {
      setBusySeries(null)
    }
  }

  const handleStopSeries = async () => {
    if (!seriesToCancel) return
    setBusySeries(seriesToCancel.id)
    try {
      await cancelBookingSeries(seriesToCancel.id)
      await queryClient.invalidateQueries({ queryKey: ['booking-series', user?.id] })
      await queryClient.invalidateQueries({ queryKey: ['customer-bookings', user?.id] })
      toast.success('Recurring plan stopped', 'Confirmed bookings were left unchanged.')
      setSeriesToCancel(null)
    } catch (err) {
      toast.error('Could not stop the recurring plan', (err as Error).message)
    } finally {
      setBusySeries(null)
    }
  }

  const handleLeaveWaitlist = async (entry: WaitlistEntry) => {
    setBusyWaitlist(entry.id)
    try {
      await cancelWaitlist(entry.id)
      await queryClient.invalidateQueries({ queryKey: ['waitlist', user?.id] })
      toast.success('Removed from waitlist', 'You will no longer receive alerts for that slot.')
    } catch (err) {
      toast.error('Could not update the waitlist', (err as Error).message)
    } finally {
      setBusyWaitlist(null)
    }
  }

  const counts = useMemo(
    () => ({
      all: bookings.length,
      upcoming: bookings.filter((booking) => ['confirmed', 'checked_in', 'pending_payment'].includes(booking.status) && isFuture(booking.start_time)).length,
      completed: bookings.filter((booking) => booking.status === 'completed').length,
      cancelled: bookings.filter((booking) => ['cancelled', 'expired', 'refunded'].includes(booking.status)).length,
    }),
    [bookings],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return bookings.filter((booking) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'upcoming' && ['confirmed', 'checked_in', 'pending_payment'].includes(booking.status) && isFuture(booking.start_time)) ||
        (filter === 'completed' && booking.status === 'completed') ||
        (filter === 'cancelled' && ['cancelled', 'expired', 'refunded'].includes(booking.status))
      const matchesSearch =
        !term ||
        booking.station?.name.toLowerCase().includes(term) ||
        booking.booking_reference.toLowerCase().includes(term) ||
        booking.charger?.name.toLowerCase().includes(term)
      return matchesFilter && matchesSearch
    })
  }, [bookings, filter, search])

  const columns: Column<Booking>[] = [
    {
      key: 'reference',
      header: 'Booking',
      render: (booking) => (
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint text-midnight-800"><PlugZap className="h-3.5 w-3.5" /></span>
          <div>
            <p className="font-mono text-[11px] font-medium text-midnight-900">{booking.booking_reference}</p>
            <p className="text-[10px] text-muted">{formatDate(booking.created_at)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'station',
      header: 'Station & charger',
      render: (booking) => (
        <div>
          <p className="text-[12.5px] font-semibold text-midnight-900">{booking.station?.name ?? '—'}</p>
          <p className="text-[10.5px] text-muted">{booking.charger?.name ?? '—'} · {booking.charger?.capacity_kw ?? 0} kW</p>
        </div>
      ),
    },
    {
      key: 'schedule',
      header: 'Schedule',
      render: (booking) => (
        <div>
          <p className="text-[12px] font-medium text-charcoal-700">{formatDate(booking.start_time, 'EEE, dd MMM yyyy')}</p>
          <p className="font-mono text-[10.5px] text-muted">{formatDate(booking.start_time, 'HH:mm')} – {formatDate(booking.end_time, 'HH:mm')}</p>
          {booking.series_id && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-mint px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wide text-midnight-800">
              <Repeat2 className="h-2.5 w-2.5" /> Recurring
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (booking) => <span className="font-mono text-[12px] font-medium text-midnight-900">{formatNaira(booking.total_amount)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (booking) => (
        <div className="flex flex-col gap-1">
          <BookingStatusBadge status={booking.status} />
          {booking.payment_status !== 'success' && <span className="text-[9px] uppercase tracking-wider text-muted">{booking.payment_status}</span>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (booking) => (
        <Link to={`/app/bookings/${booking.id}`} className="inline-flex h-8 items-center rounded-lg border border-midnight-900/10 px-3 text-[11px] font-semibold text-charcoal-700 hover:bg-mint-50">
          Manage
        </Link>
      ),
    },
  ]

  if (isLoading) return <PageLoader label="Loading bookings" />
  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="font-semibold text-red-800">Could not load your bookings.</p>
        <p className="mt-1 text-sm text-red-600">{(error as Error).message}</p>
        <Button className="mt-4" variant="outline" onClick={() => void refetch()}>Try again</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reservations"
        title="My bookings"
        description="Every reservation, receipt and QR code in one place. Cancel or review a session from its detail page."
        actions={
          <>
            <ExportButton
              filename="ev-naija-bookings.csv"
              rows={filtered.map((booking) => ({
                reference: booking.booking_reference,
                station: booking.station?.name ?? '',
                charger: booking.charger?.name ?? '',
                start: booking.start_time,
                end: booking.end_time,
                amount: booking.total_amount,
                status: booking.status,
                payment: booking.payment_status,
              }))}
            />
            <Link to="/app/stations" className={buttonVariants({ size: 'md' })}>
              <Zap className="h-4 w-4" /> New booking
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Upcoming', value: counts.upcoming, icon: CalendarCheck, hint: 'Confirmed or awaiting payment' },
          { label: 'Completed', value: counts.completed, icon: Star, hint: 'Sessions ready to review' },
          { label: 'Total value', value: formatNaira(bookings.filter((booking) => booking.payment_status === 'success').reduce((sum, booking) => sum + booking.total_amount, 0)), icon: Clock, hint: 'Across successful payments' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{stat.label}</p>
              <stat.icon className="h-4 w-4 text-midnight-700" />
            </div>
            <p className="mt-2 font-mono text-xl font-medium text-midnight-900">{stat.value}</p>
            <p className="mt-0.5 text-[10px] text-muted">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Recurring plans"
          description="One-tap reservations for regular charging. Future sessions are never charged automatically."
          action={<Repeat2 className="h-4 w-4 text-midnight-700" />}
        >
          {activeSeries.length ? (
            <div className="space-y-3">
              {activeSeries.map((series) => {
                const remaining = seriesRemaining(series)
                return (
                  <div key={series.id} className="rounded-2xl border border-midnight-900/[0.08] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-semibold text-midnight-900">{series.station?.name ?? 'Station'}</p>
                        <p className="mt-0.5 text-[10.5px] text-muted">
                          {series.charger?.name ?? 'Charger'} · {recurrenceShortLabels[series.frequency]}
                        </p>
                      </div>
                      <Badge tone="lime"><Repeat2 className="h-3 w-3" /> Active</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[10.5px]">
                      <span className="flex items-center gap-1.5 text-muted">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Next: {formatDate(series.next_start_time, 'EEE, dd MMM · HH:mm')}
                      </span>
                      <span className="flex items-center gap-1.5 font-mono text-charcoal-600">
                        {series.bookings_created}/{series.occurrences} sessions booked
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => void handleBookNext(series)}
                        loading={busySeries === series.id}
                        disabled={remaining === 0}
                      >
                        <CalendarClock className="h-3.5 w-3.5" /> Book next session
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSeriesToCancel(series)}
                        disabled={busySeries === series.id}
                      >
                        Stop plan
                      </Button>
                      {remaining > 0 && (
                        <span className="text-[10px] text-muted">{remaining} remaining</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-midnight-900/15 p-5 text-center">
              <Repeat2 className="mx-auto h-5 w-5 text-charcoal-300" />
              <p className="mt-2 text-[12px] font-semibold text-midnight-900">No recurring plans yet</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
                Turn on “Make it a recurring plan” when you book a charger to create one.
              </p>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Waitlist"
          description="We alert you here and on this device when a matching slot opens."
          action={<BellRing className="h-4 w-4 text-midnight-700" />}
        >
          {openWaitlist.length ? (
            <div className="space-y-3">
              {openWaitlist.map((entry) => {
                const target = `/app/bookings/new/${entry.station_id}?charger=${entry.charger_id ?? ''}&date=${entry.desired_date}`
                return (
                  <div key={entry.id} className="rounded-2xl border border-midnight-900/[0.08] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-semibold text-midnight-900">{entry.station?.name ?? 'Station'}</p>
                        <p className="mt-0.5 text-[10.5px] text-muted">
                          {formatDate(`${entry.desired_date}T12:00:00`, 'EEE, dd MMM yyyy')}
                          {entry.preferred_start ? ` · around ${entry.preferred_start.slice(0, 5)}` : ' · any time'}
                          {entry.charger ? ` · ${entry.charger.name}` : ''}
                        </p>
                      </div>
                      <Badge tone={entry.status === 'notified' ? 'lime' : 'neutral'}>
                        {entry.status === 'notified' ? 'Slot open' : 'Watching'}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {entry.status === 'notified' && (
                        <Link to={target} className={buttonVariants({ size: 'sm' })}>
                          Book now <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleLeaveWaitlist(entry)}
                        loading={busyWaitlist === entry.id}
                      >
                        Leave waitlist
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-midnight-900/15 p-5 text-center">
              <BellRing className="mx-auto h-5 w-5 text-charcoal-300" />
              <p className="mt-2 text-[12px] font-semibold text-midnight-900">Nothing on your waitlist</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
                Join a waitlist from the booking screen when the time you need is full.
              </p>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'upcoming', label: 'Upcoming', count: counts.upcoming },
            { value: 'completed', label: 'Completed', count: counts.completed },
            { value: 'cancelled', label: 'Cancelled', count: counts.cancelled },
          ]}
        />
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search station or reference"
            className="input-base h-9 pl-9 text-[12px]"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        onRowClick={(booking) => navigate(`/app/bookings/${booking.id}`)}
        empty={
          <TableEmpty
            title={filter === 'all' ? 'No bookings yet' : `No ${filter} bookings`}
            description="Your reservations will appear here once you book a charging slot."
            action={<Link to="/app/stations" className={buttonVariants({ size: 'sm' })}>Find a charger</Link>}
          />
        }
        mobileRender={(booking) => (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-midnight-900">{booking.station?.name}</p>
                <p className="mt-0.5 font-mono text-[10px] text-muted">{booking.booking_reference}</p>
              </div>
              <BookingStatusBadge status={booking.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <span className="flex items-center gap-1 text-muted"><CalendarCheck className="h-3 w-3" /> {formatDateTime(booking.start_time)}</span>
              <span className="flex items-center gap-1 text-muted"><MapPin className="h-3 w-3" /> {booking.station?.city}</span>
              <span className="flex items-center gap-1 font-mono font-medium text-midnight-900">{formatNaira(booking.total_amount)}</span>
              <span className="flex items-center gap-1"><PaymentStatusBadge status={booking.payment_status} /></span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-midnight-900/[0.06] pt-3">
              <span className="text-[10px] text-muted">{formatDate(booking.start_time, 'EEE, dd MMM')} · {formatDate(booking.start_time, 'HH:mm')}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-lime-700">Manage <ArrowUpRight className="h-3 w-3" /></span>
            </div>
          </div>
        )}
      />

      <Modal
        open={Boolean(seriesToCancel)}
        onClose={() => setSeriesToCancel(null)}
        title="Stop this recurring plan?"
        description="You can always create a new plan later."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSeriesToCancel(null)}>Keep plan</Button>
            <Button
              variant="danger"
              loading={Boolean(seriesToCancel && busySeries === seriesToCancel.id)}
              onClick={() => void handleStopSeries()}
            >
              Stop plan
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-charcoal-600">
          We will close {seriesToCancel?.station?.name ? `your plan at ${seriesToCancel.station.name}` : 'this plan'} and release any unpaid holds.
          Confirmed or paid bookings are left unchanged, so cancel those separately from their booking pages if needed.
        </p>
      </Modal>
    </div>
  )
}
