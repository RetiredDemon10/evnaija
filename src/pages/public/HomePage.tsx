import { motion, useScroll } from 'framer-motion'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BatteryCharging,
  CalendarCheck,
  Check,
  ChevronRight,
  CreditCard,
  Headphones,
  MapPin,
  PlugZap,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchCityCoverage, fetchFeaturedStations, fetchStations } from '@/services/stations'
import { listTopTestimonials } from '@/services/reviews'
import { IMAGES } from '@/lib/images'
import { CONNECTOR_OPTIONS, LAUNCH_LOCATIONS } from '@/lib/constants'
import { NIGERIA_STATE_NAMES, citiesForState, stateLabel } from '@/lib/nigeria'
import { formatNaira } from '@/lib/utils'
import { HeroVideo } from '@/components/common/HeroVideo'
import { SmartImage } from '@/components/common/SmartImage'
import { StationCard } from '@/components/stations/StationCard'
import type { Review } from '@/types'
import { Reveal, SectionHeading, Counter, StarRating } from '@/components/ui/Brand'
import { Badge, Dot } from '@/components/ui/Badge'
import { buttonVariants } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Feedback'
import { cn } from '@/lib/utils'
import { staggerContainer, staggerItem, viewportOnce } from '@/lib/motion'
import { splitHeadline, usePlatformContent } from '@/hooks/usePlatformContent'
import { useSeo } from '@/hooks/usePageTitle'

function HeroSearchField({
  icon: Icon,
  label,
  className,
  children,
}: {
  icon: typeof MapPin
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <motion.label
      whileHover={{ backgroundColor: 'rgba(234, 245, 234, 0.9)' }}
      className={cn(
        'group flex min-w-0 cursor-pointer items-center gap-3 rounded-[20px] px-3.5 py-2.5 transition-colors focus-within:bg-mint-50 lg:rounded-[18px] lg:px-4 lg:py-3',
        className,
      )}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint-100 text-midnight-800 transition-colors duration-300 group-focus-within:bg-midnight-900 group-focus-within:text-lime">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">{label}</span>
        {children}
      </span>
    </motion.label>
  )
}

function HeroSearch() {
  const navigate = useNavigate()
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [connector, setConnector] = useState('')
  const [query, setQuery] = useState('')
  const [pressed, setPressed] = useState(false)

  const states = NIGERIA_STATE_NAMES
  const uniqueCities = citiesForState(state)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setPressed(true)
    window.setTimeout(() => setPressed(false), 650)
    const params = new URLSearchParams()
    if (state) params.set('state', state)
    if (city) params.set('city', city)
    if (connector) params.set('connector', connector)
    if (query) params.set('q', query)
    navigate(`/stations?${params.toString()}`)
  }

  const selectClass =
    'mt-0.5 w-full cursor-pointer truncate bg-transparent text-sm font-semibold text-midnight-900 outline-none transition-all'

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
      onSubmit={handleSubmit}
      className="relative w-full rounded-[28px] border border-white/25 bg-white/95 p-1.5 shadow-[0_60px_120px_-60px_rgba(7,27,34,0.9)] backdrop-blur sm:p-2"
    >
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:flex lg:flex-row lg:items-stretch lg:gap-0 lg:divide-x lg:divide-midnight-900/[0.06]">
        <HeroSearchField icon={MapPin} label="State" className="lg:flex-1">
          <select
            value={state}
            onChange={(event) => {
              setState(event.target.value)
              setCity('')
            }}
            className={selectClass}
            aria-label="Select state"
          >
            <option value="">All states</option>
            {states.map((stateOption) => (
              <option key={stateOption} value={stateOption}>
                {stateLabel(stateOption)}
              </option>
            ))}
          </select>
        </HeroSearchField>

        <HeroSearchField icon={MapPin} label="City" className="lg:flex-1">
          <select
            value={city}
            onChange={(event) => setCity(event.target.value)}
            disabled={!state && uniqueCities.length === 0}
            className={cn(selectClass, 'disabled:cursor-not-allowed disabled:opacity-60')}
            aria-label="Select city"
          >
            <option value="">{state ? `All ${state === 'FCT' ? 'Abuja' : state} cities` : 'All cities'}</option>
            {uniqueCities.map((cityOption) => (
              <option key={cityOption} value={cityOption}>
                {cityOption}
              </option>
            ))}
          </select>
        </HeroSearchField>

        <HeroSearchField icon={PlugZap} label="Connector" className="lg:flex-1">
          <select
            value={connector}
            onChange={(event) => setConnector(event.target.value)}
            className={selectClass}
            aria-label="Select connector type"
          >
            <option value="">Any connector</option>
            {CONNECTOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </HeroSearchField>

        <HeroSearchField icon={Search} label="Location or station" className="lg:flex-[1.45]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Area, landmark or station"
            className="mt-0.5 w-full bg-transparent text-sm font-semibold text-midnight-900 outline-none transition-all placeholder:font-normal placeholder:text-muted"
            aria-label="Search by location or station name"
          />
        </HeroSearchField>

        <motion.button
          type="submit"
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.95 }}
          className={buttonVariants({
            size: 'lg',
            className:
              'relative col-span-full min-h-[56px] shrink-0 overflow-hidden rounded-[20px] px-7 text-base shadow-[0_20px_60px_-30px_rgba(198,243,106,0.9)] lg:ml-1.5 lg:h-auto lg:min-h-0 lg:rounded-[18px]',
          })}
        >
          {pressed && (
            <motion.span
              initial={{ scale: 0, opacity: 0.45 }}
              animate={{ scale: 2.6, opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/50"
            />
          )}
          <Search className="relative h-4 w-4" />
          <span className="relative">Find chargers</span>
          <motion.span
            className="relative inline-flex"
            animate={pressed ? { x: [0, 7, 0] } : { x: 0 }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
          >
            <ArrowRight className="h-4 w-4" />
          </motion.span>
        </motion.button>
      </div>
    </motion.form>
  )
}

function ChargingRing({ value = 88 }: { value?: number }) {
  const radius = 38
  const circumference = 2 * Math.PI * radius
  return (
    <div className="relative h-[104px] w-[104px]">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
        <motion.circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#C6F36A"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (value / 100) * circumference }}
          transition={{ duration: 1.8, ease: 'easeOut', delay: 0.6 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="font-mono text-xl font-medium text-white">{value}%</p>
          <p className="text-[8px] uppercase tracking-[0.16em] text-white/40">charging</p>
        </div>
      </div>
    </div>
  )
}

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: Search,
    title: 'Find a station',
    text: 'Search by city, connector or charging speed. See live availability, reviews and prices before you commit.',
    link: '/stations',
    linkText: 'Browse the network',
  },
  {
    step: '02',
    icon: CalendarCheck,
    title: 'Book and pay',
    text: 'Choose a time slot and your vehicle, then pay securely with Paystack. Your charger is held while you pay.',
    link: '/how-it-works',
    linkText: 'See booking flow',
  },
  {
    step: '03',
    icon: PlugZap,
    title: 'Plug in and charge',
    text: 'Arrive, scan your booking QR code and plug in. Track your session and get a receipt the moment you’re done.',
    link: '/register',
    linkText: 'Create an account',
  },
] as const

/**
 * The three booking steps. They stay on a single row: a snap-scroll rail on
 * small screens (with a scroll-progress bar that animates as you swipe) and an
 * even three-column grid from `lg` up. Cards reveal as they scroll into view.
 */
function HowItWorksSteps() {
  const scroller = useRef<HTMLDivElement>(null)
  const { scrollXProgress } = useScroll({ container: scroller })

  return (
    <div className="relative mt-12 lg:mt-14">
      <div className="pointer-events-none absolute left-[16.6%] right-[16.6%] top-[52px] hidden border-t border-dashed border-midnight-900/15 lg:block" />
      <div
        ref={scroller}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:pb-0"
      >
        {HOW_IT_WORKS.map((item, index) => (
          <motion.div
            key={item.step}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-70px' }}
            transition={{ duration: 0.55, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="w-[80%] shrink-0 snap-center sm:w-[58%] lg:w-auto lg:shrink"
          >
            <div className="group relative flex h-full flex-col rounded-3xl border border-midnight-900/[0.07] bg-mint-50/60 p-6 transition duration-300 hover:-translate-y-1 hover:border-lime-400/60 hover:bg-white hover:shadow-card lg:p-7">
              <div className="flex items-center justify-between">
                <div className="grid h-[56px] w-[56px] place-items-center rounded-2xl bg-midnight-900 text-lime shadow-lg transition duration-300 group-hover:rounded-[20px] lg:h-[64px] lg:w-[64px]">
                  <item.icon className="h-6 w-6 lg:h-7 lg:w-7" strokeWidth={1.6} />
                </div>
                <span className="font-mono text-[34px] font-medium leading-none tracking-tighter text-midnight-900/[0.08] lg:text-[38px]">
                  {item.step}
                </span>
              </div>
              <h3 className="mt-6 font-display text-lg font-semibold text-midnight-900 lg:mt-7 lg:text-xl">{item.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-charcoal-500 lg:mt-2.5">{item.text}</p>
              <Link to={item.link} className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-midnight-900 transition hover:text-lime-700">
                {item.linkText} <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2.5 lg:hidden">
        <div className="h-1 w-36 overflow-hidden rounded-full bg-midnight-900/10">
          <motion.div style={{ scaleX: scrollXProgress }} className="h-full w-full origin-left rounded-full bg-lime-500" />
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">Swipe</span>
      </div>
    </div>
  )
}

function TestimonialCarousel({ reviews }: { reviews: Review[] }) {
  const scroller = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const scrollToCard = (index: number) => {
    const el = scroller.current
    if (!el) return
    const card = el.children[index] as HTMLElement | undefined
    if (!card) return
    const padLeft = parseFloat(getComputedStyle(el).paddingLeft) || 0
    el.scrollTo({ left: card.offsetLeft - padLeft, behavior: 'smooth' })
  }

  useEffect(() => {
    if (paused || reviews.length <= 1) return
    const id = window.setInterval(() => {
      setActiveIndex((current) => {
        const next = (current + 1) % reviews.length
        scrollToCard(next)
        return next
      })
    }, 4800)
    return () => window.clearInterval(id)
  }, [paused, reviews.length])

  const handleScroll = () => {
    const el = scroller.current
    if (!el) return
    const padLeft = parseFloat(getComputedStyle(el).paddingLeft) || 0
    const center = el.scrollLeft + el.clientWidth / 2
    let closest = 0
    let min = Infinity
    Array.from(el.children).forEach((node, index) => {
      const card = node as HTMLElement
      const cardCenter = card.offsetLeft - padLeft + card.clientWidth / 2
      const distance = Math.abs(cardCenter - center)
      if (distance < min) {
        min = distance
        closest = index
      }
    })
    setActiveIndex(closest)
  }

  return (
    <div
      className="relative mt-10 lg:mt-12"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        ref={scroller}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {reviews.map((review) => (
          <figure
            key={review.id}
            className="flex w-[84%] shrink-0 snap-center flex-col rounded-3xl border border-white/60 bg-white/55 p-5 shadow-[0_24px_60px_-34px_rgba(7,27,34,0.5)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/80 hover:bg-white/75 sm:w-[58%] lg:w-[calc((100%-2rem)/3)] lg:p-6"
          >
            <Quote className="h-6 w-6 text-lime-500/70 lg:h-7 lg:w-7" />
            <blockquote className="mt-3 flex-1 text-[13px] leading-relaxed text-charcoal-600 lg:mt-4 lg:text-[13.5px]">
              “{review.comment}”
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-3 border-t border-midnight-900/[0.08] pt-4 lg:mt-6">
              <img
                src={review.customer?.avatar_url ?? ''}
                alt=""
                className="h-8 w-8 rounded-full bg-mint object-cover lg:h-9 lg:w-9"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-midnight-900">{review.customer?.full_name ?? 'Verified driver'}</p>
                <p className="truncate text-[10px] text-muted">{review.station?.name ?? 'EV Naija station'}</p>
              </div>
              <StarRating value={review.overall_rating} size={12} />
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-center gap-2">
        {reviews.map((review, index) => (
          <button
            key={review.id}
            type="button"
            aria-label={`Show review ${index + 1}`}
            onClick={() => {
              setActiveIndex(index)
              scrollToCard(index)
            }}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              index === activeIndex ? 'w-6 bg-lime-500' : 'w-1.5 bg-midnight-900/20 hover:bg-midnight-900/40',
            )}
          />
        ))}
      </div>
    </div>
  )
}

export default function HomePage() {
  useSeo()
  const content = usePlatformContent()
  const hero = splitHeadline(content.heroHeadline)
  const { data: featured = [], isLoading } = useQuery({ queryKey: ['featured-stations'], queryFn: () => fetchFeaturedStations(6) })
  const { data: coverage = [] } = useQuery({ queryKey: ['city-coverage'], queryFn: fetchCityCoverage })
  const { data: testimonials = [] } = useQuery({ queryKey: ['testimonials'], queryFn: () => listTopTestimonials(6) })
  const { data: allStations = [] } = useQuery({ queryKey: ['home-station-stats'], queryFn: () => fetchStations({}) })

  const totalChargers = coverage.reduce((acc, city) => acc + city.chargerCount, 0)
  const heroStation = featured[0] ?? allStations[0]

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-midnight-950 pb-20 pt-32 lg:min-h-[820px] lg:pb-32 lg:pt-40">
        <div className="absolute inset-0 opacity-70">
          <HeroVideo
            clips={['/videos/hero-arrive.mp4', '/videos/hero-charge.mp4']}
            poster="/videos/hero-poster.jpg"
            className="object-center"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-midnight-950 via-midnight-950/88 to-midnight-950/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-midnight-950 via-transparent to-midnight-950/60" />
        <div className="pointer-events-none absolute inset-0 dotted-grid opacity-[0.06]" />
        <div className="pointer-events-none absolute -right-32 top-20 h-[500px] w-[500px] rounded-full bg-lime/10 blur-[140px]" />

        <div className="container-page relative">
          <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              {content.announcement && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45 }}
                  className="mb-4 inline-flex max-w-full items-center gap-2 rounded-xl border border-lime/25 bg-lime/10 px-3 py-2 text-[11px] font-medium text-lime backdrop-blur"
                >
                  <Sparkles className="h-3 w-3 shrink-0" />
                  <span className="truncate">{content.announcement}</span>
                </motion.div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] py-1.5 pl-1.5 pr-3.5 backdrop-blur"
              >
                <span className="rounded-full bg-lime px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-midnight-900">
                  Live network
                </span>
                <span className="text-[11px] text-white/70">Lagos · Abuja · Port Harcourt</span>
                <Dot />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="display-xl mt-6 max-w-[720px] text-balance text-white"
              >
                {hero.lead}{hero.lead ? ' ' : ''}
                <span className="relative inline-block text-lime">
                  {hero.accent}
                  <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 14" fill="none" preserveAspectRatio="none" aria-hidden>
                    <path d="M2 10C60 3 150 2 298 7" stroke="#C6F36A" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
                  </svg>
                </span>
                {hero.tail}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mt-6 max-w-[520px] text-[15px] leading-relaxed text-white/55 sm:text-base"
              >
                {content.heroSubheadline}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mt-8 flex flex-wrap items-center gap-3"
              >
                <Link to="/stations" className={buttonVariants({ size: 'lg' })}>
                  Find a charging station <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/for-operators"
                  className="inline-flex h-[52px] items-center gap-2 rounded-xl border border-white/20 bg-white/[0.06] px-6 text-[15px] font-semibold text-white backdrop-blur transition hover:border-lime/50 hover:bg-lime/10"
                >
                  Become a charging partner <ArrowUpRight className="h-4 w-4" />
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-white/45"
              >
                <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-lime" /> Verified stations</span>
                <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-lime" /> Secure Paystack payments</span>
                <span className="flex items-center gap-1.5"><BatteryCharging className="h-3.5 w-3.5 text-lime" /> Live availability</span>
              </motion.div>
            </div>

            {/* Floating visual */}
            <div className="relative hidden min-h-[440px] lg:block">
              <motion.div
                initial={{ opacity: 0, y: 30, rotate: 2 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.8, delay: 0.25 }}
                className="absolute right-0 top-2 w-[330px] overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.06] p-2.5 shadow-float backdrop-blur-xl"
              >
                <SmartImage
                  src={IMAGES.stationNight}
                  alt="EV charging station at night"
                  className="h-[220px] rounded-[20px]"
                />
                <div className="flex items-center justify-between px-2 pb-1 pt-3">
                  <div>
                    <p className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-white/40">Nearest station</p>
                    <p className="mt-1 font-display text-sm font-semibold text-white">{heroStation?.name ?? 'Marina Charge Hub'}</p>
                  </div>
                  <span className="flex items-center gap-1 rounded-lg bg-lime px-2 py-1 text-[10px] font-bold text-midnight-900">
                    <Zap className="h-2.5 w-2.5" /> {heroStation ? `${heroStation.available_chargers} free` : '4 free'}
                  </span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.55 }}
                className="absolute -left-4 bottom-16 w-[228px] animate-float rounded-2xl border border-white/15 bg-midnight-900/80 p-4 shadow-float backdrop-blur-xl"
              >
                <div className="flex items-center gap-3">
                  <ChargingRing />
                  <div>
                    <p className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-white/40">Tesla Model 3</p>
                    <p className="mt-1 text-xs font-semibold text-white">Lekki Supercharge</p>
                    <p className="mt-1 font-mono text-[10px] text-lime">+38 kWh added</p>
                    <p className="mt-2 text-[9px] text-white/35">Est. 24 min remaining</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.8 }}
                className="absolute -right-3 bottom-2 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/95 px-4 py-3 shadow-float"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint text-midnight-800">
                  <PlugZap className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">From</p>
                  <p className="font-mono text-sm font-medium text-midnight-900">{formatNaira(180)}<span className="text-[9px] font-normal text-muted">/kWh</span></p>
                </div>
              </motion.div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="relative z-10 mt-12 lg:mt-16"
          >
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className="h-1.5 w-1.5 rounded-full bg-lime" />
              <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-white/40">Find a charger near you</p>
            </div>
            <HeroSearch />
          </motion.div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-b border-midnight-900/[0.06] bg-white">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="container-page grid grid-cols-2 divide-x divide-midnight-900/[0.06] sm:grid-cols-4"
        >
          {[
            { value: coverage.length || 3, suffix: '', label: 'Cities live today', prefix: '' },
            { value: allStations.length || 8, suffix: '', label: 'Verified stations', prefix: '' },
            { value: totalChargers || 30, suffix: '+', label: 'Charging points', prefix: '' },
            { value: 4, suffix: '', label: 'Connector standards', prefix: '' },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              variants={staggerItem}
              whileHover={{ y: -3 }}
              className={cn('px-5 py-7 text-center transition-colors hover:bg-mint-50/70 sm:px-8 sm:text-left', index === 0 && 'text-center sm:text-left')}
            >
              <p className="font-mono text-[26px] font-medium leading-none tracking-tight text-midnight-900">
                <Counter to={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
              </p>
              <p className="mt-1.5 text-[11px] uppercase tracking-[0.12em] text-muted">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* FEATURED STATIONS */}
      <section className="bg-mint-50 py-20 lg:py-28">
        <div className="container-page">
          <Reveal>
            <SectionHeading
              eyebrow="Featured stations"
              title="Premium charging, right where you need it."
              description="Handpicked stations with reliable equipment, verified operators and transparent pricing across our launch cities."
              action={
                <Link to="/stations" className={buttonVariants({ variant: 'outline', size: 'md' })}>
                  View all stations <ArrowRight className="h-4 w-4" />
                </Link>
              }
            />
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading
              ? Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="overflow-hidden rounded-3xl bg-white p-3 shadow-card">
                    <Skeleton className="h-52 w-full rounded-2xl" />
                    <div className="space-y-3 p-3 pt-5">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </div>
                ))
              : featured.map((station, index) => (
                  <StationCard key={station.id} station={station} index={index} />
                ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative overflow-hidden bg-white py-20 lg:py-28">
        <div className="pointer-events-none absolute right-0 top-0 h-[420px] w-[420px] rounded-full bg-lime/[0.09] blur-3xl" />
        <div className="container-page relative">
          <Reveal>
            <SectionHeading
              eyebrow="How it works"
              title="Three steps from parked to powered."
              description="No phone calls, no guesswork, no queue anxiety. EV Naija makes charging as simple as booking a ride."
              align="center"
            />
          </Reveal>
          <HowItWorksSteps />
        </div>
      </section>

      {/* COVERAGE */}
      <section id="coverage" className="bg-mint-50 py-20 lg:py-28">
        <div className="container-page">
          <Reveal>
            <SectionHeading
              eyebrow="Where we charge"
              title="Live in Nigeria’s three power cities."
              description="We are building density before expanding. Every station in these cities is verified, mapped and bookable."
              action={
                <Link to="/stations" className={buttonVariants({ variant: 'outline' })}>
                  Explore the map <MapPin className="h-4 w-4" />
                </Link>
              }
            />
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { ...LAUNCH_LOCATIONS[0], image: IMAGES.cityLagos, tagline: 'From the Island to the mainland.' },
              { ...LAUNCH_LOCATIONS[1], image: IMAGES.cityAbuja, tagline: 'Powering the capital’s business districts.' },
              { ...LAUNCH_LOCATIONS[2], image: IMAGES.cityPh, tagline: 'Fast charging for the Garden City.' },
            ].map((city, index) => {
              const stats = coverage.find((entry) => entry.city === city.city)
              return (
                <Reveal key={city.city} delay={index * 0.1}>
                  <Link
                    to={`/stations?city=${encodeURIComponent(city.city)}`}
                    className="group relative block overflow-hidden rounded-3xl border border-midnight-900/10 transition-transform duration-300 hover:-translate-y-1"
                  >
                    <SmartImage src={city.image} alt={`${city.city} cityscape`} className="aspect-[4/5] w-full sm:aspect-[4/4.4]" imgClassName="object-cover transition duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-midnight-950 via-midnight-950/25 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-6">
                      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-lime">{city.state} state</p>
                      <div className="mt-2 flex items-end justify-between">
                        <div>
                          <h3 className="font-display text-2xl font-semibold text-white">{city.city}</h3>
                          <p className="mt-1 max-w-[200px] text-[11px] leading-relaxed text-white/50">{city.tagline}</p>
                        </div>
                        <span className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur transition group-hover:border-lime group-hover:bg-lime group-hover:text-midnight-900">
                          <ArrowUpRight className="h-4 w-4" />
                        </span>
                      </div>
                      <div className="mt-4 flex items-center gap-4 border-t border-white/15 pt-3 text-[10px] text-white/60">
                        <span><span className="font-mono text-lime">{stats?.stationCount ?? 0}</span> stations</span>
                        <span><span className="font-mono text-lime">{stats?.chargerCount ?? 0}</span> charging points</span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* PARTNER */}
      <section className="relative overflow-hidden bg-white py-20 lg:py-28">
        <div className="container-page">
          <Reveal>
            <div className="grid overflow-hidden rounded-[32px] border border-midnight-900/[0.07] bg-midnight-950 lg:grid-cols-2">
            <div className="relative min-h-[200px] sm:min-h-[260px] lg:min-h-[520px]">
              <SmartImage src={IMAGES.evOwner} alt="EV owner using a charging station" className="absolute inset-0 h-full" imgClassName="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-midnight-950/40 lg:bg-gradient-to-r lg:from-transparent lg:to-midnight-950" />
              <div className="absolute bottom-5 left-5 rounded-2xl border border-white/15 bg-midnight-900/70 p-4 backdrop-blur-xl">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">Operator dashboard</p>
                <p className="mt-1 font-mono text-2xl font-medium text-lime">₦486,200</p>
                <p className="text-[10px] text-white/40">revenue · this month</p>
              </div>
            </div>
            <div className="relative p-8 sm:p-10 lg:p-14">
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-lime/10 blur-3xl" />
              <span className="eyebrow relative text-lime"><span className="h-1.5 w-1.5 rounded-full bg-lime" /> For station owners</span>
              <h2 className="relative mt-4 font-display text-3xl font-semibold leading-[1.08] tracking-[-0.03em] text-white sm:text-4xl">
                Turn your charging bays into a growing business.
              </h2>
              <p className="relative mt-4 text-sm leading-relaxed text-white/50">
                Join Nigeria’s premium charging marketplace. List your station, set your prices and receive bookings from
                drivers who are ready to pay.
              </p>
              <ul className="relative mt-7 space-y-3">
                {[
                  { icon: PlugZap, text: 'Register and manage every charger' },
                  { icon: CalendarCheck, text: 'Receive confirmed, paid bookings' },
                  { icon: TrendingUp, text: 'Track revenue and settlements in real time' },
                  { icon: ShieldCheck, text: 'Automatic commission and payout ledger' },
                ].map((item) => (
                  <li key={item.text} className="flex items-center gap-3 text-sm text-white/65">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-lime/10 text-lime"><item.icon className="h-4 w-4" /></span>
                    {item.text}
                  </li>
                ))}
              </ul>
              <div className="relative mt-8 flex flex-wrap gap-3">
                <Link to="/register/operator" className={buttonVariants({ size: 'lg' })}>
                  Become a charging partner <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/for-operators" className="inline-flex h-[52px] items-center rounded-xl border border-white/15 px-6 text-sm font-semibold text-white/80 transition hover:border-lime/40 hover:text-lime">
                  Why list with EV Naija
                </Link>
              </div>
              <p className="relative mt-5 flex items-center gap-1.5 text-[10px] text-white/30">
                <Check className="h-3 w-3 text-lime" /> No listing fees. Pay commission only when you earn.
              </p>
            </div>
          </div>
          </Reveal>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="relative overflow-hidden bg-gradient-to-b from-mint-50 via-mint-100 to-mint-50 py-20 lg:py-28">
        <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-lime/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-midnight-900/[0.06] blur-3xl" />
        <div className="container-page relative">
          <Reveal>
            <SectionHeading
              eyebrow="Driver stories"
              title="Reviewed by the people who charge."
              description="Every review on EV Naija comes from a verified customer with a completed session. No invented testimonials."
              align="center"
            />
          </Reveal>
          <TestimonialCarousel reviews={testimonials} />
          <div className="mt-8 flex flex-col items-center justify-center gap-2 text-center lg:mt-10">
            <div className="flex items-center gap-1">
              <StarRating value={5} size={16} />
              <span className="ml-1 font-mono text-sm font-medium text-midnight-900">
                {(testimonials.reduce((acc, review) => acc + review.overall_rating, 0) / Math.max(testimonials.length, 1)).toFixed(1)}
              </span>
            </div>
            <p className="text-[11px] text-muted">Average rating from verified charging sessions</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-mint-50 pb-20">
        <div className="container-page">
          <Reveal>
            <div className="relative overflow-hidden rounded-[32px] bg-lime px-7 py-12 sm:px-12 lg:px-16 lg:py-16">
            <div className="pointer-events-none absolute -right-20 -top-32 h-[380px] w-[380px] rounded-full border-[60px] border-midnight-900/[0.06]" />
            <div className="pointer-events-none absolute -bottom-10 right-24 h-32 w-32 rounded-full bg-white/30 blur-2xl" />
            <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-midnight-700/60">Your next charge is waiting</p>
                <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-[1.05] tracking-[-0.035em] text-midnight-950 sm:text-4xl lg:text-5xl">
                  Ready to drive electric without the range anxiety?
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/register" className={buttonVariants({ variant: 'dark', size: 'lg' }) + ' hover:scale-[1.02] active:scale-[0.99]'}>
                  Create free account <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/stations" className="inline-flex h-[52px] items-center rounded-xl border border-midnight-900/20 px-6 text-sm font-semibold text-midnight-900 transition hover:scale-[1.02] hover:bg-midnight-900 hover:text-lime active:scale-[0.99]">
                  Find a charger
                </Link>
              </div>
            </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
