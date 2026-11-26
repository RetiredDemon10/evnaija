import { ArrowRight, MapPin, ShieldCheck, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StationDiscovery } from '@/components/stations/StationDiscovery'
import { buttonVariants } from '@/components/ui/Button'
import { usePageTitle } from '@/hooks/usePageTitle'
import { IMAGES } from '@/lib/images'
import { SmartImage } from '@/components/common/SmartImage'

export default function StationsPage() {
  usePageTitle('Find charging stations')
  return (
    <div>
      <section className="relative overflow-hidden bg-midnight-950 pb-16 pt-32 lg:pt-36">
        <SmartImage
          src={IMAGES.stationNight}
          alt="EV charging station at night"
          className="absolute inset-0 h-full w-full"
          imgClassName="object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-midnight-950 via-midnight-950/90 to-midnight-950/40" />
        <div className="pointer-events-none absolute inset-0 dotted-grid opacity-[0.05]" />
        <div className="container-page relative">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-lime/25 bg-lime/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-lime">
              <Zap className="h-3 w-3" /> The EV Naija network
            </span>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl">
              Find a charger that fits your journey.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/55">
              Verified stations across Lagos, Abuja and Port Harcourt. Filter by connector, charging speed and live
              availability, then reserve your slot in under a minute.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-white/45">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-lime" /> Verified operators</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-lime" /> Mapped &amp; reviewed</span>
              <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-lime" /> Live availability</span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-mint-50 py-10 lg:py-14">
        <div className="container-page">
          <StationDiscovery detailBase="/stations" />
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="container-page">
          <div className="flex flex-col items-start justify-between gap-5 rounded-3xl bg-midnight-950 px-7 py-8 sm:flex-row sm:items-center sm:px-10">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime">Own charging infrastructure?</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">Put your station on the map.</h2>
              <p className="mt-1.5 max-w-lg text-sm text-white/45">
                Join verified operators earning from drivers who are ready to pay.
              </p>
            </div>
            <Link to="/for-operators" className={buttonVariants({ size: 'lg' })}>
              Become a partner <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
