import { ArrowLeft, Compass, Home, MapPin, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, buttonVariants } from '@/components/ui/Button'
import { usePageTitle } from '@/hooks/usePageTitle'
import { IMAGES } from '@/lib/images'
import { SmartImage } from '@/components/common/SmartImage'

export default function NotFoundPage() {
  usePageTitle('Page not found')
  return (
    <div className="relative flex min-h-screen items-center overflow-hidden bg-midnight-950 pb-20 pt-32">
      <SmartImage
        src={IMAGES.motorway}
        alt="Open road at dusk"
        className="absolute inset-0 h-full w-full"
        imgClassName="object-cover opacity-25"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-midnight-950 via-midnight-950/95 to-midnight-950/60" />
      <div className="pointer-events-none absolute inset-0 dotted-grid opacity-[0.07]" />
      <div className="container-page relative">
        <div className="max-w-xl">
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-lime">Error 404</p>
          <h1 className="mt-4 font-display text-6xl font-semibold leading-none tracking-[-0.05em] text-white sm:text-8xl">
            Wrong turn.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/50">
            The page you are looking for has moved, been removed, or never existed. Let us get you back to a working
            charger.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/" className={buttonVariants({ size: 'lg' })}>
              <Home className="h-4 w-4" /> Back home
            </Link>
            <Link
              to="/stations"
              className="inline-flex h-[52px] items-center gap-2 rounded-xl border border-white/20 px-6 text-sm font-semibold text-white/80 transition hover:border-lime/40 hover:text-lime"
            >
              <MapPin className="h-4 w-4" /> Find a station
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-[11px] text-white/35">
            <Link to="/how-it-works" className="transition hover:text-lime">How it works</Link>
            <Link to="/for-operators" className="transition hover:text-lime">For station owners</Link>
            <Link to="/contact" className="transition hover:text-lime">Contact support</Link>
            <Link to="/legal/terms" className="transition hover:text-lime">Terms</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
