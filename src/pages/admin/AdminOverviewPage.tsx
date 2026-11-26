import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CalendarCheck,
  CreditCard,
  MapPin,
  PlugZap,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import { getAdminStats, listAllStations, listOperators, listPayouts } from '@/services/admin'
import { PageHeader, SectionCard, StatCard } from '@/components/ui/Data'
import { RevenueAreaChart, BookingsBarChart } from '@/components/dashboard/Charts'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Brand'
import { PageLoader } from '@/components/ui/Feedback'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatNaira } from '@/lib/utils'

export default function AdminOverviewPage() {
  usePageTitle('Admin dashboard')
  const statsQuery = useQuery({ queryKey: ['admin-stats'], queryFn: getAdminStats })
  const operatorsQuery = useQuery({ queryKey: ['admin-operators'], queryFn: listOperators })
  const stationsQuery = useQuery({ queryKey: ['admin-stations'], queryFn: listAllStations })
  const payoutsQuery = useQuery({ queryKey: ['admin-payouts'], queryFn: listPayouts })

  const stats = statsQuery.data
  const operators = operatorsQuery.data ?? []
  const stations = stationsQuery.data ?? []
  const payouts = payoutsQuery.data ?? []

  const pendingOperators = operators.filter((operator) => operator.status === 'pending')
  const pendingStations = stations.filter((station) => station.status === 'pending')
  const pendingPayouts = payouts.filter((payout) => payout.status === 'pending')
  const pendingPayoutValue = pendingPayouts.reduce((sum, payout) => sum + payout.amount, 0)

  if (statsQuery.isLoading || !stats) return <PageLoader label="Loading dashboard" />

  const series = stats.revenueSeries.length ? stats.revenueSeries : [{ label: '—', revenue: 0, bookings: 0 }]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform control"
        title="Admin dashboard"
        description="Marketplace health, verification queues and financial exposure across EV Naija."
        actions={
          <>
            <Link to="/admin/verification" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-midnight-900/10 px-4 text-[11px] font-semibold text-charcoal-600 hover:bg-mint-50">
              <ShieldCheck className="h-4 w-4" /> Review queue
              {pendingOperators.length + pendingStations.length > 0 && <span className="rounded-full bg-red-500 px-1.5 py-0.5 font-mono text-[9px] text-white">{pendingOperators.length + pendingStations.length}</span>}
            </Link>
            <Link to="/admin/settings" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-midnight-900 px-4 text-[11px] font-semibold text-lime hover:bg-midnight-800">
              <Zap className="h-4 w-4" /> Platform settings
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gross revenue" value={formatNaira(stats.totalRevenue, { compact: true })} icon={<TrendingUp className="h-4 w-4" />} hint="All successful payments" tone="dark" />
        <StatCard label="Platform commission" value={formatNaira(stats.totalCommission, { compact: true })} icon={<BadgeCheck className="h-4 w-4" />} hint="Earned to date" tone="lime" />
        <StatCard label="Completed sessions" value={stats.completedBookings} icon={<CalendarCheck className="h-4 w-4" />} hint={`${stats.activeBookings} active right now`} />
        <StatCard label="Charging points" value={stats.totalChargingPoints} icon={<PlugZap className="h-4 w-4" />} hint={`${stats.totalStations} stations listed`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Customers', value: stats.totalCustomers, icon: Users, to: '/admin/customers', hint: 'Registered drivers' },
          { label: 'Operators', value: stats.totalOperators, icon: Building2, to: '/admin/operators', hint: `${pendingOperators.length} awaiting approval` },
          { label: 'Stations', value: stats.totalStations, icon: MapPin, to: '/admin/stations', hint: `${pendingStations.length} awaiting verification` },
          { label: 'Pending payouts', value: formatNaira(pendingPayoutValue, { compact: true }), icon: Wallet, to: '/admin/payouts', hint: `${pendingPayouts.length} requests` },
        ].map((item) => (
          <Link key={item.label} to={item.to} className="group rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card transition hover:border-lime-400/60">
            <div className="flex items-center justify-between">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{item.label}</p>
              <item.icon className="h-4 w-4 text-midnight-700" />
            </div>
            <p className="mt-2 font-mono text-xl font-medium text-midnight-900">{item.value}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[9.5px] text-muted">{item.hint} <ArrowUpRight className="h-2.5 w-2.5 opacity-0 transition group-hover:opacity-100" /></p>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <SectionCard title="Revenue & bookings" description="Successful payments across the marketplace.">
          <RevenueAreaChart data={series} height={280} />
          <div className="mt-4 border-t border-midnight-900/[0.06] pt-4">
            <BookingsBarChart data={series.map((item) => ({ label: item.label, value: item.bookings }))} height={150} />
          </div>
        </SectionCard>

        <SectionCard title="Action queues" description="Items that need an admin decision.">
          <div className="space-y-2.5">
            {[
              {
                label: 'Operator applications',
                count: pendingOperators.length,
                to: '/admin/operators?status=pending',
                icon: Building2,
                tone: 'bg-amber-50 text-amber-700',
              },
              {
                label: 'Station verification',
                count: pendingStations.length,
                to: '/admin/verification',
                icon: MapPin,
                tone: 'bg-lime/20 text-midnight-800',
              },
              {
                label: 'Payout approvals',
                count: pendingPayouts.length,
                to: '/admin/payouts?status=pending',
                icon: CreditCard,
                tone: 'bg-mint text-midnight-800',
              },
            ].map((queue) => (
              <Link key={queue.label} to={queue.to} className="flex items-center justify-between rounded-2xl border border-midnight-900/[0.07] p-3.5 transition hover:bg-mint-50">
                <div className="flex items-center gap-2.5">
                  <span className={`grid h-8 w-8 place-items-center rounded-lg ${queue.tone}`}><queue.icon className="h-3.5 w-3.5" /></span>
                  <p className="text-[11.5px] font-semibold text-midnight-900">{queue.label}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${queue.count ? 'bg-midnight-900 text-lime' : 'bg-charcoal-100 text-charcoal-500'}`}>{queue.count}</span>
                  <ArrowUpRight className="h-3 w-3 text-muted" />
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-4 rounded-2xl bg-midnight-950 p-4 text-white">
            <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/40">Financial exposure</p>
            <p className="mt-1.5 font-mono text-xl font-medium text-lime">{formatNaira(pendingPayoutValue)}</p>
            <p className="mt-1 text-[9.5px] leading-relaxed text-white/45">
              Pending operator withdrawals. Review ledger availability before approval. Transfers are irreversible after release.
            </p>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          title="Operators awaiting review"
          description="Oldest applications first."
          action={<Link to="/admin/operators" className="text-[10.5px] font-semibold text-lime-700 hover:underline">View all</Link>}
        >
          {pendingOperators.length ? (
            <div className="divide-y divide-midnight-900/[0.06]">
              {pendingOperators.slice(0, 5).map((operator) => (
                <div key={operator.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={operator.business_name} src={operator.logo_url} size={34} />
                    <div>
                      <p className="text-[12px] font-semibold text-midnight-900">{operator.business_name}</p>
                      <p className="text-[9.5px] text-muted">{operator.owner_name} · {formatDate(operator.created_at)}</p>
                    </div>
                  </div>
                  <Link to={`/admin/operators?focus=${operator.id}`} className="inline-flex h-8 items-center rounded-lg bg-midnight-900 px-2.5 text-[10px] font-semibold text-lime">Review</Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-mint-50 px-4 py-6 text-center">
              <BadgeCheck className="mx-auto h-6 w-6 text-emerald-600" />
              <p className="mt-2 text-[12px] font-semibold text-midnight-900">No operator applications waiting</p>
              <p className="mt-0.5 text-[10px] text-muted">The queue is clear.</p>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Stations awaiting verification"
          description="Locations that cannot accept bookings yet."
          action={<Link to="/admin/verification" className="text-[10.5px] font-semibold text-lime-700 hover:underline">Open queue</Link>}
        >
          {pendingStations.length ? (
            <div className="divide-y divide-midnight-900/[0.06]">
              {pendingStations.slice(0, 5).map((station) => (
                <div key={station.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-[12px] font-semibold text-midnight-900">{station.name}</p>
                    <p className="text-[9.5px] text-muted">{station.address}, {station.city} · {station.chargers?.length ?? 0} chargers</p>
                  </div>
                  <Badge tone="warning">pending</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-mint-50 px-4 py-6 text-center">
              <MapPin className="mx-auto h-6 w-6 text-emerald-600" />
              <p className="mt-2 text-[12px] font-semibold text-midnight-900">Every station is reviewed</p>
              <p className="mt-0.5 text-[10px] text-muted">Nothing pending verification.</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
