import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeftRight,
  Bell,
  BellRing,
  Building2,
  CalendarCheck,
  Car,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  CreditCard,
  FileBarChart,
  FileClock,
  Heart,
  HelpCircle,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Menu,
  MessageSquare,
  PlusCircle,
  PlugZap,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  User,
  Users,
  Wallet,
  Wrench,
  X,
  Zap,
  Globe2,
  BadgePercent,
  Megaphone,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Logo, Avatar } from '@/components/ui/Brand'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/contexts/AuthContext'
import { cn, relativeTime } from '@/lib/utils'
import { EASE } from '@/lib/motion'
import { ScrollProgress } from '@/components/common/ScrollProgress'
import { listNotifications, markAllNotificationsRead, markNotificationRead, subscribeToNotifications } from '@/services/account'
import type { AppRole } from '@/types'
import { PreviewPill } from './PreviewPill'
import { BookingReminders } from '@/components/pwa/BookingReminders'

interface NavItem {
  label: string
  to: string
  icon: typeof LayoutDashboard
  end?: boolean
}
interface NavGroup {
  title: string
  items: NavItem[]
}

const NAV: Record<AppRole, NavGroup[]> = {
  customer: [
    {
      title: 'Drive',
      items: [
        { label: 'Overview', to: '/app', icon: LayoutDashboard, end: true },
        { label: 'Find Stations', to: '/app/stations', icon: MapPin },
        { label: 'My Bookings', to: '/app/bookings', icon: CalendarCheck },
        { label: 'My Vehicles', to: '/app/vehicles', icon: Car },
        { label: 'Saved Stations', to: '/app/saved', icon: Heart },
        { label: 'Rewards', to: '/app/rewards', icon: Sparkles },
        { label: 'Price Alerts', to: '/app/alerts', icon: BellRing },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Payment History', to: '/app/payments', icon: Receipt },
        { label: 'Reviews & Ratings', to: '/app/reviews', icon: Star },
        { label: 'Notifications', to: '/app/notifications', icon: Bell },
        { label: 'My Profile', to: '/app/profile', icon: User },
        { label: 'Support', to: '/app/support', icon: LifeBuoy },
      ],
    },
  ],
  operator: [
    {
      title: 'Operations',
      items: [
        { label: 'Overview', to: '/operator', icon: LayoutDashboard, end: true },
        { label: 'My Stations', to: '/operator/stations', icon: Building2 },
        { label: 'Add New Station', to: '/operator/stations/new', icon: PlusCircle },
        { label: 'Charging Equipment', to: '/operator/chargers', icon: PlugZap },
        { label: 'Manage Availability', to: '/operator/availability', icon: Clock },
        { label: 'Bookings', to: '/operator/bookings', icon: CalendarCheck },
        { label: 'Customers', to: '/operator/customers', icon: Users },
      ],
    },
    {
      title: 'Business',
      items: [
        { label: 'Revenue', to: '/operator/revenue', icon: TrendingUp },
        { label: 'Transactions', to: '/operator/transactions', icon: ArrowLeftRight },
        { label: 'Payouts', to: '/operator/payouts', icon: Wallet },
        { label: 'Reviews', to: '/operator/reviews', icon: Star },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Notifications', to: '/operator/notifications', icon: Bell },
        { label: 'Business Profile', to: '/operator/profile', icon: Store },
        { label: 'Support', to: '/operator/support', icon: LifeBuoy },
      ],
    },
  ],
  mechanic: [
    {
      title: 'Workshop',
      items: [
        { label: 'Overview', to: '/mechanic', icon: LayoutDashboard, end: true },
        { label: 'My Listing', to: '/mechanic/listing', icon: Wrench },
        { label: 'Service Requests', to: '/mechanic/requests', icon: ClipboardCheck },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Notifications', to: '/mechanic/notifications', icon: Bell },
        { label: 'Support', to: '/mechanic/support', icon: LifeBuoy },
      ],
    },
  ],
  admin: [
    {
      title: 'Overview',
      items: [{ label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true }],
    },
    {
      title: 'Marketplace',
      items: [
        { label: 'Customers', to: '/admin/customers', icon: Users },
        { label: 'Station Operators', to: '/admin/operators', icon: Building2 },
        { label: 'Station Verification', to: '/admin/verification', icon: ClipboardCheck },
        { label: 'Charging Stations', to: '/admin/stations', icon: MapPin },
        { label: 'Charging Equipment', to: '/admin/chargers', icon: PlugZap },
        { label: 'EV Mechanics', to: '/admin/mechanics', icon: Wrench },
      ],
    },
    {
      title: 'Bookings & Finance',
      items: [
        { label: 'All Bookings', to: '/admin/bookings', icon: CalendarCheck },
        { label: 'Payments', to: '/admin/payments', icon: CreditCard },
        { label: 'Transactions', to: '/admin/transactions', icon: ArrowLeftRight },
        { label: 'Refunds', to: '/admin/refunds', icon: Receipt },
        { label: 'Payout Management', to: '/admin/payouts', icon: Wallet },
        { label: 'Platform Commission', to: '/admin/commission', icon: BadgePercent },
      ],
    },
    {
      title: 'Engagement',
      items: [
        { label: 'Reviews & Reports', to: '/admin/reviews', icon: Star },
        { label: 'Notifications', to: '/admin/notifications', icon: Bell },
        { label: 'Support Tickets', to: '/admin/support', icon: LifeBuoy },
        { label: 'Promotions', to: '/admin/promotions', icon: Megaphone },
      ],
    },
    {
      title: 'Configuration',
      items: [
        { label: 'Locations', to: '/admin/locations', icon: Globe2 },
        { label: 'Website Content', to: '/admin/content', icon: Sparkles },
        { label: 'System Settings', to: '/admin/settings', icon: Settings },
        { label: 'Admin Users', to: '/admin/users', icon: ShieldCheck },
        { label: 'Audit Logs', to: '/admin/audit', icon: FileClock },
      ],
    },
  ],
}

const roleLabels: Record<AppRole, string> = {
  customer: 'Driver',
  operator: 'Operator',
  mechanic: 'Mechanic',
  admin: 'Administrator',
}

export function DashboardLayout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('evn.sidebar') === 'collapsed')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const role: AppRole = location.pathname.startsWith('/admin')
    ? 'admin'
    : location.pathname.startsWith('/operator')
      ? 'operator'
      : location.pathname.startsWith('/mechanic')
        ? 'mechanic'
        : 'customer'

  const groups = NAV[role]
  const flatItems = useMemo(() => groups.flatMap((group) => group.items), [groups])
  const current = [...flatItems]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => listNotifications(user!.id),
    enabled: Boolean(user?.id),
    refetchInterval: 30_000,
  })
  const unread = notifications.filter((notification) => !notification.is_read).length

  useEffect(() => {
    if (!user?.id) return
    let unsubscribe: (() => void) | undefined
    void subscribeToNotifications(user.id, () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', user.id] })
    }).then((cleanup) => {
      unsubscribe = cleanup
    })
    return () => unsubscribe?.()
  }, [user?.id, queryClient])

  useEffect(() => {
    setMobileOpen(false)
    setNotificationsOpen(false)
    setAccountOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      localStorage.setItem('evn.sidebar', value ? 'expanded' : 'collapsed')
      return !value
    })
  }

  if (!user) return null

  const sidebar = (
    <div className="flex h-full flex-col bg-midnight-900">
      <div className={cn('flex h-[68px] shrink-0 items-center border-b border-white/[0.07] px-5', collapsed && 'justify-center px-3')}>
        <Logo variant="light" compact={collapsed} />
      </div>
      <div className={cn('mx-4 mt-4 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2', collapsed && 'mx-2 justify-center px-2')}>
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-lime/15 text-lime">
          <Zap className="h-3 w-3" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">
              {roleLabels[role]} portal
            </p>
            <p className="truncate text-[11px] font-semibold text-white/80">{user.profile.full_name}</p>
          </div>
        )}
      </div>

      <nav className="hide-scrollbar mt-4 flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.title} className="mb-4">
            {!collapsed && (
              <p className="mb-1.5 px-2.5 font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-white/25">
                {group.title}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12.5px] font-medium transition-all duration-200',
                        isActive
                          ? 'bg-lime text-midnight-900 shadow-[0_6px_18px_-8px_rgba(198,243,106,0.6)]'
                          : 'text-white/55 hover:bg-white/[0.06] hover:text-white',
                        collapsed && 'justify-center px-2',
                      )
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.label === 'Bookings' && unread > 0 && (
                      <span className="ml-auto rounded-full bg-white/15 px-1.5 py-0.5 font-mono text-[9px]">{unread}</span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn('border-t border-white/[0.07] p-3', collapsed && 'px-2')}>
        <div className={cn('flex items-center gap-2.5 rounded-xl bg-white/[0.04] p-2', collapsed && 'justify-center p-1.5')}>
          <Avatar name={user.profile.full_name} src={user.profile.avatar_url} size={32} />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11.5px] font-semibold text-white">{user.profile.full_name}</p>
              <p className="truncate text-[10px] text-white/35">{roleLabels[role]}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => void signOut().then(() => navigate('/'))}
              className="rounded-lg p-1.5 text-white/30 transition hover:bg-white/5 hover:text-red-400"
              title="Sign out"
              aria-label="Sign out"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={toggleCollapsed}
          className="mt-2 hidden w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] text-white/25 transition hover:bg-white/5 hover:text-white/60 lg:flex"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-mint-50">
      <ScrollProgress />
      <BookingReminders />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden border-r border-white/[0.06] transition-[width] duration-300 lg:block',
          collapsed ? 'w-[74px]' : 'w-[248px]',
        )}
      >
        {sidebar}
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-[70] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-midnight-950/50 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              className="absolute inset-y-0 left-0 w-[86%] max-w-[290px] shadow-sidebar"
            >
              {sidebar}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className={cn('transition-[padding] duration-300', collapsed ? 'lg:pl-[74px]' : 'lg:pl-[248px]')}>
        <header className="sticky top-0 z-30 border-b border-midnight-900/[0.06] bg-mint-50/85 backdrop-blur-xl">
          <div className="flex h-[68px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setMobileOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-midnight-900/10 bg-white text-midnight-900 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            <div className="hidden min-w-0 sm:block">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">{roleLabels[role]} portal</p>
              <h2 className="truncate font-display text-[15px] font-semibold text-midnight-900">
                {current?.label ?? 'Overview'}
              </h2>
            </div>
            <div className="flex-1" />
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden items-center gap-2 rounded-xl border border-midnight-900/10 bg-white px-3 py-2 text-xs text-muted shadow-sm transition hover:border-midnight-900/20 sm:flex"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search…</span>
              <kbd className="ml-6 rounded border border-charcoal-200 bg-charcoal-50 px-1.5 py-0.5 font-mono text-[9px] text-charcoal-500">⌘K</kbd>
            </button>
            <Link
              to={`${role === 'admin' ? '/admin' : role === 'operator' ? '/operator' : '/app'}/notifications`}
              className="relative grid h-9 w-9 place-items-center rounded-xl border border-midnight-900/10 bg-white text-charcoal-600 transition hover:text-midnight-900"
              aria-label="Notifications"
              onClick={(event) => {
                event.preventDefault()
                setNotificationsOpen((value) => !value)
              }}
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-lime px-1 font-mono text-[8.5px] font-bold text-midnight-900">
                  {unread}
                </span>
              )}
            </Link>
            <div className="relative">
              <button
                onClick={() => setAccountOpen((value) => !value)}
                className="flex items-center gap-2 rounded-xl border border-midnight-900/10 bg-white p-1 pr-2 transition hover:bg-charcoal-50"
                aria-label="Account menu"
              >
                <Avatar name={user.profile.full_name} src={user.profile.avatar_url} size={28} />
                <span className="hidden max-w-[90px] truncate text-[11.5px] font-semibold text-midnight-900 sm:block">
                  {user.profile.full_name.split(' ')[0]}
                </span>
              </button>
              <AnimatePresence>
                {accountOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-midnight-900/10 bg-white p-1.5 shadow-float"
                  >
                    <div className="border-b border-midnight-900/5 px-3 py-2.5">
                      <p className="truncate text-sm font-semibold text-midnight-900">{user.profile.full_name}</p>
                      <p className="truncate text-xs text-muted">{user.email}</p>
                    </div>
                    <Link
                      to={role === 'admin' ? '/admin/users' : role === 'operator' ? '/operator/profile' : '/app/profile'}
                      className="mt-1 block rounded-xl px-3 py-2 text-sm text-charcoal-700 hover:bg-mint"
                    >
                      {role === 'operator' ? 'Business profile' : 'My profile'}
                    </Link>
                    <Link to="/" className="block rounded-xl px-3 py-2 text-sm text-charcoal-700 hover:bg-mint">
                      Back to website
                    </Link>
                    <button
                      onClick={() => void signOut().then(() => navigate('/'))}
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <AnimatePresence>
            {notificationsOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute right-4 top-[62px] z-50 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-midnight-900/10 bg-white shadow-float sm:right-6"
              >
                <div className="flex items-center justify-between border-b border-midnight-900/5 px-4 py-3">
                  <p className="font-display text-sm font-semibold text-midnight-900">Notifications</p>
                  <button
                    onClick={() => {
                      void markAllNotificationsRead(user.id).then(() =>
                        queryClient.invalidateQueries({ queryKey: ['notifications', user.id] }),
                      )
                    }}
                    className="text-[11px] font-semibold text-lime-700 hover:underline"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-10 text-center text-xs text-muted">You are all caught up.</p>
                  ) : (
                    notifications.slice(0, 6).map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => {
                          void markNotificationRead(user.id, notification.id).then(() =>
                            queryClient.invalidateQueries({ queryKey: ['notifications', user.id] }),
                          )
                          setNotificationsOpen(false)
                          if (notification.link) navigate(notification.link)
                        }}
                        className={cn(
                          'flex w-full gap-3 border-b border-midnight-900/[0.04] px-4 py-3 text-left transition last:border-0 hover:bg-mint-50',
                          !notification.is_read && 'bg-lime/[0.06]',
                        )}
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-lime-600" />
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-midnight-900">{notification.title}</span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">{notification.message}</span>
                          <span className="mt-1 block font-mono text-[9px] uppercase tracking-wider text-charcoal-300">
                            {relativeTime(notification.created_at)}
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
                <Link
                  to={`${role === 'admin' ? '/admin' : role === 'operator' ? '/operator' : '/app'}/notifications`}
                  onClick={() => setNotificationsOpen(false)}
                  className="block border-t border-midnight-900/5 px-4 py-3 text-center text-[11px] font-semibold text-midnight-900 hover:bg-mint-50"
                >
                  View all notifications
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <main className="px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-start justify-center bg-midnight-950/50 px-4 pt-[12vh] backdrop-blur-sm"
            onClick={() => setSearchOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-float"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-3 border-b border-midnight-900/5 px-4 py-3">
                <Search className="h-4 w-4 text-muted" />
                <input
                  autoFocus
                  placeholder="Jump to a page…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
                  onChange={(event) => {
                    const value = event.target.value.toLowerCase()
                    const match = flatItems.find((item) => item.label.toLowerCase().includes(value))
                    if (value && match && event.target.value.length > 2) {
                      // highlight only; navigation on enter
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      const value = event.currentTarget.value.toLowerCase()
                      const match = flatItems.find((item) => item.label.toLowerCase().includes(value))
                      if (match) {
                        navigate(match.to)
                        setSearchOpen(false)
                      }
                    }
                  }}
                />
                <button onClick={() => setSearchOpen(false)} className="text-muted hover:text-charcoal-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[50vh] overflow-y-auto p-2">
                {flatItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.to}
                      onClick={() => {
                        navigate(item.to)
                        setSearchOpen(false)
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-charcoal-700 transition hover:bg-mint-50"
                    >
                      <Icon className="h-4 w-4 text-muted" />
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <PreviewPill />
    </div>
  )
}
