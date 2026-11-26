import { ArrowRight, BadgeCheck, MapPin, ShieldCheck, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MechanicDiscovery } from '@/components/mechanics/MechanicDiscovery'
import { buttonVariants } from '@/components/ui/Button'
import { usePageTitle } from '@/hooks/usePageTitle'
import { IMAGES } from '@/lib/images'
import { SmartImage } from '@/components/common/SmartImage'

export default function MechanicsPage() {
  usePageTitle('Find EV mechanics')
  return (
    <div>
      <section className="relative overflow-hidden bg-midnight-950 pb-16 pt-32 lg:pt-36">
        <SmartImage
          src={IMAGES.evDetail}
          alt="Electric vehicle being serviced in a workshop"
          className="absolute inset-0 h-full w-full"
          imgClassName="object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-midnight-950 via-midnight-950/90 to-midnight-950/40" />
        <div className="pointer-events-none absolute inset-0 dotted-grid opacity-[0.05]" />
        <div className="container-page relative">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-lime/25 bg-lime/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-lime">
              <Wrench className="h-3 w-3" /> EV Naija service network
            </span>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl">
              Find a mechanic who really knows EVs.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/55">
              Battery diagnostics, motor repairs, charging port fixes and mobile callouts. Browse reviewed EV
              specialists across Nigeria and send a service request in minutes.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-white/45">
              <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-lime" /> Verified technicians</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-lime" /> Mobile &amp; workshop</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-lime" /> Admin-reviewed listings</span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-mint-50 py-10 lg:py-14">
        <div className="container-page">
          <MechanicDiscovery />
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="container-page">
          <div className="flex flex-col items-start justify-between gap-5 rounded-3xl bg-midnight-950 px-7 py-8 sm:flex-row sm:items-center sm:px-10">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime">EV technicians</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">Get discovered by EV owners.</h2>
              <p className="mt-1.5 max-w-lg text-sm text-white/45">
                Create a free listing, get verified by our team and start receiving service requests.
              </p>
            </div>
            <Link to="/register/mechanic" className={buttonVariants({ size: 'lg' })}>
              Register your workshop <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
