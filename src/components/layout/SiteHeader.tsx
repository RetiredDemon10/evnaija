import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, ChevronDown, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Logo, Avatar } from '@/components/ui/Brand'
import { buttonVariants } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { spring } from '@/lib/motion'
import { PreviewPill } from '@/components/layout/PreviewPill'
import { dashboardPath } from '@/lib/roles'

const NAV = [
  { label: 'Home', to: '/' },
  { label: 'Find Stations', to: '/stations' },
  { label: 'Find Mechanics', to: '/mechanics' },
  { label: 'Manage Booking', to: '/manage-booking' },
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'For Station Owners', to: '/for-operators' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const location = useLocation()
  const { user, signOut } = useAuth()
  const isHome = location.pathname === '/'
  const overHero = isHome && !scrolled

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setOpen(false)
    setAccountOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const dashboardLink = user ? dashboardPath(user.roles) : '/app'

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-300',
          overHero
            ? 'border-b border-white/10 bg-midnight-950/80 backdrop-blur-md'
            : 'border-b border-midnight-900/[0.06] bg-white/85 backdrop-blur-xl',
        )}
      >
        <div className="container-page flex h-[72px] items-center justify-between gap-4">
          <Logo variant={overHero ? 'light' : 'dark'} />

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main navigation">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'relative rounded-lg px-3 py-2 text-[13px] font-medium transition',
                    overHero
                      ? isActive
                        ? 'text-lime'
                        : 'text-white/70 hover:text-white'
                      : isActive
                        ? 'text-midnight-900'
                        : 'text-charcoal-500 hover:text-midnight-900',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && (
                      <motion.span
                        layoutId="nav-underline"
                        transition={spring}
                        className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-lime"
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2.5 lg:flex">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setAccountOpen((value) => !value)}
                  className={cn(
                    'flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 transition',
                    overHero
                      ? 'border-white/15 bg-white/10 text-white hover:bg-white/15'
                      : 'border-midnight-900/10 bg-white text-midnight-900 hover:bg-charcoal-50',
                  )}
                >
                  <Avatar name={user.profile.full_name} src={user.profile.avatar_url} size={30} />
                  <span className="max-w-[110px] truncate text-xs font-semibold">
                    {user.profile.full_name.split(' ')[0]}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>
                <AnimatePresence>
                  {accountOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-midnight-900/10 bg-white p-1.5 shadow-float"
                    >
                      <div className="border-b border-midnight-900/5 px-3 py-2.5">
                        <p className="truncate text-sm font-semibold text-midnight-900">{user.profile.full_name}</p>
                        <p className="truncate text-xs text-muted">{user.email}</p>
                      </div>
                      <Link to={dashboardLink} className="mt-1 block rounded-xl px-3 py-2 text-sm text-charcoal-700 hover:bg-mint">
                        Go to dashboard
                      </Link>
                      <Link to="/app/support" className="block rounded-xl px-3 py-2 text-sm text-charcoal-700 hover:bg-mint">
                        Support
                      </Link>
                      <button
                        onClick={() => void signOut()}
                        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className={cn(
                    'rounded-xl px-4 py-2.5 text-[13px] font-semibold transition',
                    overHero ? 'text-white/80 hover:text-white' : 'text-charcoal-600 hover:text-midnight-900',
                  )}
                >
                  Login
                </Link>
                <Link to="/register" className={buttonVariants({ variant: overHero ? 'primary' : 'dark', size: 'sm', className: 'h-10 px-4' })}>
                  Get Started
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setOpen(true)}
            className={cn(
              'grid h-10 w-10 place-items-center rounded-xl border transition lg:hidden',
              overHero ? 'border-white/20 text-white' : 'border-midnight-900/10 text-midnight-900',
            )}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-midnight-950/40 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              className="absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col bg-midnight-900"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <Logo variant="light" />
                <button
                  onClick={() => setOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 text-white"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-4 py-5" aria-label="Mobile navigation">
                {NAV.map((item, index) => (
                  <motion.div
                    key={item.to}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + index * 0.04 }}
                  >
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center justify-between rounded-2xl px-4 py-3.5 font-display text-lg font-medium transition',
                          isActive ? 'bg-lime/10 text-lime' : 'text-white/80 hover:bg-white/5 hover:text-white',
                        )
                      }
                    >
                      {item.label}
                      <ArrowUpRight className="h-4 w-4 opacity-40" />
                    </NavLink>
                  </motion.div>
                ))}
              </nav>
              <div className="space-y-2 border-t border-white/10 p-5">
                {user ? (
                  <>
                    <Link to={dashboardLink} className={buttonVariants({ className: 'w-full' })}>
                      Go to dashboard
                    </Link>
                    <button
                      onClick={() => void signOut()}
                      className="w-full rounded-xl border border-white/15 py-3 text-sm font-semibold text-white/70"
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/register" className={buttonVariants({ className: 'w-full' })}>
                      Create free account
                    </Link>
                    <Link
                      to="/login"
                      className="block w-full rounded-xl border border-white/15 py-3 text-center text-sm font-semibold text-white/80"
                    >
                      Login
                    </Link>
                  </>
                )}
                <Link to="/for-operators" className="block pt-2 text-center text-xs text-white/45 hover:text-lime">
                  Become a charging partner
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <PreviewPill />
    </>
  )
}
