import { lazy, Suspense, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  BellRing,
  CalendarCheck,
  Check,
  Clock,
  LockKeyhole,
  MapPin,
  Navigation,
  Phone,
  PlugZap,
  ShieldCheck,
  Star,
  Tag,
  Zap,
} from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { fetchStation, fetchStationReviews } from '@/services/stations'
import { canViewStationMap } from '@/services/bookings'
import { cancelPriceAlert, createPriceAlert, findActiveAlert, listPriceAlerts } from '@/services/alerts'
import type { PriceAlertKind, Review, Station } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { Badge, Dot } from '@/components/ui/Badge'
import { Button, buttonVariants } from '@/components/ui/Button'
import { EmptyState, ErrorState, PageLoader, useToast } from '@/components/ui/Feedback'
import { SectionHeading, StarRating } from '@/components/ui/Brand'
const StationMap = lazy(() =>
  import('@/components/map/StationMap').then((module) => ({ default: module.StationMap })),
)
import { SmartImage } from '@/components/common/SmartImage'
import { StationCard } from '@/components/stations/StationCard'
import { useSeo } from '@/hooks/usePageTitle'
import { isPreviewMode } from '@/lib/env'
import { absoluteUrl, assetUrl } from '@/lib/seo'
import { connectorLabels, formatNaira, formatDate, humanize, speedLabels, speedRange } from '@/lib/utils'
import { cn } from '@/lib/utils'

function RatingBreakdown({ reviews }: { reviews: Review[] }) {
  const buckets = [5, 4, 3, 2, 1].map((value) => ({
    value,
    count: reviews.filter((review) => Math.round(review.overall_rating) === value).length,
  }))
  const max = Math.max(...buckets.map((bucket) => bucket.count), 1)
  return (
    <div className="space-y-2">
      {buckets.map((bucket) => (
        <div key={bucket.value} className="flex items-center gap-2.5">
          <span className="w-3 font-mono text-[10px] text-muted">{bucket.value}</span>
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-charcoal-100">
            <div className="h-full rounded-full bg-amber-400" style={{ width: `${(bucket.count / max) * 100}%` }} />
          </div>
          <span className="w-5 text-right font-mono text-[10px] text-muted">{bucket.count}</span>
        </div>
      ))}
    </div>
  )
}

function StationAlertsCard({ station }: { station: Station }) {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<PriceAlertKind | null>(null)

  const { data: alerts = [] } = useQuery({
    queryKey: ['price-alerts', user?.id],
    queryFn: () => listPriceAlerts(user!.id),
    enabled: Boolean(user?.id),
  })

  const activePrices = station.chargers.filter((charger) => charger.is_active).map((charger) => charger.price_per_kwh)
  const minPrice = activePrices.length ? Math.min(...activePrices) : 0
  const suggested = Math.max(1, Math.round(minPrice * 0.9))
  const priceAlert = findActiveAlert(alerts, station.id, null, 'price_drop')
  const availabilityAlert = findActiveAlert(alerts, station.id, null, 'availability')

  const toggle = async (kind: PriceAlertKind) => {
    if (!user) return
    setBusy(kind)
    try {
      const existing = kind === 'price_drop' ? priceAlert : availabilityAlert
      if (existing) {
        await cancelPriceAlert(existing.id)
        toast.info('Alert cancelled')
      } else {
        await createPriceAlert(user.id, {
          stationId: station.id,
          kind,
          targetPrice: kind === 'price_drop' ? suggested : null,
        })
        toast.success(
          'Alert saved',
          kind === 'price_drop'
            ? `We will notify you when the price drops below ${formatNaira(suggested)}/kWh.`
            : 'We will notify you as soon as a charger frees up.',
        )
      }
      await queryClient.invalidateQueries({ queryKey: ['price-alerts', user.id] })
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Alerts</p>
        <p className="mt-2 text-sm font-semibold text-midnight-900">Watch this station</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          Sign in to be told when the price drops or a charger frees up.
        </p>
        <Link to="/login" className={buttonVariants({ variant: 'outline', size: 'sm', className: 'mt-3 w-full' })}>
          <BellRing className="h-3.5 w-3.5" /> Sign in to set alerts
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Alerts</p>
      <p className="mt-2 text-sm font-semibold text-midnight-900">Watch this station</p>
      <div className="mt-3 space-y-2">
        <button
          type="button"
          onClick={() => toggle('price_drop')}
          disabled={busy !== null}
          className={cn(
            'flex w-full items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[11.5px] font-semibold transition disabled:opacity-60',
            priceAlert ? 'border-lime-400/60 bg-lime/15 text-midnight-900' : 'border-midnight-900/10 bg-white text-charcoal-700 hover:bg-charcoal-50',
          )}
        >
          <Tag className="h-3.5 w-3.5" />
          {priceAlert ? `Price alert on · below ${formatNaira(priceAlert.target_price ?? suggested)}` : 'Alert me on a price drop'}
        </button>
        <button
          type="button"
          onClick={() => toggle('availability')}
          disabled={busy !== null}
          className={cn(
            'flex w-full items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[11.5px] font-semibold transition disabled:opacity-60',
            availabilityAlert ? 'border-lime-400/60 bg-lime/15 text-midnight-900' : 'border-midnight-900/10 bg-white text-charcoal-700 hover:bg-charcoal-50',
          )}
        >
          <BellRing className="h-3.5 w-3.5" />
          {availabilityAlert ? 'Availability alert on' : 'Alert me when a charger frees up'}
        </button>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-muted">
        Delivered by email, SMS or WhatsApp based on your notification settings.
      </p>
    </div>
  )
}

export default function StationDetailPage() {
  const { slug = '' } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const inDashboard = location.pathname.startsWith('/app')
  const detailBase = inDashboard ? '/app/stations' : '/stations'
  // Signed-in drivers keep the dashboard flow; visitors reserve as guests.
  const bookingBase = user ? '/app/bookings/new' : '/book'
  const [activeImage, setActiveImage] = useState(0)
  const [reviewLimit, setReviewLimit] = useState(3)

  const { data: station, isLoading, error, refetch } = useQuery({
    queryKey: ['station', slug],
    queryFn: () => fetchStation(slug),
  })
  const stationId = station?.id ?? ''
  const { data: reviews = [] } = useQuery({
    queryKey: ['station-reviews', stationId],
    queryFn: () => fetchStationReviews(stationId) as Promise<Review[]>,
    enabled: Boolean(stationId),
  })

  // The map and directions are revealed only after a paid booking at this
  // station. Signed-in customers are checked via RLS, guests via their tokens.
  const { data: canViewMap = false } = useQuery({
    queryKey: ['station-map-access', stationId, user?.id],
    queryFn: () => canViewStationMap(stationId, user?.id),
    enabled: Boolean(stationId),
  })

  // Structured data is published only for real, approved listings. We omit the
  // street address and geo coordinates because the exact pin is intentionally
  // revealed only after a confirmed booking at this station.
  const stationSchema =
    station && station.status === 'approved' && !isPreviewMode
      ? {
          '@type': 'LocalBusiness',
          '@id': `${absoluteUrl(`/stations/${station.slug}`)}#station`,
          name: station.name,
          description:
            station.description ??
            `${station.name} is a verified EV charging location in ${station.city}, ${station.state}.`,
          url: absoluteUrl(`/stations/${station.slug}`),
          image: assetUrl(station.images[0]?.image_url),
          ...(station.contact_phone ? { telephone: station.contact_phone } : {}),
          address: {
            '@type': 'PostalAddress',
            addressLocality: station.city,
            addressRegion: station.state,
            addressCountry: 'NG',
          },
          ...(reviews.length > 0
            ? {
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue: (reviews.reduce((sum, review) => sum + review.overall_rating, 0) / reviews.length).toFixed(1),
                  reviewCount: reviews.length,
                  bestRating: '5',
                  worstRating: '1',
                },
              }
            : {}),
        }
      : null

  useSeo({
    title: station?.name ?? 'Station details',
    description: station
      ? `${station.name} in ${station.city}, ${station.state}. Compare connectors, prices and availability, then reserve a slot on EV Naija.`
      : undefined,
    image: station?.images[0]?.image_url ?? undefined,
    jsonLd: stationSchema ?? undefined,
  })

  if (isLoading) {
    return (
      <div className="container-page py-32">
        <PageLoader label="Loading station" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container-page py-32">
        <ErrorState description={(error as Error).message} onRetry={() => void refetch()} />
      </div>
    )
  }

  if (!station) {
    return (
      <div className="container-page py-32">
        <EmptyState
          icon={<MapPin className="h-6 w-6" />}
          title="Station not found"
          description="This station may have been removed or is not yet approved. Browse the live network to find another charger."
          action={
            <Link to={detailBase} className={buttonVariants({ variant: 'dark' })}>
              Browse stations
            </Link>
          }
        />
      </div>
    )
  }

  const images = station.images ?? []
  const cover = images[activeImage]?.image_url ?? images[0]?.image_url
  const connectors = Array.from(new Set(station.chargers.filter((charger) => charger.is_active).map((charger) => charger.connector_type)))
  const maxSpeed = station.chargers.reduce((acc, charger) => Math.max(acc, charger.capacity_kw), 0)
  const activePrices = station.chargers.filter((charger) => charger.is_active).map((charger) => charger.price_per_kwh)
  const minPrice = activePrices.length ? Math.min(...activePrices) : 0
  const available = station.available_chargers > 0
  const directions =
    station.google_maps_url ??
    `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`
  const reviewAverage = reviews.length
    ? reviews.reduce((acc, review) => acc + review.overall_rating, 0) / reviews.length
    : station.rating_average

  const similar = station ? [] as Station[] : []

  return (
    <div className="bg-mint-50 pb-20">
      <div className="container-page pt-24 lg:pt-28">
        <Link
          to={detailBase}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-midnight-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to {inDashboard ? 'station finder' : 'all stations'}
        </Link>

        {/* Header */}
        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {station.is_featured && <Badge tone="lime">Featured</Badge>}
              <Badge tone={station.status === 'approved' ? 'success' : 'warning'}>
                <BadgeCheck className="h-3 w-3" /> {humanize(station.status)}
              </Badge>
              <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className="font-mono font-medium text-charcoal-700">{reviewAverage.toFixed(1)}</span>
                <span>({reviews.length || station.rating_count} reviews)</span>
              </span>
            </div>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.035em] text-midnight-900 sm:text-[40px]">
              {station.name}
            </h1>
            <p className="mt-2 flex items-start gap-1.5 text-sm text-muted">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {station.address}, {station.city}, {station.state}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canViewMap && (
              <a
                href={directions}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: 'outline' })}
              >
                <Navigation className="h-4 w-4" /> Directions
              </a>
            )}
            <Link to={`${bookingBase}/${station.id}?charger=${station.chargers.find((c) => c.is_active)?.id ?? ''}`} className={buttonVariants({ size: 'md' })}>
              <CalendarCheck className="h-4 w-4" /> Book a charger
            </Link>
          </div>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          {/* Gallery */}
          <div>
            <div className="relative overflow-hidden rounded-3xl border border-midnight-900/10">
              <SmartImage src={cover} alt={station.name} className="aspect-[16/10] w-full" imgClassName="object-cover" />
              <div className="absolute left-4 top-4 flex items-center gap-2">
                <span className={cn('flex items-center gap-1.5 rounded-full border border-white/20 bg-midnight-950/60 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur', !available && 'text-red-200')}>
                  <Dot tone={available ? 'success' : 'danger'} />
                  {available ? `${station.available_chargers} chargers available` : 'All chargers busy'}
                </span>
              </div>
              <div className="absolute bottom-4 right-4 rounded-xl border border-white/20 bg-midnight-950/70 px-3 py-2 backdrop-blur">
                <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/45">From</p>
                <p className="font-mono text-base font-medium text-lime">
                  {formatNaira(minPrice)}<span className="text-[10px] font-normal text-white/40"> /kWh</span>
                </p>
              </div>
            </div>
            {images.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2.5">
                {images.slice(0, 4).map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => setActiveImage(index)}
                    className={cn(
                      'overflow-hidden rounded-xl border-2 transition',
                      activeImage === index ? 'border-lime' : 'border-transparent opacity-70 hover:opacity-100',
                    )}
                    aria-label={`View image ${index + 1}`}
                  >
                    <SmartImage src={image.image_url} alt={image.alt_text ?? station.name} className="aspect-[4/3] w-full" />
                  </button>
                ))}
              </div>
            )}

            <div className="mt-8 rounded-3xl border border-midnight-900/[0.07] bg-white p-6 shadow-card">
              <h2 className="font-display text-lg font-semibold text-midnight-900">About this station</h2>
              <p className="mt-3 text-sm leading-relaxed text-charcoal-600">
                {station.description ??
                  `${station.name} is a verified EV Naija charging location in ${station.city}. Book a slot in advance, arrive at your reserved time and scan your booking QR code at the charger.`}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Charging points', value: String(station.total_chargers), icon: PlugZap },
                  { label: 'Max power', value: `${maxSpeed} kW`, icon: Zap },
                  { label: 'Connectors', value: connectors.map((c) => connectorLabels[c]).join(', ') || '—', icon: ShieldCheck },
                  { label: 'Open', value: station.operating_hours, icon: Clock },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl bg-mint-50 p-3.5">
                    <item.icon className="h-4 w-4 text-midnight-700" />
                    <p className="mt-2 font-mono text-[13px] font-medium text-midnight-900">{item.value}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-muted">{item.label}</p>
                  </div>
                ))}
              </div>

              <h3 className="mt-7 font-display text-sm font-semibold text-midnight-900">Amenities</h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {station.amenities.map((amenity) => (
                  <span key={amenity} className="inline-flex items-center gap-1 rounded-lg bg-charcoal-50 px-2.5 py-1.5 text-[11px] font-medium text-charcoal-600">
                    <Check className="h-3 w-3 text-lime-600" /> {amenity}
                  </span>
                ))}
              </div>
            </div>

            {/* Chargers */}
            <div className="mt-6 rounded-3xl border border-midnight-900/[0.07] bg-white p-6 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-midnight-900">Available chargers</h2>
                  <p className="mt-0.5 text-xs text-muted">Live equipment status and per-kWh pricing.</p>
                </div>
                <Badge tone={available ? 'success' : 'warning'}>{station.available_chargers} free now</Badge>
              </div>
              <div className="mt-4 space-y-2.5">
                {station.chargers.map((charger) => {
                  const free = charger.status === 'available' && charger.is_active
                  return (
                    <div
                      key={charger.id}
                      className={cn(
                        'flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between',
                        free ? 'border-midnight-900/[0.07] bg-white' : 'border-charcoal-200 bg-charcoal-50/60',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className={cn('mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl', free ? 'bg-mint text-midnight-800' : 'bg-charcoal-100 text-charcoal-400')}>
                          <PlugZap className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-midnight-900">{charger.name}</p>
                          <p className="mt-0.5 text-[11px] text-muted">
                            {connectorLabels[charger.connector_type]} · {charger.capacity_kw} kW · {speedLabels[charger.speed_category]} ({speedRange[charger.speed_category]})
                          </p>
                          <p className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-semibold">
                            <Dot tone={free ? 'success' : charger.status === 'maintenance' ? 'danger' : 'warning'} />
                            <span className={free ? 'text-emerald-600' : 'text-charcoal-500'}>{humanize(charger.status)}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <div className="text-right">
                          <p className="font-mono text-sm font-medium text-midnight-900">
                            {formatNaira(charger.price_per_kwh)}<span className="text-[9px] font-normal text-muted">/kWh</span>
                          </p>
                          <p className="text-[9px] text-muted">+ {formatNaira(charger.booking_fee)} booking fee</p>
                        </div>
                        {free ? (
                          <Link
                            to={`${bookingBase}/${station.id}?charger=${charger.id}`}
                            className={buttonVariants({ variant: 'dark', size: 'sm' })}
                          >
                            Book <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        ) : (
                          <Button size="sm" variant="outline" disabled>
                            Unavailable
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Reviews */}
            <div className="mt-6 rounded-3xl border border-midnight-900/[0.07] bg-white p-6 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-midnight-900">Driver reviews</h2>
                  <p className="mt-0.5 text-xs text-muted">Only verified customers with completed sessions can review.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-3xl font-medium text-midnight-900">{reviewAverage.toFixed(1)}</span>
                  <div>
                    <StarRating value={reviewAverage} size={13} />
                    <p className="mt-1 text-[10px] text-muted">{reviews.length} verified reviews</p>
                  </div>
                </div>
              </div>
              {reviews.length > 0 ? (
                <>
                  <div className="mt-5 max-w-sm">
                    <RatingBreakdown reviews={reviews} />
                  </div>
                  <div className="mt-6 space-y-5 divide-y divide-midnight-900/[0.06]">
                    {reviews.slice(0, reviewLimit).map((review) => (
                      <div key={review.id} className="pt-5 first:pt-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-8 w-8 place-items-center rounded-full bg-mint text-[11px] font-bold text-midnight-800">
                              {(review.customer?.full_name ?? 'EV').slice(0, 1)}
                            </span>
                            <div>
                              <p className="text-xs font-semibold text-midnight-900">{review.customer?.full_name ?? 'Verified driver'}</p>
                              <p className="text-[10px] text-muted">{formatDate(review.created_at)}</p>
                            </div>
                          </div>
                          <StarRating value={review.overall_rating} size={12} />
                        </div>
                        {review.comment && <p className="mt-3 text-[13px] leading-relaxed text-charcoal-600">{review.comment}</p>}
                        {review.response && (
                          <div className="mt-3 rounded-xl border-l-2 border-lime bg-mint-50 px-3 py-2.5">
                            <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-midnight-600">Operator response</p>
                            <p className="mt-1 text-[12px] leading-relaxed text-charcoal-600">{review.response.response}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {reviews.length > reviewLimit && (
                    <Button variant="outline" size="sm" className="mt-5" onClick={() => setReviewLimit(reviews.length)}>
                      Show all {reviews.length} reviews
                    </Button>
                  )}
                </>
              ) : (
                <div className="mt-5 rounded-2xl bg-mint-50 p-6 text-center">
                  <p className="text-sm font-semibold text-midnight-900">No reviews yet</p>
                  <p className="mt-1 text-xs text-muted">Complete a charging session here to be the first to review it.</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Book this station</p>
              <p className="mt-2 font-display text-xl font-semibold text-midnight-900">
                {formatNaira(minPrice)}<span className="text-xs font-normal text-muted"> /kWh</span>
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                Your charger is held for 15 minutes while you pay. Free cancellation up to 2 hours before your session.
              </p>
              <Link
                to={`${bookingBase}/${station.id}?charger=${station.chargers.find((c) => c.is_active)?.id ?? ''}`}
                className={buttonVariants({ className: 'mt-4 w-full', size: 'md' })}
              >
                <CalendarCheck className="h-4 w-4" /> Reserve a slot
              </Link>
              <div className="mt-4 space-y-2 border-t border-midnight-900/[0.06] pt-4 text-[11px] text-charcoal-600">
                <p className="flex items-center justify-between"><span className="text-muted">Opening hours</span><span className="font-mono">{station.operating_hours}</span></p>
                <p className="flex items-center justify-between"><span className="text-muted">Charging points</span><span className="font-mono">{station.total_chargers}</span></p>
                <p className="flex items-center justify-between"><span className="text-muted">Connector types</span><span className="font-mono">{connectors.map((c) => connectorLabels[c]).join(', ') || '—'}</span></p>
                <p className="flex items-center justify-between"><span className="text-muted">Live availability</span><span className={cn('font-mono', available ? 'text-emerald-600' : 'text-red-500')}>{station.available_chargers} free</span></p>
              </div>
            </div>

            <StationAlertsCard station={station} />

            <div className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Operator</p>
              <p className="mt-2 text-sm font-semibold text-midnight-900">{station.operator?.business_name ?? 'Verified EV Naija operator'}</p>
              {station.operator?.business_description && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{station.operator.business_description}</p>
              )}
              <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" /> Identity and equipment verified
              </div>
              {station.contact_phone && (
                <a href={`tel:${station.contact_phone}`} className="mt-3 flex items-center gap-2 rounded-xl bg-mint-50 px-3 py-2.5 text-[11px] font-semibold text-midnight-900 hover:bg-mint">
                  <Phone className="h-3.5 w-3.5" /> {station.contact_phone}
                </a>
              )}
            </div>

            {canViewMap ? (
              <div className="overflow-hidden rounded-3xl border border-midnight-900/[0.07] bg-white shadow-card">
                <Suspense
                  fallback={
                    <div className="grid h-[230px] place-items-center bg-mint-50">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Loading map</span>
                    </div>
                  }
                >
                  <StationMap stations={[station]} height={230} interactive={false} className="rounded-none border-0" />
                </Suspense>
                <div className="p-4">
                  <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-charcoal-600">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" /> {station.address}
                  </p>
                  <a href={directions} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-lime-700 hover:underline">
                    Open in Google Maps <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Location</p>
                <p className="mt-2 text-sm font-semibold text-midnight-900">{station.city}, {station.state}</p>
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-mint-50 p-3">
                  <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                  <p className="text-[11px] leading-relaxed text-charcoal-600">
                    The exact pin, map and directions are shared once your booking at this station is paid and confirmed.
                  </p>
                </div>
                <Link to="/manage-booking" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-lime-700 hover:underline">
                  Already booked? Track it here <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            )}

            <div className="rounded-3xl bg-midnight-950 p-5 text-white">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-lime">Need help?</p>
              <p className="mt-2 text-sm font-semibold">Our team is one message away.</p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                Booking issue, charger fault or refund question — we respond within one business day.
              </p>
              <Link to="/contact" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-lime hover:underline">
                Contact support <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </aside>
        </div>

        {similar.length > 0 && (
          <section className="mt-14">
            <SectionHeading eyebrow="Keep exploring" title="Similar stations nearby." />
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((item, index) => (
                <StationCard key={item.id} station={item} index={index} detailBase={detailBase} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
