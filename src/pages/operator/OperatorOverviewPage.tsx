import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  PlugZap,
  Plus,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import { useOperatorData } from '@/hooks/useOperatorData'
import { listOperatorBookings, listOperatorDocuments, listPayoutRequests, revenueSeries, updateBookingStatusOperator } from '@/services/operator'
import { PageHeader, StatCard, SectionCard, DataTable, type Column } from '@/components/ui/Data'
import { RevenueAreaChart, DonutChart } from '@/components/dashboard/Charts'
import { BookingStatusBadge, PayoutStatusBadge } from '@/components/booking/StatusBadges'
import { TableEmpty, DetailRow, InfoNote } from '@/components/dashboard/Kit'
import { Button, buttonVariants } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Feedback'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatDateTime, formatNaira, humanize, timeUntil } from '@/lib/utils'
import type { Booking } from '@/types'

export default function OperatorOverviewPage() {
  const { operatorId, profile, stations, stationIds, stats, isLoading, stationsQuery } = useOperatorData()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [range, setRange] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly')
  usePageTitle('Operator overview')

  const bookingsQuery = useQuery({
    queryKey: ['operator-bookings', operatorId, stationIds],
    queryFn: () => listOperatorBookings(stationIds),
    enabled: Boolean(operatorId) && stationIds.length > 0,
  })
  const payoutsQuery = useQuery({
    queryKey: ['operator-payouts', operatorId],
    queryFn: () => listPayoutRequests(operatorId),
    enabled: Boolean(operatorId),
  })
  const docsQuery = useQuery({
    queryKey: ['operator-documents', operatorId],
    queryFn: () => listOperatorDocuments(operatorId),
    enabled: Boolean(operatorId),
  })

  const bookings = bookingsQuery.data ?? []
  const payouts = payoutsQuery.data ?? []
  const documents = docsQuery.data ?? []
  const series = useMemo(() => revenueSeries(bookings, range), [bookings, range])
  const recent = bookings.slice(0, 6)
  const today = new Date().toDateString()
  const todayBookings = bookings.filter((booking) => new Date(booking.start_time).toDateString() === today)
  const pendingDocs = documents.filter((document) => document.status === 'pending').length

  const checkIn = async (booking: Booking) => {
    try {
      await updateBookingStatusOperator(booking.id, 'checked_in', 'Checked in from operator overview')
      await queryClient.invalidateQueries({ queryKey: ['operator-bookings'] })
      toast.success('Driver checked in', `${booking.booking_reference} is now checked in.`)
    } catch (error) {
      toast.error('Could not check in booking', (error as Error).message)
    }
  }

  if (isLoading) return <PageLoader label="Loading operator workspace" />
  if (!profile) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
        <Building2 className="mx-auto h-8 w-8 text-amber-600" />
        <h1 className="mt-3 font-display text-xl font-semibold text-amber-900">Operator profile not found</h1>
        <p className="mt-1 text-sm text-amber-700">This account does not have an operator profile attached yet.</p>
      </div>
    )
  }

  const statusTone = profile.status === 'approved' ? 'success' : profile.status === 'pending' ? 'warning' : 'danger'

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
          <p className="text-[10px] text-muted">{booking.vehicle ? `${booking.vehicle.manufacturer} ${booking.vehicle.model}` : 'No vehicle'}</p>
        </div>
      ),
    },
    {
      key: 'slot',
      header: 'Slot',
      render: (booking) => (
        <div>
          <p className="text-[11.5px] text-charcoal-700">{formatDate(booking.start_time, 'dd MMM')} · {formatDate(booking.start_time, 'HH:mm')}</p>
          <p className="text-[10px] text-muted">{booking.charger?.name ?? 'Charger'}</p>
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
      render: (booking) => <BookingStatusBadge status={booking.status} />,
    },
    {
      key: 'action',
      header: '',
      render: (booking) =>
        booking.status === 'confirmed' ? (
          <button onClick={() => void checkIn(booking)} className="inline-flex h-8 items-center rounded-lg bg-midnight-900 px-2.5 text-[10px] font-semibold text-lime hover:bg-midnight-800">
            Check in
          </button>
        ) : (
          <Link to={`/operator/bookings/${booking.id}`} className="inline-flex h-8 items-center rounded-lg border border-midnight-900/10 px-2.5 text-[10px] font-semibold text-charcoal-600 hover:bg-mint-50">
            View
          </Link>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operator workspace"
        title={`${profile.business_name}`}
        description="Live operations, revenue and settlement health across your charging network."
        actions={
          <>
            <Link to="/operator/stations/new" className={buttonVariants({ variant: 'outline', size: 'md' })}>
              <Plus className="h-4 w-4" /> New station
            </Link>
            <Link to="/operator/bookings" className={buttonVariants({ size: 'md' })}>
              <CalendarCheck className="h-4 w-4" /> Manage bookings
            </Link>
          </>
        }
      />

      {profile.status !== 'approved' && (
        <InfoNote title={`Your operator account is ${profile.status}`} tone={profile.status === 'pending' ? 'warning' : 'warning'}>
          {profile.status === 'pending'
            ? 'Your business verification is under review. You can prepare stations now; they will only go live after approval.'
            : `Your account status is ${profile.status}. Contact support to resolve this before accepting bookings.`}
        </InfoNote>
      )}
      {pendingDocs > 0 && (
        <InfoNote title={`${pendingDocs} document${pendingDocs === 1 ? '' : 's'} awaiting verification`}>
          Verification typically takes up to 2 business days. Keep your station details accurate in the meantime.
        </InfoNote>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gross revenue" value={formatNaira(stats?.grossRevenue ?? 0, { compact: true })} icon={<TrendingUp className="h-4 w-4" />} tone="lime" hint="Paid bookings, all time" />
        <StatCard label="Net earnings" value={formatNaira(stats?.netEarnings ?? 0, { compact: true })} icon={<Wallet className="h-4 w-4" />} hint={`${formatNaira(stats?.commission ?? 0, { compact: true })} platform commission`} />
        <StatCard label="Today's bookings" value={todayBookings.length} icon={<CalendarCheck className="h-4 w-4" />} hint={`${stats?.activeBookings ?? 0} active across the network`} />
        <StatCard label="Available chargers" value={`${stats?.availableChargers ?? 0}/${stats?.totalChargingPoints ?? 0}`} icon={<PlugZap className="h-4 w-4" />} hint={`${stats?.totalStations ?? stations.length} station${(stats?.totalStations ?? stations.length) === 1 ? '' : 's'}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-6">
          <SectionCard
            title="Revenue trend"
            description="Your net operator earnings, after platform commission."
            action={
              <div className="flex rounded-lg bg-charcoal-50 p-1">
                {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setRange(option)}
                    className={`rounded-md px-2.5 py-1 text-[10px] font-semibold capitalize transition ${range === option ? 'bg-white text-midnight-900 shadow-sm' : 'text-muted'}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            }
          >
            {series.length ? <RevenueAreaChart data={series} height={260} /> : <div className="grid h-[260px] place-items-center rounded-2xl bg-mint-50 text-center text-[12px] text-muted">No paid bookings in this period yet.</div>}
          </SectionCard>

          <SectionCard
            title="Recent bookings"
            description="Latest driver reservations across your stations."
            action={<Link to="/operator/bookings" className="inline-flex items-center gap-1 text-[11px] font-semibold text-lime-700 hover:underline">All bookings <ArrowUpRight className="h-3 w-3" /></Link>}
            padded={false}
          >
            <div className="p-4 sm:p-5">
              <DataTable
                columns={columns}
                rows={recent}
                empty={<TableEmpty title="No bookings yet" description="Once your station is live and approved, driver reservations will appear here." />}
                minWidth={640}
              />
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="Business profile" action={<Link to="/operator/profile" className="text-[11px] font-semibold text-lime-700 hover:underline">Edit</Link>}>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-midnight-900 text-lg font-bold text-lime">{profile.business_name.slice(0, 1)}</span>
              <div>
                <p className="text-[13px] font-semibold text-midnight-900">{profile.business_name}</p>
                <p className="text-[10.5px] text-muted">{profile.owner_name}</p>
              </div>
            </div>
            <div className="mt-4 divide-y divide-midnight-900/[0.06]">
              <DetailRow label="Status" value={<Badge tone={statusTone}>{profile.status}</Badge>} />
              <DetailRow label="Stations" value={stations.length} mono />
              <DetailRow label="Charging points" value={stats?.totalChargingPoints ?? 0} mono />
              <DetailRow label="Member since" value={formatDate(profile.created_at, 'MMM yyyy')} />
            </div>
          </SectionCard>

          <SectionCard title="Settlement" description="Available and pending payouts." action={<Link to="/operator/payouts" className="text-[11px] font-semibold text-lime-700 hover:underline">Payouts</Link>}>
            <div className="rounded-2xl bg-midnight-950 p-4 text-white">
              <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/40">Pending payouts</p>
              <p className="mt-1 font-mono text-2xl font-medium text-lime">{formatNaira(stats?.pendingPayouts ?? 0)}</p>
              <p className="mt-1 text-[10px] text-white/40">{payouts.filter((payout) => ['pending', 'approved', 'processing'].includes(payout.status)).length} request(s) in progress</p>
            </div>
            <div className="mt-3 space-y-2">
              {payouts.slice(0, 3).map((payout) => (
                <div key={payout.id} className="flex items-center justify-between rounded-xl border border-midnight-900/[0.06] px-3 py-2">
                  <div>
                    <p className="font-mono text-[11px] font-medium text-midnight-900">{formatNaira(payout.amount)}</p>
                    <p className="text-[9px] text-muted">{formatDate(payout.requested_at)}</p>
                  </div>
                  <PayoutStatusBadge status={payout.status} />
                </div>
              ))}
              {!payouts.length && <p className="text-center text-[11px] text-muted">No payout requests yet.</p>}
            </div>
            <Link to="/operator/payouts" className={buttonVariants({ className: 'mt-3 w-full', size: 'sm' })}><Wallet className="h-3.5 w-3.5" /> Request payout</Link>
          </SectionCard>

          <SectionCard title="Charger status" description="Fleet health right now.">
            {stations.length ? (
              <DonutChart
                data={[
                  { label: 'Available', value: stations.reduce((sum, station) => sum + station.chargers.filter((charger) => charger.status === 'available').length, 0) },
                  { label: 'Charging', value: stations.reduce((sum, station) => sum + station.chargers.filter((charger) => charger.status === 'charging').length, 0) },
                  { label: 'Reserved', value: stations.reduce((sum, station) => sum + station.chargers.filter((charger) => charger.status === 'reserved').length, 0) },
                  { label: 'Maintenance', value: stations.reduce((sum, station) => sum + station.chargers.filter((charger) => ['maintenance', 'offline'].includes(charger.status)).length, 0) },
                ]}
                height={190}
                centerLabel="Chargers"
                centerValue={String(stats?.totalChargingPoints ?? 0)}
              />
            ) : (
              <p className="text-center text-[12px] text-muted">Add your first station to see live charger health.</p>
            )}
          </SectionCard>

          <div className="rounded-3xl border border-lime-400/40 bg-lime/20 p-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-midnight-700">Live now</p>
            <p className="mt-2 font-display text-lg font-semibold text-midnight-900">{stats?.activeBookings ?? 0} active bookings</p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-charcoal-500">
              Check in drivers at their reserved time, then start and complete the session to keep your ledger accurate.
            </p>
            <Link to="/operator/bookings" className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-semibold text-midnight-900 hover:underline">
              Open operations <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
