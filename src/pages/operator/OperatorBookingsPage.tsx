import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CalendarCheck, CheckCircle2, Clock, MapPin, Play, Search, Zap } from 'lucide-react'
import { useOperatorData } from '@/hooks/useOperatorData'
import { listOperatorBookings, updateBookingStatusOperator } from '@/services/operator'
import type { Booking } from '@/types'
import { PageHeader, DataTable, Tabs, type Column } from '@/components/ui/Data'
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/booking/StatusBadges'
import { ExportButton, TableEmpty } from '@/components/dashboard/Kit'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { SelectFilter } from '@/components/dashboard/Kit'
import { isFuture as isFutureDate, parseISO } from 'date-fns'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatNaira } from '@/lib/utils'

const isFuture = (date: Date) => isFutureDate(date)

type Filter = 'all' | 'active' | 'upcoming' | 'completed' | 'cancelled'

export default function OperatorBookingsPage() {
  const { stationIds, operatorId, stations, isLoading } = useOperatorData()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('all')
  const [stationFilter, setStationFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [working, setWorking] = useState('')
  usePageTitle('Operator bookings')

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['operator-bookings', operatorId, stationIds],
    queryFn: () => listOperatorBookings(stationIds),
    enabled: Boolean(operatorId) && stationIds.length > 0,
  })

  const counts = useMemo(() => ({
    all: bookings.length,
    active: bookings.filter((booking) => ['checked_in', 'in_progress'].includes(booking.status)).length,
    upcoming: bookings.filter((booking) => booking.status === 'confirmed' && isFuture(parseISO(booking.start_time))).length,
    completed: bookings.filter((booking) => booking.status === 'completed').length,
    cancelled: bookings.filter((booking) => ['cancelled', 'expired', 'refunded'].includes(booking.status)).length,
  }), [bookings])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return bookings.filter((booking) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && ['checked_in', 'in_progress'].includes(booking.status)) ||
        (filter === 'upcoming' && booking.status === 'confirmed') ||
        (filter === 'completed' && booking.status === 'completed') ||
        (filter === 'cancelled' && ['cancelled', 'expired', 'refunded'].includes(booking.status))
      const matchesStation = stationFilter === 'all' || booking.station_id === stationFilter
      const matchesSearch =
        !term ||
        booking.booking_reference.toLowerCase().includes(term) ||
        (booking.customer?.full_name ?? '').toLowerCase().includes(term) ||
        (booking.station?.name ?? '').toLowerCase().includes(term) ||
        (booking.customer?.email ?? '').toLowerCase().includes(term)
      return matchesFilter && matchesStation && matchesSearch
    })
  }, [bookings, filter, stationFilter, search])

  const advance = async (booking: Booking) => {
    const next =
      booking.status === 'confirmed'
        ? 'checked_in'
        : booking.status === 'checked_in'
          ? 'in_progress'
          : booking.status === 'in_progress'
            ? 'completed'
            : null
    if (!next) return
    setWorking(booking.id)
    try {
      await updateBookingStatusOperator(booking.id, next, `Updated by operator from bookings list`)
      await queryClient.invalidateQueries({ queryKey: ['operator-bookings'] })
      await queryClient.invalidateQueries({ queryKey: ['operator-stats'] })
      toast.success(
        next === 'checked_in' ? 'Driver checked in' : next === 'in_progress' ? 'Session started' : 'Session completed',
        `${booking.booking_reference} is now ${next.replace('_', ' ')}.`,
      )
    } catch (error) {
      toast.error('Could not update booking', (error as Error).message)
    } finally {
      setWorking('')
    }
  }

  const columns: Column<Booking>[] = [
    {
      key: 'reference',
      header: 'Booking',
      render: (booking) => (
        <div>
          <p className="font-mono text-[11px] font-medium text-midnight-900">{booking.booking_reference}</p>
          <p className="text-[10px] text-muted">{formatDate(booking.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Driver',
      render: (booking) => (
        <div>
          <p className="text-[12px] font-semibold text-midnight-900">{booking.customer?.full_name ?? 'Driver'}</p>
          <p className="text-[10px] text-muted">{booking.customer?.phone ?? booking.customer?.email ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'station',
      header: 'Station & charger',
      render: (booking) => (
        <div>
          <p className="text-[11.5px] text-charcoal-700">{booking.station?.name ?? 'Station'}</p>
          <p className="text-[10px] text-muted">{booking.charger?.name ?? 'Charger'}</p>
        </div>
      ),
    },
    {
      key: 'schedule',
      header: 'Session',
      render: (booking) => (
        <div>
          <p className="text-[11.5px] text-charcoal-700">{formatDate(booking.start_time, 'dd MMM')} · {formatDate(booking.start_time, 'HH:mm')}</p>
          <p className="text-[10px] text-muted">{booking.duration_minutes} min · {booking.energy_kwh.toFixed(1)} kWh</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Net earning',
      render: (booking) => <span className="font-mono text-[12px] font-medium text-midnight-900">{formatNaira(booking.operator_earning)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (booking) => (
        <div className="flex flex-col gap-1">
          <BookingStatusBadge status={booking.status} />
          <PaymentStatusBadge status={booking.payment_status} />
        </div>
      ),
    },
    {
      key: 'action',
      header: '',
      render: (booking) => {
        const next =
          booking.status === 'confirmed'
            ? { label: 'Check in', icon: CheckCircle2 }
            : booking.status === 'checked_in'
              ? { label: 'Start', icon: Play }
              : booking.status === 'in_progress'
                ? { label: 'Complete', icon: Zap }
                : null
        return (
          <div className="flex items-center gap-1">
            {next && (
              <button
                onClick={(event) => { event.stopPropagation(); void advance(booking) }}
                disabled={working === booking.id}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-midnight-900 px-2.5 text-[10px] font-semibold text-lime hover:bg-midnight-800 disabled:opacity-50"
              >
                <next.icon className="h-3 w-3" /> {next.label}
              </button>
            )}
            <Link to={`/operator/bookings/${booking.id}`} onClick={(event) => event.stopPropagation()} className="inline-flex h-8 items-center rounded-lg border border-midnight-900/10 px-2.5 text-[10px] font-semibold text-charcoal-600 hover:bg-mint-50">View</Link>
          </div>
        )
      },
    },
  ]

  if (isLoading || bookingsLoading) return <PageLoader label="Loading bookings" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Bookings"
        description="Check drivers in at their reserved time, start sessions and complete them to release earnings."
        actions={
          <ExportButton
            filename="ev-naija-operator-bookings.csv"
            rows={filtered.map((booking) => ({
              reference: booking.booking_reference,
              driver: booking.customer?.full_name ?? '',
              station: booking.station?.name ?? '',
              charger: booking.charger?.name ?? '',
              start: booking.start_time,
              duration: booking.duration_minutes,
              energy: booking.energy_kwh,
              total: booking.total_amount,
              earning: booking.operator_earning,
              status: booking.status,
              payment: booking.payment_status,
            }))}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Today', value: bookings.filter((booking) => new Date(booking.start_time).toDateString() === new Date().toDateString()).length, hint: 'Scheduled sessions' },
          { label: 'In progress', value: counts.active, hint: 'Checked in or charging' },
          { label: 'Upcoming', value: counts.upcoming, hint: 'Confirmed reservations' },
          { label: 'Net earnings', value: formatNaira(bookings.filter((booking) => booking.payment_status === 'success').reduce((sum, booking) => sum + booking.operator_earning, 0)), hint: 'Across paid sessions' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{stat.label}</p>
            <p className="mt-2 font-mono text-xl font-medium text-midnight-900">{stat.value}</p>
            <p className="mt-0.5 text-[9.5px] text-muted">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'active', label: 'Active', count: counts.active },
            { value: 'upcoming', label: 'Upcoming', count: counts.upcoming },
            { value: 'completed', label: 'Completed', count: counts.completed },
            { value: 'cancelled', label: 'Cancelled', count: counts.cancelled },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search driver or reference" className="input-base h-9 pl-9 text-[11px]" />
          </div>
          <SelectFilter value={stationFilter} onChange={setStationFilter} options={[{ value: 'all', label: 'All stations' }, ...stations.map((station) => ({ value: station.id, label: station.name }))]} />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        minWidth={760}
        empty={<TableEmpty title="No bookings in this view" description="Reservations from drivers will appear here as soon as your approved station goes live." />}
        mobileRender={(booking) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[12.5px] font-semibold text-midnight-900">{booking.customer?.full_name ?? 'Driver'}</p>
                <p className="font-mono text-[9.5px] text-muted">{booking.booking_reference}</p>
              </div>
              <BookingStatusBadge status={booking.status} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10.5px] text-muted">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {booking.station?.name}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(booking.start_time, 'dd MMM HH:mm')}</span>
              <span className="flex items-center gap-1"><CalendarCheck className="h-3 w-3" /> {booking.charger?.name}</span>
              <span className="font-mono font-medium text-midnight-900">{formatNaira(booking.operator_earning)}</span>
            </div>
            <Link to={`/operator/bookings/${booking.id}`} className="mt-2.5 inline-flex items-center gap-1 text-[10.5px] font-semibold text-lime-700">Open booking <ArrowUpRight className="h-3 w-3" /></Link>
          </div>
        )}
      />
    </div>
  )
}
