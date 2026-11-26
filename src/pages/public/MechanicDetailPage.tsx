import { lazy, Suspense, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Clock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  ShieldCheck,
  Star,
  Wrench,
} from 'lucide-react'
import type { MechanicServiceMode } from '@/types'
import { fetchMechanic, createMechanicRequest } from '@/services/mechanics'
import { MECHANIC_MODE_OPTIONS, serviceModeLabel, serviceTypeLabel } from '@/lib/mechanics'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { ErrorState, PageLoader, Skeleton, useToast } from '@/components/ui/Feedback'
import { SmartImage } from '@/components/common/SmartImage'
import { formatNaira } from '@/lib/utils'
import { useSeo } from '@/hooks/usePageTitle'
import { isPreviewMode } from '@/lib/env'
import { absoluteUrl, assetUrl } from '@/lib/seo'
import { useAuth } from '@/contexts/AuthContext'

const MechanicMap = lazy(() =>
  import('@/components/map/MechanicMap').then((module) => ({ default: module.MechanicMap })),
)

export default function MechanicDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const { success, error: toastError } = useToast()
  const { data: mechanic, isLoading, error, refetch } = useQuery({
    queryKey: ['mechanic', id],
    queryFn: () => fetchMechanic(id),
    enabled: Boolean(id),
    staleTime: 120_000,
  })

  // Only verified, approved production listings get entity structured data.
  // Preview fixtures never publish ratings or business schema.
  const mechanicSchema =
    mechanic && mechanic.status === 'approved' && mechanic.is_verified && !isPreviewMode
      ? {
          '@type': ['AutoRepair', 'LocalBusiness'],
          '@id': `${absoluteUrl(`/mechanics/${mechanic.id}`)}#mechanic`,
          name: mechanic.business_name,
          description:
            mechanic.description ??
            `${mechanic.business_name} provides EV diagnostics and repair services in ${mechanic.city}, ${mechanic.state}.`,
          url: absoluteUrl(`/mechanics/${mechanic.id}`),
          image: assetUrl(mechanic.logo_url),
          address: {
            '@type': 'PostalAddress',
            streetAddress: mechanic.address,
            addressLocality: mechanic.city,
            addressRegion: mechanic.state,
            addressCountry: 'NG',
          },
          geo: {
            '@type': 'GeoCoordinates',
            latitude: mechanic.latitude,
            longitude: mechanic.longitude,
          },
          areaServed: [mechanic.city, mechanic.state],
          ...(mechanic.hourly_rate ? { priceRange: formatNaira(mechanic.hourly_rate) } : {}),
          ...(mechanic.rating_count > 0 && mechanic.rating_average > 0
            ? {
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue: mechanic.rating_average.toFixed(1),
                  reviewCount: mechanic.rating_count,
                  bestRating: '5',
                  worstRating: '1',
                },
              }
            : {}),
        }
      : null

  useSeo({
    title: mechanic?.business_name ?? 'EV mechanic',
    description: mechanic
      ? `${mechanic.business_name} in ${mechanic.city}, ${mechanic.state}. Compare EV repair services, specialities and hours, then send a service request.`
      : undefined,
    image: mechanic?.logo_url ?? undefined,
    jsonLd: mechanicSchema ?? undefined,
  })

  const [reference, setReference] = useState<string | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
  const [form, setForm] = useState({
    name: user?.profile.full_name ?? '',
    email: user?.email ?? '',
    phone: user?.profile.phone ?? '',
    vehicleMake: '',
    vehicleModel: '',
    issueDescription: '',
    preferredDate: '',
    serviceMode: 'mobile' as MechanicServiceMode,
  })

  const requestMutation = useMutation({
    mutationFn: () =>
      createMechanicRequest({
        mechanicId: id,
        name: form.name,
        email: form.email,
        phone: form.phone,
        vehicleMake: form.vehicleMake,
        vehicleModel: form.vehicleModel,
        issueDescription: form.issueDescription,
        preferredDate: form.preferredDate ? new Date(form.preferredDate).toISOString() : null,
        serviceMode: form.serviceMode,
      }),
    onSuccess: (ref) => {
      setReference(ref)
      success('Service request sent', `Your reference is ${ref}. The mechanic will contact you directly.`)
    },
    onError: (err: Error) => toastError('Request could not be sent', err.message),
  })

  if (isLoading) return <PageLoader label="Loading mechanic" />
  if (error) {
    return (
      <div className="container-page py-16">
        <ErrorState title="Could not load this profile" description={(error as Error).message} onRetry={() => void refetch()} />
      </div>
    )
  }
  if (!mechanic) {
    return (
      <div className="container-page py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-midnight-950">Mechanic not found</h1>
        <p className="mt-2 text-sm text-muted">This listing may have been removed or is awaiting review.</p>
        <Link to="/mechanics" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand-700 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to all mechanics
        </Link>
      </div>
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    requestMutation.mutate()
  }

  return (
    <div className="bg-mint-50 pb-20 pt-28 lg:pt-32">
      <div className="container-page">
        <Link to="/mechanics" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-midnight-900">
          <ArrowLeft className="h-3.5 w-3.5" /> All EV mechanics
        </Link>

        <div className="mt-6 overflow-hidden rounded-3xl border border-midnight-900/10 bg-white">
          <div className="relative h-56 bg-midnight-900 sm:h-72">
            <SmartImage src={mechanic.logo_url} alt={mechanic.business_name} className="h-full w-full" imgClassName="object-cover opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-t from-midnight-950/85 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">{mechanic.business_name}</h1>
                  {mechanic.is_verified && (
                    <Badge tone="lime"><BadgeCheck className="h-3 w-3" /> Verified</Badge>
                  )}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-white/70">
                  <MapPin className="h-4 w-4" /> {mechanic.address}, {mechanic.city}
                </p>
              </div>
              <div className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-bold text-midnight-950">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {mechanic.rating_average.toFixed(1)}
                <span className="font-normal text-muted">({mechanic.rating_count} ratings)</span>
              </div>
            </div>
          </div>

          <div className="grid gap-8 p-6 lg:grid-cols-[1fr_360px] lg:p-8">
            <div>
              <div className="flex flex-wrap gap-2">
                {mechanic.emergency_available && <Badge tone="warning">Emergency callout</Badge>}
                {mechanic.service_modes.map((mode) => <Badge key={mode} tone="neutral">{serviceModeLabel(mode)}</Badge>)}
                <Badge tone="success"><ShieldCheck className="h-3 w-3" /> Admin reviewed</Badge>
              </div>

              <h2 className="mt-6 font-display text-lg font-semibold text-midnight-950">About this mechanic</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {mechanic.description ?? `${mechanic.business_name} provides EV diagnostics and repair services in ${mechanic.city}.`}
              </p>

              <div className="mt-7 grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
                    <Wrench className="h-3.5 w-3.5" /> Specialities
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {mechanic.service_types.map((type) => <Badge key={type} tone="neutral">{serviceTypeLabel(type)}</Badge>)}
                  </div>
                </div>
                <div>
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
                    <ShieldCheck className="h-3.5 w-3.5" /> Brands serviced
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {mechanic.brands_supported.length
                      ? mechanic.brands_supported.map((brand) => <Badge key={brand} tone="neutral">{brand}</Badge>)
                      : <span className="text-xs text-muted">Most EV makes</span>}
                  </div>
                </div>
              </div>

              <dl className="mt-7 grid gap-4 border-t border-midnight-900/5 pt-6 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">Experience</dt>
                  <dd className="mt-1 text-sm font-semibold text-midnight-950">{mechanic.years_experience} years</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Hourly rate</dt>
                  <dd className="mt-1 text-sm font-semibold text-midnight-950">
                    {mechanic.hourly_rate ? `${formatNaira(mechanic.hourly_rate)} / hour` : 'Quote on request'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Callout fee</dt>
                  <dd className="mt-1 text-sm font-semibold text-midnight-950">
                    {mechanic.callout_fee ? formatNaira(mechanic.callout_fee) : 'Not charged'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted flex items-center gap-1"><Clock className="h-3 w-3" /> Operating hours</dt>
                  <dd className="mt-1 text-sm font-semibold text-midnight-950">{mechanic.operating_hours}</dd>
                </div>
              </dl>

              {mechanic.certifications.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Certifications</h3>
                  <ul className="mt-2 space-y-1.5">
                    {mechanic.certifications.map((cert) => (
                      <li key={cert} className="flex items-center gap-2 text-sm text-midnight-900">
                        <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" /> {cert}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-8 h-64 overflow-hidden rounded-2xl border border-midnight-900/10">
                <Suspense fallback={<Skeleton className="h-full w-full" />}>
                  <MechanicMap mechanics={[mechanic]} height={256} interactive={false} />
                </Suspense>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-midnight-900/10 bg-mint-50 p-5">
                <h2 className="font-display text-base font-semibold text-midnight-950">Contact details</h2>
                <p className="mt-1 text-xs text-muted">Share these details with the mechanic before booking.</p>
                {!contactOpen ? (
                  <Button variant="dark" className="mt-4 w-full" onClick={() => setContactOpen(true)}>
                    <Phone className="h-4 w-4" /> Show phone number
                  </Button>
                ) : (
                  <div className="mt-4 space-y-2">
                    <a href={`tel:${mechanic.phone}`} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-midnight-950 shadow-sm">
                      <Phone className="h-4 w-4 text-brand-700" /> {mechanic.phone}
                    </a>
                    {mechanic.whatsapp && (
                      <a href={`https://wa.me/${mechanic.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-midnight-950 shadow-sm">
                        <MessageSquare className="h-4 w-4 text-emerald-600" /> Chat on WhatsApp
                      </a>
                    )}
                    <a href={`mailto:${mechanic.email}`} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-midnight-950 shadow-sm">
                      <Mail className="h-4 w-4 text-brand-700" /> {mechanic.email}
                    </a>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-midnight-900/10 bg-white p-5">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-brand-700" />
                  <h2 className="font-display text-base font-semibold text-midnight-950">Request service</h2>
                </div>
                <p className="mt-1 text-xs text-muted">No payment needed. The mechanic follows up directly.</p>

                {reference ? (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Request sent</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-midnight-950">{reference}</p>
                    <p className="mt-2 text-xs leading-relaxed text-emerald-800">
                      {mechanic.business_name} has your details and will contact you to confirm timing and cost. Keep this
                      reference for your records — no charge has been made.
                    </p>
                    <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setReference(null)}>
                      Send another request
                    </Button>
                  </div>
                ) : (
                  <form className="mt-4 space-y-3" onSubmit={submit}>
                    <Field label="Your name" required>
                      <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Email" required>
                        <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
                      </Field>
                      <Field label="Phone" required>
                        <Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+234..." />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Vehicle make" required>
                        <Input required value={form.vehicleMake} onChange={(e) => setForm({ ...form, vehicleMake: e.target.value })} placeholder="e.g. BYD" />
                      </Field>
                      <Field label="Model" required>
                        <Input required value={form.vehicleModel} onChange={(e) => setForm({ ...form, vehicleModel: e.target.value })} placeholder="e.g. Atto 3" />
                      </Field>
                    </div>
                    <Field label="What's wrong?" required>
                      <Textarea
                        required
                        rows={3}
                        minLength={10}
                        value={form.issueDescription}
                        onChange={(e) => setForm({ ...form, issueDescription: e.target.value })}
                        placeholder="Describe the fault, warning lights, and when it started"
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Service type">
                        <Select value={form.serviceMode} onChange={(e) => setForm({ ...form, serviceMode: e.target.value as MechanicServiceMode })}>
                          {MECHANIC_MODE_OPTIONS.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
                        </Select>
                      </Field>
                      <Field label="Preferred date">
                        <Input type="date" value={form.preferredDate} onChange={(e) => setForm({ ...form, preferredDate: e.target.value })} />
                      </Field>
                    </div>
                    <Button type="submit" className="w-full" loading={requestMutation.isPending}>
                      <Send className="h-4 w-4" /> Send request
                    </Button>
                    <p className="text-center text-[10px] leading-relaxed text-muted">
                      By sending you agree that EV Naija can share these details with this mechanic.
                    </p>
                  </form>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
