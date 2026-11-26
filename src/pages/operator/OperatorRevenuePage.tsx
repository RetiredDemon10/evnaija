import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Building2, Download, PlugZap, TrendingUp, Wallet, Zap } from 'lucide-react'
import { useOperatorData } from '@/hooks/useOperatorData'
import { listOperatorBookings } from '@/services/operator'
import { PageHeader, SectionCard } from '@/components/ui/Data'
import { RevenueAreaChart, BookingsBarChart } from '@/components/dashboard/Charts'
import { ExportButton, TableEmpty } from '@/components/dashboard/Kit'
import { PageLoader } from '@/components/ui/Feedback'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatNaira } from '@/lib/utils'

export default function OperatorRevenuePage() {
  const { stationIds, operatorId, stations, stats, isLoading } = useOperatorData()
  const [range, setRange] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly')
  usePageTitle('Revenue')

  const { data: bookings = [], isLoading: loadingBookings } = useQuery({
    queryKey: ['operator-bookings', operatorId, stationIds],
    queryFn: () => listOperatorBookings(stationIds),
    enabled: Boolean(operatorId) && stationIds.length > 0,
  })

  const paid = bookings.filter((booking) => booking.payment_status === 'success')
  const series = useMemo(() => {
    const now = new Date()
    const buckets: { label: string; revenue: number; bookings: number }[] = []
    if (range === 'daily') {
      for (let index = 13; index >= 0; index -= 1) {
        const date = new Date(now)
        date.setDate(date.getDate() - index)
        const key = date.toDateString()
        const rows = paid.filter((booking) => new Date(booking.created_at).toDateString() === key)
        buckets.push({ label: date.toLocaleDateString('en-NG', { day: '2-digit' }), revenue: rows.reduce((sum, booking) => sum + booking.operator_earning, 0), bookings: rows.length })
      }
    } else if (range === 'weekly') {
      for (let index = 11; index >= 0; index -= 1) {
        const end = new Date(now)
        end.setDate(end.getDate() - index * 7)
        const start = new Date(end)
        start.setDate(start.getDate() - 6)
        const rows = paid.filter((booking) => {
          const date = new Date(booking.created_at)
          return date >= new Date(start.setHours(0, 0, 0, 0)) && date <= new Date(end.setHours(23, 59, 59, 999))
        })
        buckets.push({ label: `${start.getDate()}/${start.getMonth() + 1}`, revenue: rows.reduce((sum, booking) => sum + booking.operator_earning, 0), bookings: rows.length })
      }
    } else if (range === 'yearly') {
      for (let index = 4; index >= 0; index -= 1) {
        const year = now.getFullYear() - index
        const rows = paid.filter((booking) => new Date(booking.created_at).getFullYear() === year)
        buckets.push({ label: String(year), revenue: rows.reduce((sum, booking) => sum + booking.operator_earning, 0), bookings: rows.length })
      }
    } else {
      for (let index = 11; index >= 0; index -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
        const rows = paid.filter((booking) => {
          const value = new Date(booking.created_at)
          return value.getMonth() === date.getMonth() && value.getFullYear() === date.getFullYear()
        })
        buckets.push({ label: date.toLocaleDateString('en-NG', { month: 'short' }), revenue: rows.reduce((sum, booking) => sum + booking.operator_earning, 0), bookings: rows.length })
      }
    }
    return buckets
  }, [paid, range])

  const byStation = useMemo(
    () =>
      stations
        .map((station) => {
          const stationBookings = paid.filter((booking) => booking.station_id === station.id)
          return {
            station,
            bookings: stationBookings.length,
            revenue: stationBookings.reduce((sum, booking) => sum + booking.operator_earning, 0),
            energy: stationBookings.reduce((sum, booking) => sum + booking.energy_kwh, 0),
          }
        })
        .sort((a, b) => b.revenue - a.revenue),
    [stations, paid],
  )

  const byCharger = useMemo(() => {
    const map = new Map<string, { name: string; station: string; sessions: number; revenue: number; energy: number }>()
    for (const booking of paid) {
      const key = booking.charger_id
      const current = map.get(key) ?? {
        name: booking.charger?.name ?? 'Charger',
        station: stations.find((station) => station.id === booking.station_id)?.name ?? booking.station?.name ?? 'Station',
        sessions: 0,
        revenue: 0,
        energy: 0,
      }
      current.sessions += 1
      current.revenue += booking.operator_earning
      current.energy += booking.energy_kwh
      map.set(key, current)
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8)
  }, [paid, stations])

  const totalRevenue = paid.reduce((sum, booking) => sum + booking.operator_earning, 0)
  const totalEnergy = paid.reduce((sum, booking) => sum + booking.energy_kwh, 0)
  const averageTicket = paid.length ? totalRevenue / paid.length : 0

  if (isLoading || loadingBookings) return <PageLoader label="Loading revenue" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Business"
        title="Revenue"
        description="Net operator earnings after platform commission. Figures update as bookings are paid and completed."
        actions={<ExportButton filename="ev-naija-operator-revenue.csv" rows={byStation.map((row) => ({ station: row.station.name, bookings: row.bookings, energyKwh: row.energy, netRevenue: row.revenue }))} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Gross revenue', value: formatNaira(stats?.grossRevenue ?? 0, { compact: true }), hint: 'What drivers paid', icon: TrendingUp },
          { label: 'Net earnings', value: formatNaira(totalRevenue, { compact: true }), hint: 'After 15% commission', icon: Wallet },
          { label: 'Energy delivered', value: `${totalEnergy.toFixed(0)} kWh`, hint: `${paid.length} paid sessions`, icon: Zap },
          { label: 'Average net / session', value: formatNaira(Math.round(averageTicket)), hint: 'Across paid sessions', icon: BarChart3 },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
            <div className="flex items-center justify-between"><p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{stat.label}</p><stat.icon className="h-4 w-4 text-midnight-700" /></div>
            <p className="mt-2 font-mono text-xl font-medium text-midnight-900">{stat.value}</p>
            <p className="mt-0.5 text-[9.5px] text-muted">{stat.hint}</p>
          </div>
        ))}
      </div>

      <SectionCard
        title="Earnings trend"
        description="Your net share of paid bookings."
        action={
          <div className="flex rounded-lg bg-charcoal-50 p-1">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((option) => (
              <button key={option} onClick={() => setRange(option)} className={`rounded-md px-2.5 py-1 text-[10px] font-semibold capitalize transition ${range === option ? 'bg-white text-midnight-900 shadow-sm' : 'text-muted'}`}>{option}</button>
            ))}
          </div>
        }
      >
        <RevenueAreaChart data={series} height={280} />
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Revenue by station" description="Where your earnings come from.">
          {byStation.length ? (
            <div className="space-y-4">
              {byStation.map((row) => {
                const share = totalRevenue ? Math.round((row.revenue / totalRevenue) * 100) : 0
                return (
                  <div key={row.station.id}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-midnight-900">{row.station.name}</p>
                        <p className="text-[9.5px] text-muted">{row.bookings} sessions · {row.energy.toFixed(0)} kWh</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-[12px] font-medium text-midnight-900">{formatNaira(row.revenue)}</p>
                        <p className="text-[9px] text-muted">{share}% of net</p>
                      </div>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-charcoal-100"><div className="h-full rounded-full bg-lime-500" style={{ width: `${share}%` }} /></div>
                  </div>
                )
              })}
            </div>
          ) : (
            <TableEmpty title="No revenue by station yet" description="Paid sessions will be broken down by location here." />
          )}
        </SectionCard>

        <SectionCard title="Session volume" description="Paid bookings per period.">
          <BookingsBarChart data={series.map((item) => ({ label: item.label, value: item.bookings }))} height={250} />
        </SectionCard>
      </div>

      <SectionCard title="Top performing chargers" description="Ranked by net earnings.">
        {byCharger.length ? (
          <div className="divide-y divide-midnight-900/[0.06]">
            {byCharger.map((charger, index) => (
              <div key={charger.name + index} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-mint font-mono text-[10px] font-semibold text-midnight-800">{index + 1}</span>
                  <div>
                    <p className="text-[12px] font-semibold text-midnight-900">{charger.name}</p>
                    <p className="text-[9.5px] text-muted">{charger.station} · {charger.sessions} sessions · {charger.energy.toFixed(0)} kWh</p>
                  </div>
                </div>
                <span className="font-mono text-[12px] font-medium text-midnight-900">{formatNaira(charger.revenue)}</span>
              </div>
            ))}
          </div>
        ) : (
          <TableEmpty title="No charger performance yet" description="Once bookings are completed, charger-level performance will appear here." />
        )}
      </SectionCard>

      <div className="flex items-start gap-2 rounded-2xl border border-midnight-900/[0.07] bg-white px-4 py-3.5">
        <Download className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" />
        <p className="text-[10.5px] leading-relaxed text-charcoal-500">
          Revenue reflects server-side ledger entries, not this screen's arithmetic. Use the Transactions page for the
          auditable ledger and Payouts for settlement status.
        </p>
      </div>
    </div>
  )
}
