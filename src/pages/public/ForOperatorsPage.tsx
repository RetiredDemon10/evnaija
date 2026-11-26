import { ArrowRight, BarChart3, Building2, CalendarCheck, Check, CreditCard, Headphones, MapPin, PlugZap, ShieldCheck, Sparkles, TrendingUp, Users, Wallet, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { IMAGES } from '@/lib/images'
import { SITE_FEES } from '@/lib/fees'
import { formatNaira } from '@/lib/utils'
import { SmartImage } from '@/components/common/SmartImage'
import { Reveal, SectionHeading, Counter } from '@/components/ui/Brand'
import { Badge } from '@/components/ui/Badge'
import { buttonVariants } from '@/components/ui/Button'
import { usePageTitle } from '@/hooks/usePageTitle'

const BENEFITS = [
  {
    icon: Users,
    title: 'Drivers who are ready to pay',
    text: 'Every booking is paid before it is confirmed. You are not managing no-shows or chasing cash at the gate.',
  },
  {
    icon: CalendarCheck,
    title: 'A booking calendar that works',
    text: 'Real-time reservations, charger availability, check-in and session status in one clean operations dashboard.',
  },
  {
    icon: BarChart3,
    title: 'Revenue you can read',
    text: 'Gross revenue, platform commission, net earnings and pending payouts, updated with every completed session.',
  },
  {
    icon: Wallet,
    title: 'Automatic settlements',
    text: `Request payouts to any Nigerian bank once you pass the ${formatNaira(SITE_FEES.minimumPayout)} threshold. Every naira is ledgered.`,
  },
  {
    icon: ShieldCheck,
    title: 'Verification that builds trust',
    text: 'We verify your business, documents and equipment. That badge is why drivers choose EV Naija stations.',
  },
  {
    icon: Headphones,
    title: 'A partner team, not a bot',
    text: 'Onboarding support, equipment guidance and a human who answers when something needs attention.',
  },
]

const ONBOARDING = [
  { step: '01', title: 'Apply in minutes', text: 'Tell us about your business, locations and charging equipment. No listing fee.' },
  { step: '02', title: 'Get verified', text: 'Upload CAC registration, identification and proof of ownership. We review within 2 business days.' },
  { step: '03', title: 'Publish your station', text: 'Add chargers, connectors, pricing and availability. Set a booking fee if you want one.' },
  { step: '04', title: 'Earn from bookings', text: 'Drivers reserve and pay. You check them in, they charge, and your ledger updates automatically.' },
]

export default function ForOperatorsPage() {
  usePageTitle('For station owners')
  return (
    <div>
      <section className="relative overflow-hidden bg-midnight-950 pb-20 pt-32 lg:pb-28 lg:pt-40">
        <SmartImage src={IMAGES.evFleet} alt="Fleet of electric vehicles charging" className="absolute inset-0 h-full w-full" imgClassName="object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-midnight-950 via-midnight-950/92 to-midnight-950/35" />
        <div className="pointer-events-none absolute inset-0 dotted-grid opacity-[0.05]" />
        <div className="container-page relative">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-lime/25 bg-lime/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-lime">
              <Building2 className="h-3 w-3" /> For station owners
            </span>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl lg:text-[3.7rem]">
              Turn charging bays into a <span className="text-lime">predictable business.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/55">
              EV Naija brings you paying drivers, handles the booking and payment rails, and gives you the tools to run
              your charging operation like a modern business.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register/operator" className={buttonVariants({ size: 'lg' })}>
                Become a charging partner <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/contact" className="inline-flex h-[52px] items-center rounded-xl border border-white/20 px-6 text-sm font-semibold text-white/80 transition hover:border-lime/40 hover:text-lime">
                Talk to the team
              </Link>
            </div>
            <p className="mt-5 flex items-center gap-1.5 text-[10px] text-white/35">
              <Check className="h-3 w-3 text-lime" /> No listing fees. Commission only when you earn.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { value: 3, suffix: '', label: 'Launch cities' },
              { value: 30, suffix: '+', label: 'Charging points' },
              { value: SITE_FEES.commissionPercent, suffix: '%', label: 'Platform commission' },
              { value: 2, suffix: ' days', label: 'Verification time' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-5 backdrop-blur">
                <p className="font-mono text-2xl font-medium text-white">
                  <Counter to={stat.value} suffix={stat.suffix} />
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/35">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20 lg:py-28">
        <div className="container-page">
          <Reveal>
            <SectionHeading
              eyebrow="Why partner with us"
              title="Everything you need to run charging as a business."
              description="We built the operating system so you can focus on uptime, driver experience and growth."
            />
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((benefit, index) => (
              <Reveal key={benefit.title} delay={index * 0.06}>
                <div className="flex h-full flex-col rounded-3xl border border-midnight-900/[0.07] bg-mint-50/60 p-6 transition hover:-translate-y-0.5 hover:border-lime-400/60 hover:bg-white hover:shadow-card">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-midnight-900 text-lime">
                    <benefit.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-display text-base font-semibold text-midnight-900">{benefit.title}</h3>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-charcoal-500">{benefit.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-mint-50 py-20 lg:py-28">
        <div className="container-page">
          <Reveal>
            <div className="relative overflow-hidden rounded-[32px] bg-midnight-950 px-6 py-10 ring-1 ring-midnight-900/10 sm:px-10 lg:px-14 lg:py-14">
              <div className="pointer-events-none absolute -right-24 -top-28 h-[460px] w-[460px] rounded-full bg-lime/10 blur-[130px]" />
              <div className="pointer-events-none absolute inset-0 dotted-grid opacity-[0.05]" />

              <div className="relative grid items-start gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
                <div>
                  <span className="eyebrow text-lime">
                    <span className="h-1.5 w-1.5 rounded-full bg-lime" />
                    The economics
                  </span>
                  <h2 className="mt-3 font-display text-3xl font-semibold leading-[1.05] tracking-[-0.035em] text-white sm:text-4xl lg:text-[2.6rem]">
                    Transparent commission. No surprises.
                  </h2>
                  <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/55">
                    A flat {SITE_FEES.commissionPercent}% platform commission on charging revenue. Booking fees stay with
                    you. Payouts are ledgered and auditable.
                  </p>

                  <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">Revenue split</span>
                      <span className="font-mono text-[10px] text-white/45">per ₦100 charged</span>
                    </div>
                    <div className="mt-4 flex h-3 gap-px overflow-hidden rounded-full bg-white/10">
                      <span className="h-full rounded-l-full bg-lime" style={{ width: `${100 - SITE_FEES.commissionPercent}%` }} />
                      <span className="h-full rounded-r-full bg-white/25" style={{ width: `${SITE_FEES.commissionPercent}%` }} />
                    </div>
                    <div className="mt-4 flex items-center justify-between text-[11px]">
                      <span className="inline-flex items-center gap-2 text-white/60">
                        <span className="h-2 w-2 rounded-full bg-lime" />
                        You keep <b className="font-mono font-medium text-white">₦{100 - SITE_FEES.commissionPercent}</b>
                      </span>
                      <span className="inline-flex items-center gap-2 text-white/45">
                        <span className="h-2 w-2 rounded-full bg-white/30" />
                        Platform <b className="font-mono font-medium text-white/80">₦{SITE_FEES.commissionPercent}</b>
                      </span>
                    </div>
                  </div>

                  <p className="mt-4 flex items-center gap-2 text-[11px] text-white/35">
                    <ShieldCheck className="h-3.5 w-3.5 text-lime" />
                    Commission applies only to completed charging revenue.
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-xl lg:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">Operator dashboard</p>
                      <p className="mt-1.5 font-display text-lg font-semibold text-white">Revenue this month</p>
                    </div>
                    <Badge tone="lime">+18.4%</Badge>
                  </div>

                  <div className="mt-5 flex items-end gap-2">
                    <span className="font-display text-4xl font-semibold tracking-[-0.03em] text-white lg:text-5xl">₦1.84m</span>
                    <span className="mb-1 text-[11px] text-white/40">gross</span>
                  </div>

                  <div className="mt-6 flex h-24 items-end gap-1.5">
                    {[38, 46, 41, 54, 49, 62, 58, 71, 66, 78, 84, 100].map((value, index) => (
                      <span
                        key={index}
                        className={`flex-1 rounded-t-[4px] ${index === 11 ? 'bg-lime' : 'bg-white/15'}`}
                        style={{ height: `${value}%` }}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between font-mono text-[8.5px] uppercase tracking-wider text-white/25">
                    <span>Jan</span>
                    <span>Jun</span>
                    <span>Dec</span>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-2.5">
                    {[
                      { label: 'Gross', value: '₦1.84m' },
                      { label: 'Commission', value: '₦276k' },
                      { label: 'Net', value: '₦1.56m' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl bg-white/[0.06] px-3 py-3">
                        <p className="font-mono text-[13px] font-medium text-white">{item.value}</p>
                        <p className="mt-1 text-[8.5px] uppercase tracking-wider text-white/35">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Charging revenue', value: '100%', detail: 'What your drivers pay for energy.' },
                  { label: 'Platform commission', value: `${SITE_FEES.commissionPercent}%`, detail: 'Covers payments, verification, support and demand generation.' },
                  { label: 'Your net earnings', value: `${100 - SITE_FEES.commissionPercent}% + booking fees`, detail: 'Settled to your Nigerian bank account.' },
                  { label: 'Minimum payout', value: formatNaira(SITE_FEES.minimumPayout), detail: 'Request a payout once your available balance clears this threshold.' },
                ].map((row) => (
                  <div key={row.label} className="bg-midnight-950 p-5">
                    <p className="font-mono text-[13px] font-medium text-lime">{row.value}</p>
                    <p className="mt-2 text-[12.5px] font-semibold text-white">{row.label}</p>
                    <p className="mt-1 text-[10.5px] leading-relaxed text-white/40">{row.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-white py-20 lg:py-28">
        <div className="container-page">
          <Reveal>
            <SectionHeading
              eyebrow="Onboarding"
              title="From application to first booking in days."
              description="A guided process with a real review, so drivers know your station is legitimate."
              align="center"
            />
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ONBOARDING.map((item, index) => (
              <Reveal key={item.step} delay={index * 0.08}>
                <div className="relative flex h-full flex-col rounded-3xl border border-midnight-900/[0.07] bg-mint-50/60 p-6">
                  <span className="font-mono text-[34px] font-medium leading-none text-midnight-900/10">{item.step}</span>
                  <h3 className="mt-4 font-display text-base font-semibold text-midnight-900">{item.title}</h3>
                  <p className="mt-2 text-[12px] leading-relaxed text-charcoal-500">{item.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-mint-50 py-20">
        <div className="container-page grid gap-5 lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-3xl border border-midnight-900/10 lg:col-span-2">
            <SmartImage src={IMAGES.evOwner} alt="EV owner at a charging station" className="aspect-[16/9] w-full lg:aspect-auto lg:h-full" imgClassName="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-midnight-950 via-midnight-950/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-7">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-lime">Partner support</p>
              <h3 className="mt-2 max-w-lg font-display text-2xl font-semibold text-white">
                You are not listing on a directory. You are joining a network.
              </h3>
              <p className="mt-2 max-w-lg text-[12.5px] leading-relaxed text-white/50">
                Our partner team helps with pricing strategy, equipment uptime and driver experience so your station
                performs, not just exists.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {[
              { icon: Sparkles, title: 'Featured placement', text: 'Promote your station on the homepage and in search when you want extra visibility.' },
              { icon: TrendingUp, title: 'Demand insights', text: 'See booking patterns, repeat drivers and revenue trends across your locations.' },
              { icon: PlugZap, title: 'Equipment records', text: 'Keep charger specs, connectors and availability current from one dashboard.' },
            ].map((item) => (
              <div key={item.title} className="flex-1 rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-lime/30 text-midnight-800"><item.icon className="h-4 w-4" /></span>
                <p className="mt-3 text-sm font-semibold text-midnight-900">{item.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white pb-20 pt-6">
        <div className="container-page">
          <div className="relative overflow-hidden rounded-[32px] bg-lime px-7 py-12 sm:px-12 lg:px-16">
            <div className="pointer-events-none absolute -right-20 -top-32 h-[380px] w-[380px] rounded-full border-[60px] border-midnight-900/[0.06]" />
            <div className="relative flex flex-col items-start justify-between gap-7 lg:flex-row lg:items-center">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-midnight-700/60">Grow with EV Naija</p>
                <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-[1.05] tracking-[-0.035em] text-midnight-950 sm:text-4xl">
                  Ready to put your chargers to work?
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-midnight-900/60">
                  Apply today. Our team will help you get verified, published and ready for your first booking.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/register/operator" className={buttonVariants({ variant: 'dark', size: 'lg' })}>
                  Apply as an operator <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/contact" className="inline-flex h-[52px] items-center rounded-xl border border-midnight-900/20 px-6 text-sm font-semibold text-midnight-900 transition hover:bg-midnight-900 hover:text-lime">
                  Request a call
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
