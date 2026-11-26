import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  ArrowUpRight,
  BatteryCharging,
  CalendarCheck,
  Car,
  Clock,
  CreditCard,
  Heart,
  LifeBuoy,
  MapPin,
  PlugZap,
  Search,
  Sparkles,
  Star,
  Wallet,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { format, isFuture, parseISO, subMonths } from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'
import { listCustomerBookings, listPayments, listVehicles } from '@/services/bookings'
import { listFavorites } from '@/services/account'
import { PageHeader, StatCard, SectionCard } from '@/components/ui/Data'
import { RevenueAreaChart } from '@/components/dashboard/Charts'
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/booking/StatusBadges'
import { TableEmpty, DetailRow } from '@/components/dashboard/Kit'
import { Button, buttonVariants } from '@/components/ui/Button'
import { EmptyState, PageLoader, Skeleton } from '@/components/ui/Feedback'
import { Avatar } from '@/components/ui/Brand'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatDateTime, formatNaira, friendlyDate, initials, timeUntil } from '@/lib/utils'
import type { Booking } from '@/types'

function upNext(bookings: Booking[]) {
  return [...bookings]
    .filter((booking) => ['confirmed', 'checked_in'].includes(booking.status) && isFuture(parseISO(booking.start_time)))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0]
}

function spendSeries(bookings: Booking[]) {
  return Array.from({ length: 6 }).map((_, index) => {
    const month = subMonths(new Date(), 5 - index)
    const key = format(month, 'yyyy-MM')
    const monthBookings = bookings.filter(
      (booking) => booking.payment_status === 'success' && format(parseISO(booking.created_at), 'yyyy-MM') === key,
    )
    return {
      label: format(month, 'MMM'),
      revenue: monthBookings.reduce((sum, booking) => sum + booking.total_amount, 0),
      bookings: monthBookings.length,
    }
  })
}

export default function CustomerOverviewPage() {
  const { user } = useAuth()
  const customerId = user?.id ?? ''
  usePageTitle('Driver overview')

  const bookingsQuery = useQuery({
    queryKey: ['customer-bookings', customerId],
    queryFn: () => listCustomerBookings(customerId),
    enabled: Boolean(customerId),
  })
  const vehiclesQuery = useQuery({
    queryKey: ['vehicles', customerId],
    queryFn: () => listVehicles(customerId),
    enabled: Boolean(customerId),
  })
  const favoritesQuery = useQuery({
    queryKey: ['favorites', customerId],
    queryFn: () => listFavorites(customerId),
    enabled: Boolean(customerId),
  })
  const paymentsQuery = useQuery({
    queryKey: ['payments', customerId],
    queryFn: () => listPayments(customerId),
    enabled: Boolean(customerId),
  })

  const bookings = bookingsQuery.data ?? []
  const vehicles = vehiclesQuery.data ?? []
  const favorites = favoritesQuery.data ?? []
  const payments = paymentsQuery.data ?? []
  const next = upNext(bookings)
  const completed = bookings.filter((booking) => booking.status === 'completed')
  const totalSpent = bookings.filter((booking) => booking.payment_status === 'success').reduce((sum, booking) => sum + booking.total_amount, 0)
  const savedAmount = 0
  const recent = bookings.slice(0, 5)
  const series = spendSeries(bookings)

  if (bookingsQuery.isLoading && !bookings.length) {
    return <PageLoader label="Loading your garage" />
  }

  if (bookingsQuery.error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="font-semibold text-red-800">We could not load your dashboard.</p>
        <p className="mt-1 text-sm text-red-600">{(bookingsQuery.error as Error).message}</p>
        <Button className="mt-4" variant="outline" onClick={() => void bookingsQuery.refetch()}>Try again</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Driver dashboard"
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${user?.profile.full_name.split(' ')[0] ?? 'driver'}.`}
        description="Your next charge, recent sessions and everything tied to your EV Naija account."
        actions={
          <>
            <Link to="/app/stations" className={buttonVariants({ variant: 'outline', size: 'md' })}>
              <Search className="h-4 w-4" /> Find charger
            </Link>
            <Link to="/app/stations" className={buttonVariants({ size: 'md' })}>
              <Zap className="h-4 w-4" /> Book a slot
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Upcoming bookings"
          value={bookings.filter((booking) => ['confirmed', 'checked_in'].includes(booking.status)).length}
          icon={<CalendarCheck className="h-4 w-4" />}
          hint={next ? `Next ${friendlyDate(next.start_time)}` : 'Reserve your next session'}
          tone="lime"
        />
        <StatCard
          label="Completed sessions"
          value={completed.length}
          icon={<BatteryCharging className="h-4 w-4" />}
          hint={completed.length ? `${completed.reduce((sum, booking) => sum + booking.energy_kwh, 0).toFixed(0)} kWh delivered` : 'No sessions yet'}
        />
        <StatCard
          label="Total spent"
          value={formatNaira(totalSpent)}
          icon={<Wallet className="h-4 w-4" />}
          hint={`${payments.filter((payment) => payment.status === 'success').length} successful payments`}
        />
        <StatCard
          label="Saved stations"
          value={favorites.length}
          icon={<Heart className="h-4 w-4" />}
          hint={`${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'} on file`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-6">
          <section className="relative overflow-hidden rounded-3xl bg-midnight-950 p-6 text-white sm:p-7">
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-lime/15 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 dotted-grid opacity-[0.05]" />
            {next ? (
              <div className="relative">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-lime/25 bg-lime/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-lime">
                    <Clock className="h-3 w-3" /> Up next in {timeUntil(next.start_time)}
                  </span>
                  <BookingStatusBadge status={next.status} />
                </div>
                <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.03em]">{next.station?.name ?? 'Charging station'}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-[12px] text-white/45">
                  <MapPin className="h-3.5 w-3.5" /> {next.station?.address ?? next.station?.city}
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {[
                    { label: 'Date', value: formatDate(next.start_time, 'EEE, dd MMM') },
                    { label: 'Start', value: formatDate(next.start_time, 'HH:mm') },
                    { label: 'Duration', value: `${next.duration_minutes} min` },
                    { label: 'Charger', value: next.charger?.name ?? 'Reserved' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-white/[0.05] px-3 py-2.5">
                      <p className="font-mono text-[10px] font-medium text-white/85">{item.value}</p>
                      <p className="mt-0.5 text-[8.5px] uppercase tracking-[0.12em] text-white/30">{item.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <Link to={`/app/bookings/${next.id}`} className={buttonVariants({ size: 'md' })}>
                    View booking &amp; QR <ArrowRight className="h-4 w-4" />
                  </Link>
                  {(next.payment_status === 'pending' || next.status === 'pending_payment') && (
                    <Link to={`/app/bookings/${next.id}`} className="inline-flex h-11 items-center rounded-xl border border-white/20 px-4 text-[12px] font-semibold text-white/80 hover:border-lime/40 hover:text-lime">
                      Complete payment
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-lime text-midnight-900"><PlugZap className="h-5 w-5" /></span>
                <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.03em]">No charger reserved yet.</h2>
                <p className="mt-2 max-w-md text-[12.5px] leading-relaxed text-white/45">
                  Find a verified station near you, pick a charger and hold your time slot. Your first booking takes
                  about a minute.
                </p>
                <Link to="/app/stations" className={buttonVariants({ className: 'mt-5', size: 'md' })}>
                  <MapPin className="h-4 w-4" /> Browse stations
                </Link>
              </div>
            )}
          </section>

          <SectionCard
            title="Recent bookings"
            description="Your latest reservations across the network."
            action={
              <Link to="/app/bookings" className="inline-flex items-center gap-1 text-[11px] font-semibold text-lime-700 hover:underline">
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            }
            padded={false}
          >
            {recent.length ? (
              <div className="divide-y divide-midnight-900/[0.06]">
                {recent.map((booking) => (
                  <Link
                    key={booking.id}
                    to={`/app/bookings/${booking.id}`}
                    className="flex flex-col gap-3 px-5 py-4 transition hover:bg-mint-50 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint text-midnight-800">
                        <PlugZap className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[13px] font-semibold text-midnight-900">{booking.station?.name ?? 'Station'}</p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {formatDateTime(booking.start_time)} · {booking.charger?.name ?? 'Charger'}
                        </p>
                        <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-charcoal-400">{booking.booking_reference}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 pl-[52px] sm:justify-end sm:pl-0">
                      <div className="text-left sm:text-right">
                        <p className="font-mono text-[13px] font-medium text-midnight-900">{formatNaira(booking.total_amount)}</p>
                        <div className="mt-1 flex justify-end"><BookingStatusBadge status={booking.status} /></div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <TableEmpty
                title="No bookings yet"
                description="Once you reserve a charger, your session history will appear here."
                action={<Link to="/app/stations" className={buttonVariants({ size: 'sm' })}>Find a station</Link>}
              />
            )}
          </SectionCard>

          <SectionCard title="Charging spend" description="Last six months, from verified payments only.">
            <RevenueAreaChart data={series} height={240} />
            {totalSpent === 0 && (
              <p className="mt-2 text-center text-[11px] text-muted">Your spend chart will populate after your first paid session.</p>
            )}
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="Your garage" description="Vehicles saved for faster booking." action={<Link to="/app/vehicles" className="text-[11px] font-semibold text-lime-700 hover:underline">Manage</Link>}>
            {vehicles.length ? (
              <div className="space-y-2.5">
                {vehicles.slice(0, 3).map((vehicle) => (
                  <div key={vehicle.id} className="flex items-center gap-3 rounded-2xl bg-mint-50 p-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-midnight-800"><Car className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-midnight-900">{vehicle.manufacturer} {vehicle.model}</p>
                      <p className="text-[10px] text-muted">{vehicle.year} · {vehicle.battery_capacity_kwh} kWh · {vehicle.connector_type.toUpperCase()}</p>
                    </div>
                    {vehicle.is_primary && <span className="rounded-full bg-lime px-2 py-0.5 text-[8.5px] font-bold uppercase text-midnight-900">Primary</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center">
                <p className="text-[12px] text-muted">No vehicles saved yet.</p>
                <Link to="/app/vehicles" className={buttonVariants({ variant: 'outline', size: 'sm', className: 'mt-3' })}>Add a vehicle</Link>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Quick actions">
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { to: '/app/stations', label: 'Find charger', icon: Search },
                { to: '/app/bookings', label: 'My bookings', icon: CalendarCheck },
                { to: '/app/payments', label: 'Payments', icon: CreditCard },
                { to: '/app/support', label: 'Support', icon: LifeBuoy },
              ].map((action) => (
                <Link key={action.to} to={action.to} className="flex flex-col gap-2 rounded-2xl border border-midnight-900/[0.07] bg-mint-50/60 p-3.5 transition hover:border-lime-400/60 hover:bg-white">
                  <action.icon className="h-4 w-4 text-midnight-700" />
                  <span className="text-[11.5px] font-semibold text-midnight-900">{action.label}</span>
                </Link>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Latest payment" description="Receipts live in your payment history." action={<Link to="/app/payments" className="text-[11px] font-semibold text-lime-700 hover:underline">All</Link>}>
            {payments.length ? (
              <div>
                <div className="flex items-center gap-3 rounded-2xl bg-mint-50 p-3.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-midnight-800"><CreditCard className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[12.5px] font-medium text-midnight-900">{formatNaira(payments[0].amount)}</p>
                    <p className="truncate text-[10px] text-muted">{payments[0].reference}</p>
                  </div>
                  <PaymentStatusBadge status={payments[0].status} />
                </div>
                <p className="mt-2 text-center text-[10px] text-muted">Paid via {payments[0].channel ?? 'pending'} · {formatDate(payments[0].paid_at ?? payments[0].created_at)}</p>
              </div>
            ) : (
              <p className="text-center text-[12px] text-muted">No payments yet.</p>
            )}
          </SectionCard>

          <div className="rounded-3xl border border-lime-400/40 bg-lime/15 p-5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-midnight-900 text-lime"><Sparkles className="h-4 w-4" /></span>
            <p className="mt-3 text-[12px] font-semibold text-midnight-900">Help the network get better</p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-charcoal-500">
              Review your last completed session. Verified reviews help other drivers pick the right charger.
            </p>
            <Link to="/app/reviews" className="mt-2.5 inline-flex items-center gap-1 text-[10.5px] font-semibold text-midnight-900 hover:underline">
              Write a review <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
