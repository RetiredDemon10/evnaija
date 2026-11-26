import { ArrowRight, BatteryCharging, Globe2, HeartHandshake, Leaf, MapPin, ShieldCheck, Sparkles, Users, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { IMAGES } from '@/lib/images'
import { LAUNCH_LOCATIONS } from '@/lib/constants'
import { SmartImage } from '@/components/common/SmartImage'
import { Counter, Reveal, SectionHeading } from '@/components/ui/Brand'
import { Badge } from '@/components/ui/Badge'
import { buttonVariants } from '@/components/ui/Button'
import { usePageTitle } from '@/hooks/usePageTitle'

const VALUES = [
  {
    icon: ShieldCheck,
    title: 'Trust is infrastructure',
    text: 'Verified operators, verified equipment, verified reviews. If we cannot stand behind it, it does not go on the map.',
  },
  {
    icon: Globe2,
    title: 'Local first',
    text: 'Nigerian cities, Nigerian operators, Nigerian payment rails. Built around how the country actually moves.',
  },
  {
    icon: Zap,
    title: 'Reliability over hype',
    text: 'A charger that works beats a headline that sounds good. We obsess over uptime, accuracy and support response.',
  },
  {
    icon: Leaf,
    title: 'A cleaner road',
    text: 'Every booking is a small vote for cleaner air and quieter streets. We make the switch easier to choose.',
  },
]

export default function AboutPage() {
  usePageTitle('About EV Naija')
  return (
    <div>
      <section className="relative overflow-hidden bg-midnight-950 pb-20 pt-32 lg:pb-28 lg:pt-40">
        <SmartImage src={IMAGES.nigerianRoad} alt="A major road in Lagos, Nigeria" className="absolute inset-0 h-full w-full" imgClassName="object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-r from-midnight-950 via-midnight-950/92 to-midnight-950/50" />
        <div className="pointer-events-none absolute inset-0 dotted-grid opacity-[0.06]" />
        <div className="container-page relative">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-lime/25 bg-lime/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-lime">
              <Sparkles className="h-3 w-3" /> About EV Naija
            </span>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl lg:text-[3.7rem]">
              Nigeria is going electric. <span className="text-lime">The road should be ready.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/55">
              EV Naija is the charging marketplace for the next generation of Nigerian drivers. We connect EV owners to
              verified, bookable charging infrastructure — and give operators the tools to run it professionally.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/stations" className={buttonVariants({ size: 'lg' })}>
                Explore the network <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/for-operators" className="inline-flex h-[52px] items-center rounded-xl border border-white/20 px-6 text-sm font-semibold text-white/80 transition hover:border-lime/40 hover:text-lime">
                Partner with us
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-midnight-900/[0.06] bg-white">
        <div className="container-page grid grid-cols-2 divide-x divide-midnight-900/[0.06] sm:grid-cols-4">
          {[
            { value: 3, label: 'Cities live today' },
            { value: 8, label: 'Verified stations' },
            { value: 30, suffix: '+', label: 'Charging points' },
            { value: 4, label: 'Connector standards' },
          ].map((stat) => (
            <div key={stat.label} className="px-4 py-7 text-center sm:px-6 sm:text-left">
              <p className="font-mono text-[26px] font-medium leading-none text-midnight-900">
                <Counter to={stat.value} suffix={stat.suffix ?? ''} />
              </p>
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-mint-50 py-20 lg:py-28">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="relative">
              <SmartImage src={IMAGES.cityLagos} alt="Lagos cityscape" className="aspect-[4/3] w-full rounded-3xl" imgClassName="object-cover" />
              <div className="absolute -bottom-5 -right-2 rounded-2xl border border-midnight-900/10 bg-white px-5 py-4 shadow-float sm:right-6">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Starting where it matters</p>
                <p className="mt-1 font-display text-lg font-semibold text-midnight-900">Lagos · Abuja · Port Harcourt</p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <SectionHeading
              eyebrow="Why we exist"
              title="Range anxiety is a trust problem."
              description="Drivers do not just need a charger on a map. They need to know it exists, works, is available and will honour the price. That is the problem EV Naija solves."
            />
            <div className="mt-7 space-y-4 text-[13.5px] leading-relaxed text-charcoal-600">
              <p>
                Nigeria’s EV adoption is accelerating, but charging infrastructure is still fragmented and opaque. Drivers
                discover stations through word of mouth, arrive to find them occupied, and have no way to reserve or pay
                predictably.
              </p>
              <p>
                Operators, meanwhile, are building serious infrastructure without a modern demand channel or settlement
                system. We bring both sides onto one trusted platform: live availability, reserved time slots, secure
                payments, verified reviews and transparent operator payouts.
              </p>
              <p>
                We are starting with density in three cities rather than dots across the country. Every station we list
                is checked. Every review comes from a completed session. Every naira is ledgered.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-white py-20 lg:py-28">
        <div className="container-page">
          <Reveal>
            <SectionHeading
              eyebrow="What we stand for"
              title="Four principles we do not trade away."
              description="These shape the product, the partnerships we accept and the stations that carry our badge."
              align="center"
            />
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((value, index) => (
              <Reveal key={value.title} delay={index * 0.08}>
                <div className="flex h-full flex-col rounded-3xl border border-midnight-900/[0.07] bg-mint-50/60 p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-midnight-900 text-lime">
                    <value.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-display text-base font-semibold text-midnight-900">{value.title}</h3>
                  <p className="mt-2 text-[12px] leading-relaxed text-charcoal-500">{value.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-midnight-950 py-20 text-white lg:py-28">
        <div className="container-page">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <Reveal>
              <SectionHeading
                eyebrow="Our footprint"
                title="Dense where we launch. Honest about where we are not."
                description="We would rather have a reliable network in three cities than an unreliable pin in thirty."
                light
              />
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-3">
              {LAUNCH_LOCATIONS.map((city, index) => (
                <Reveal key={city.city} delay={index * 0.08}>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <MapPin className="h-4 w-4 text-lime" />
                    <p className="mt-3 font-display text-base font-semibold text-white">{city.city}</p>
                    <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">{city.state} state</p>
                    <p className="mt-2 text-[11px] leading-relaxed text-white/45">{city.areas.slice(0, 4).join(' · ')}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-mint-50 py-20 lg:py-24">
        <div className="container-page">
          <div className="grid gap-6 overflow-hidden rounded-[32px] border border-midnight-900/[0.07] bg-white lg:grid-cols-2">
            <div className="relative min-h-[280px]">
              <SmartImage src={IMAGES.evDetail} alt="Electric car parked in the city" className="absolute inset-0 h-full" imgClassName="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 lg:to-white" />
            </div>
            <div className="p-8 sm:p-10">
              <Badge tone="lime">We are building in public</Badge>
              <h2 className="mt-4 font-display text-2xl font-semibold leading-tight text-midnight-900 sm:text-3xl">
                A network shaped by the people who use it.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-charcoal-500">
                Drivers tell us where the gaps are. Operators tell us what the tools need. We ship accordingly. If you
                have a station we should list, a route that needs coverage, or feedback on the experience, we want to
                hear it.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link to="/contact" className={buttonVariants({ variant: 'dark' })}>
                  <HeartHandshake className="h-4 w-4" /> Share feedback
                </Link>
                <Link to="/for-operators" className={buttonVariants({ variant: 'outline' })}>
                  List a station
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
