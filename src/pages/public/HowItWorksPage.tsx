import { ArrowRight, BatteryCharging, CalendarCheck, CreditCard, QrCode, Search, ShieldCheck, Smartphone, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { FAQS } from '@/lib/constants'
import { IMAGES } from '@/lib/images'
import { SmartImage } from '@/components/common/SmartImage'
import { Reveal, SectionHeading } from '@/components/ui/Brand'
import { buttonVariants } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useSeo } from '@/hooks/usePageTitle'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    step: '01',
    icon: Search,
    title: 'Find your station',
    text: 'Search by city, area, connector or charging speed. See verified photos, live availability, prices and real driver reviews before you commit.',
    detail: 'Filter Type 2, CCS2, CHAdeMO and GB/T. Set a max price or minimum rating and the network narrows instantly.',
  },
  {
    step: '02',
    icon: CalendarCheck,
    title: 'Reserve a time slot',
    text: 'Choose a charger, date and duration. Add the vehicle you are driving so we can estimate the energy you will need.',
    detail: 'Your slot is held for 15 minutes while you pay, so another driver cannot take it mid-checkout.',
  },
  {
    step: '03',
    icon: CreditCard,
    title: 'Pay securely',
    text: 'Pay with card, bank transfer or USSD through Paystack. Every payment is verified server-side before your booking is confirmed.',
    detail: 'You receive an itemised receipt by email and in your dashboard: energy, booking fee, service fee and VAT.',
  },
  {
    step: '04',
    icon: QrCode,
    title: 'Scan, plug in, drive',
    text: 'Arrive at your reserved time, scan your booking QR code at the charger and plug in. Track your session from your dashboard.',
    detail: 'When you are done, your receipt and session summary are ready instantly. Leave a review to help other drivers.',
  },
]

const FAQ_SCHEMA = {
  '@type': 'FAQPage',
  mainEntity: FAQS.map((faq) => ({
    '@type': 'Question',
    name: faq.q,
    acceptedAnswer: { '@type': 'Answer', text: faq.a },
  })),
}

export default function HowItWorksPage() {
  useSeo({ title: 'How it works', jsonLd: FAQ_SCHEMA })
  const [openFaq, setOpenFaq] = useState(0)

  return (
    <div>
      <section className="relative overflow-hidden bg-midnight-950 pb-20 pt-32 lg:pb-28 lg:pt-40">
        <SmartImage src={IMAGES.evChargingBay} alt="EV plugged into a charger" className="absolute inset-0 h-full w-full" imgClassName="object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-midnight-950 via-midnight-950/92 to-midnight-950/45" />
        <div className="pointer-events-none absolute inset-0 dotted-grid opacity-[0.06]" />
        <div className="container-page relative grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-lime/25 bg-lime/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-lime">
              <Zap className="h-3 w-3" /> How EV Naija works
            </span>
            <h1 className="mt-5 max-w-2xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl lg:text-[3.6rem]">
              From “low battery” to <span className="text-lime">fully charged</span> in four steps.
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/55">
              No phone calls, no queue guesswork, no cash at the gate. EV Naija gives you a reserved charger, a secure
              payment and a verified operator behind every session.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/stations" className={buttonVariants({ size: 'lg' })}>
                Find a charger <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/register" className="inline-flex h-[52px] items-center rounded-xl border border-white/20 px-6 text-sm font-semibold text-white/80 transition hover:border-lime/40 hover:text-lime">
                Create free account
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-white/40">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-lime" /> Paystack-secured</span>
              <span className="flex items-center gap-1.5"><BatteryCharging className="h-3.5 w-3.5 text-lime" /> Live availability</span>
              <span className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5 text-lime" /> QR check-in</span>
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="mx-auto w-[320px] rounded-[36px] border border-white/15 bg-white/[0.06] p-2.5 shadow-float backdrop-blur-xl">
              <div className="rounded-[28px] bg-midnight-900 p-5">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-white/35">Reservation confirmed</p>
                  <span className="h-2 w-2 rounded-full bg-lime" />
                </div>
                <p className="mt-4 font-display text-lg font-semibold text-white">Lekki Supercharge</p>
                <p className="mt-1 text-[11px] text-white/40">Charger A2 · CCS2 · 120 kW</p>
                <div className="mt-5 rounded-2xl bg-white/[0.05] p-4">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/40">Date</span>
                    <span className="font-mono text-white/80">Today</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-white/40">Time</span>
                    <span className="font-mono text-white/80">18:30 – 19:30</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-white/40">Est. energy</span>
                    <span className="font-mono text-white/80">42.0 kWh</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                    <span className="text-[11px] text-white/40">Total paid</span>
                    <span className="font-mono text-base text-lime">₦9,440</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-center rounded-xl bg-lime py-2.5 text-[11px] font-bold text-midnight-900">
                  View booking QR
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-6 flex items-center gap-2 rounded-2xl border border-white/15 bg-midnight-900/90 px-3.5 py-2.5 backdrop-blur">
              <ShieldCheck className="h-4 w-4 text-lime" />
              <div>
                <p className="text-[10px] font-semibold text-white">Payment verified</p>
                <p className="font-mono text-[8.5px] text-white/35">Paystack · server-side</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-mint-50 py-20 lg:py-28">
        <div className="container-page">
          <Reveal>
            <SectionHeading
              eyebrow="The booking journey"
              title="Designed to remove every point of friction."
              description="Each step is backed by server-side checks so what you see is what you get at the charger."
              align="center"
            />
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <Reveal key={step.step} delay={index * 0.08}>
                <div className="flex h-full flex-col rounded-3xl border border-midnight-900/[0.07] bg-white p-6 shadow-card">
                  <div className="flex items-center justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-midnight-900 text-lime">
                      <step.icon className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-3xl font-medium text-midnight-900/10">{step.step}</span>
                  </div>
                  <h3 className="mt-6 font-display text-lg font-semibold text-midnight-900">{step.title}</h3>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-charcoal-500">{step.text}</p>
                  <p className="mt-auto pt-4 text-[10.5px] leading-relaxed text-muted">{step.detail}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20 lg:py-28">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="relative">
              <SmartImage src={IMAGES.interior} alt="Electric vehicle interior" className="aspect-[4/3] w-full rounded-3xl" imgClassName="object-cover" />
              <div className="absolute -bottom-5 -right-2 w-[230px] rounded-2xl border border-midnight-900/10 bg-white p-4 shadow-float sm:right-6">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime text-midnight-900"><CreditCard className="h-4 w-4" /></span>
                  <div>
                    <p className="text-[10px] font-semibold text-midnight-900">Payment receipt</p>
                    <p className="font-mono text-[8.5px] text-muted">EVN-PAY-82K1Q</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 border-t border-midnight-900/[0.06] pt-3 text-[10px]">
                  <p className="flex justify-between"><span className="text-muted">Charging</span><span className="font-mono">₦7,560</span></p>
                  <p className="flex justify-between"><span className="text-muted">Booking fee</span><span className="font-mono">₦500</span></p>
                  <p className="flex justify-between"><span className="text-muted">Service + VAT</span><span className="font-mono">₦415</span></p>
                  <p className="flex justify-between border-t border-midnight-900/[0.06] pt-1.5 font-semibold"><span>Total</span><span className="font-mono">₦8,475</span></p>
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <SectionHeading
              eyebrow="Pricing you can predict"
              title="Know the cost before you plug in."
              description="Every booking shows a full breakdown before payment. No hidden gate fees, no surprise markup at the station."
            />
            <div className="mt-7 space-y-3">
              {[
                { title: 'Charging fee', text: 'Energy delivered × the operator’s published per-kWh price.' },
                { title: 'Booking fee', text: 'Set per charger by the operator to secure your time slot.' },
                { title: 'Platform service fee', text: 'A flat fee that keeps verification, support and payments running.' },
                { title: 'VAT', text: 'Applied transparently to the platform service fee only.' },
              ].map((item, index) => (
                <div key={item.title} className="flex gap-3 rounded-2xl border border-midnight-900/[0.06] bg-mint-50 p-4">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-midnight-900 font-mono text-[10px] text-lime">{index + 1}</span>
                  <div>
                    <p className="text-[12.5px] font-semibold text-midnight-900">{item.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 flex items-center gap-2 text-[11px] text-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-lime-600" /> Free cancellation up to 2 hours before your session.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-mint-50 py-20 lg:py-28">
        <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionHeading eyebrow="Questions" title="Everything you might be wondering." />
            <p className="mt-4 text-sm leading-relaxed text-charcoal-500">
              Still unsure about something? Our support team can help with bookings, payments, refunds and station issues.
            </p>
            <Link to="/contact" className={buttonVariants({ variant: 'outline', className: 'mt-5' })}>
              Contact support <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-2.5">
            {FAQS.map((faq, index) => (
              <div key={faq.q} className={cn('overflow-hidden rounded-2xl border bg-white transition', openFaq === index ? 'border-lime-400/60 shadow-card' : 'border-midnight-900/[0.07]')}>
                <button
                  onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={openFaq === index}
                >
                  <span className="font-display text-[14px] font-semibold text-midnight-900">{faq.q}</span>
                  <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full border text-lg leading-none transition', openFaq === index ? 'rotate-45 border-lime bg-lime text-midnight-900' : 'border-midnight-900/10 text-muted')}>
                    +
                  </span>
                </button>
                {openFaq === index && (
                  <p className="border-t border-midnight-900/[0.06] px-5 py-4 text-[12.5px] leading-relaxed text-charcoal-500">{faq.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white pb-20">
        <div className="container-page">
          <div className="relative overflow-hidden rounded-[32px] bg-midnight-950 px-7 py-12 sm:px-12 lg:px-16">
            <div className="pointer-events-none absolute -right-20 -top-24 h-[340px] w-[340px] rounded-full bg-lime/10 blur-3xl" />
            <div className="relative flex flex-col items-start justify-between gap-7 lg:flex-row lg:items-center">
              <div>
                <Badge tone="lime">Ready when you are</Badge>
                <h2 className="mt-4 max-w-xl font-display text-3xl font-semibold leading-[1.05] tracking-[-0.035em] text-white sm:text-4xl">
                  Your next charge is a few taps away.
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/45">
                  Create a free account, save your vehicles and reserve your first charging slot today.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/stations" className={buttonVariants({ size: 'lg' })}>
                  Find a charger <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/register" className="inline-flex h-[52px] items-center rounded-xl border border-white/20 px-6 text-sm font-semibold text-white/80 transition hover:border-lime/40 hover:text-lime">
                  Create account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
