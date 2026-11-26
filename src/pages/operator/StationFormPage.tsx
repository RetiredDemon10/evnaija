import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  Camera,
  Check,
  Clock,
  ImagePlus,
  Info,
  MapPin,
  Navigation,
  Save,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { useOperatorData } from '@/hooks/useOperatorData'
import { createStation, updateStation, uploadStationImage } from '@/services/operator'
import { useToast } from '@/components/ui/Feedback'
import { PageHeader, SectionCard } from '@/components/ui/Data'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { InfoNote } from '@/components/dashboard/Kit'
import { SmartImage } from '@/components/common/SmartImage'
import { usePageTitle } from '@/hooks/usePageTitle'
import { AMENITIES, LAUNCH_LOCATIONS, NIGERIAN_STATES } from '@/lib/constants'
import { cn, formatDate } from '@/lib/utils'

const DEFAULT_FORM = {
  name: '',
  description: '',
  state: 'Lagos',
  city: 'Lagos',
  address: '',
  latitude: 6.4541,
  longitude: 3.3947,
  contact_phone: '',
  contact_email: '',
  operating_hours: '06:00 – 22:00',
  amenities: [] as string[],
  google_maps_url: '',
}

export default function StationFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { operatorId, stations, isLoading, profile } = useOperatorData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [cover, setCover] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  usePageTitle(editing ? 'Edit station' : 'Add a new station')

  const station = useMemo(() => stations.find((item) => item.id === id), [stations, id])
  const existingCover = station?.images?.find((image) => image.is_cover)?.image_url ?? station?.images?.[0]?.image_url ?? ''

  useEffect(() => {
    if (!station) return
    setForm({
      name: station.name,
      description: station.description ?? '',
      state: station.state,
      city: station.city,
      address: station.address,
      latitude: station.latitude,
      longitude: station.longitude,
      contact_phone: station.contact_phone ?? '',
      contact_email: station.contact_email ?? '',
      operating_hours: station.operating_hours,
      amenities: station.amenities ?? [],
      google_maps_url: station.google_maps_url ?? '',
    })
  }, [station])

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview)
    }
  }, [coverPreview])

  const pickCover = (file: File | undefined) => {
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image too large', 'Choose a photo smaller than 8 MB.')
      return
    }
    setCover(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const setCity = (city: string) => {
    const location = LAUNCH_LOCATIONS.find((item) => item.city === city)
    setForm((current) => ({
      ...current,
      city,
      state: location?.state ?? current.state,
      latitude: location?.latitude ?? current.latitude,
      longitude: location?.longitude ?? current.longitude,
    }))
  }

  const toggleAmenity = (amenity: string) => {
    setForm((current) => ({
      ...current,
      amenities: current.amenities.includes(amenity)
        ? current.amenities.filter((item) => item !== amenity)
        : [...current.amenities, amenity],
    }))
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (form.name.trim().length < 3) next.name = 'Enter the station name.'
    if (form.description.trim().length < 30) next.description = 'Add at least 30 characters so drivers know what to expect.'
    if (form.address.trim().length < 8) next.address = 'Enter the full street address.'
    if (!Number.isFinite(form.latitude) || form.latitude < 4 || form.latitude > 14) next.latitude = 'Enter a valid Nigerian latitude.'
    if (!Number.isFinite(form.longitude) || form.longitude < 2 || form.longitude > 15) next.longitude = 'Enter a valid Nigerian longitude.'
    if (form.contact_phone.trim().length < 7) next.contact_phone = 'Enter a reachable station phone number.'
    if (form.contact_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.contact_email)) next.contact_email = 'Enter a valid email address.'
    if (!form.operating_hours.trim()) next.operating_hours = 'Add your opening hours.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async () => {
    if (!operatorId) return
    if (!validate()) {
      toast.error('Check the highlighted fields', 'Some station details still need attention.')
      return
    }
    setSaving(true)
    try {
      const input = {
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        address: form.address.trim(),
        contact_phone: form.contact_phone.trim(),
        contact_email: form.contact_email.trim(),
        operating_hours: form.operating_hours.trim(),
        google_maps_url: form.google_maps_url.trim() || undefined,
      }
      if (editing && id) {
        await updateStation(id, input)
        if (cover) await uploadStationImage(id, cover, true)
        await queryClient.invalidateQueries({ queryKey: ['operator-stations', operatorId] })
        toast.success('Station updated', 'Changes are live. Major edits may be re-reviewed.')
      } else {
        await createStation(operatorId, input, cover)
        await queryClient.invalidateQueries({ queryKey: ['operator-stations', operatorId] })
        toast.success('Station submitted', 'We will review it within 2 business days. Add chargers now so it is ready to go live.')
      }
      navigate('/operator/stations')
    } catch (error) {
      toast.error('Could not save station', (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (editing && isLoading) {
    return <div className="grid min-h-[40vh] place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-lime border-t-midnight-900" /></div>
  }
  if (editing && !station) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
        <Building2 className="mx-auto h-8 w-8 text-amber-600" />
        <h1 className="mt-3 font-display text-xl font-semibold text-amber-900">Station not found</h1>
        <p className="mt-1 text-sm text-amber-700">It may belong to another operator, or it was removed.</p>
        <Link to="/operator/stations" className="mt-4 inline-flex h-10 items-center rounded-xl bg-midnight-900 px-4 text-[12px] font-semibold text-lime">Back to stations</Link>
      </div>
    )
  }

  const previewSrc = coverPreview || existingCover
  const cityOptions = LAUNCH_LOCATIONS.map((location) => location.city)

  return (
    <div className="space-y-6">
      <Link to="/operator/stations" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted hover:text-midnight-900">
        <ArrowLeft className="h-3.5 w-3.5" /> My stations
      </Link>

      <PageHeader
        eyebrow={editing ? 'Edit location' : 'New location'}
        title={editing ? station?.name ?? 'Edit station' : 'Add a charging station'}
        description={editing ? 'Keep location, contact and station details accurate. Drivers rely on them.' : 'Tell drivers exactly where to find you. You can add chargers immediately after saving.'}
        actions={
          <>
            {editing && <Link to={`/stations/${station?.slug}`} className="inline-flex h-10 items-center rounded-xl border border-midnight-900/10 px-4 text-[11px] font-semibold text-charcoal-600 hover:bg-mint-50">View public page</Link>}
            <Button loading={saving} onClick={submit}><Save className="h-4 w-4" /> {editing ? 'Save changes' : 'Submit station'}</Button>
          </>
        }
      />

      {!editing && profile?.status !== 'approved' && (
        <InfoNote title="Your operator account is still being verified" tone="warning">
          You can prepare this station now. It will stay in review and only accept bookings once your account and location
          are approved.
        </InfoNote>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <SectionCard title="Station basics" description="Public information shown to drivers.">
            <div className="grid gap-4">
              <Field label="Station name" required error={errors.name} hint="Use the name drivers will recognise on the street or in the estate.">
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Lekki Phase 1 Hub" />
              </Field>
              <Field label="Description" required error={errors.description} hint="Mention parking, access, nearby landmarks and what makes the station convenient.">
                <Textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="A six-bay fast charging hub inside the estate, with secure parking and a café…" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="State" required>
                  <Select value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })}>
                    {NIGERIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                  </Select>
                </Field>
                <Field label="City" required hint="Launch cities have verified map centres.">
                  <Select value={form.city} onChange={(event) => setCity(event.target.value)}>
                    {cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}
                  </Select>
                </Field>
              </div>
              <Field label="Street address" required error={errors.address}>
                <Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="12B Fola Osibo Street, Lekki Phase 1" />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Location coordinates" description="Pinpoint the exact entrance so drivers do not circle the block.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Latitude" required error={errors.latitude}>
                <Input type="number" step="0.000001" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: Number(event.target.value) })} />
              </Field>
              <Field label="Longitude" required error={errors.longitude}>
                <Input type="number" step="0.000001" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: Number(event.target.value) })} />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const location = LAUNCH_LOCATIONS.find((item) => item.city === form.city) ?? LAUNCH_LOCATIONS[0]
                  setForm({ ...form, latitude: location.latitude, longitude: location.longitude })
                  toast.info('Coordinates set to city centre', 'You can fine-tune the numbers to the exact entrance.')
                }}
              >
                <Navigation className="h-3.5 w-3.5" /> Use city centre
              </Button>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${form.latitude},${form.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-midnight-900/10 px-3 text-[11px] font-semibold text-charcoal-600 hover:bg-mint-50"
              >
                <MapPin className="h-3.5 w-3.5" /> Check on Google Maps
              </a>
            </div>
            <Field label="Google Maps directions URL (optional)" className="mt-4" hint="If left blank, we generate a directions link from your coordinates.">
              <Input value={form.google_maps_url} onChange={(event) => setForm({ ...form, google_maps_url: event.target.value })} placeholder="https://maps.google.com/…" />
            </Field>
            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-mint-50 px-4 py-3 text-[10.5px] leading-relaxed text-charcoal-600">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-600" />
              Tip: open Google Maps, long-press the exact station entrance and copy the two decimal coordinates. Accurate pins
              reduce driver support tickets.
            </div>
          </SectionCard>

          <SectionCard title="Contact & hours" description="Shown on the station page for drivers who need help.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Station phone" required error={errors.contact_phone}>
                <Input value={form.contact_phone} onChange={(event) => setForm({ ...form, contact_phone: event.target.value })} placeholder="+234 800 000 0000" />
              </Field>
              <Field label="Station email" error={errors.contact_email}>
                <Input type="email" value={form.contact_email} onChange={(event) => setForm({ ...form, contact_email: event.target.value })} placeholder="station@operator.ng" />
              </Field>
              <Field label="Operating hours" required error={errors.operating_hours} hint="Use the format 06:00 – 22:00. Use 24/7 only if staffed all day.">
                <Input value={form.operating_hours} onChange={(event) => setForm({ ...form, operating_hours: event.target.value })} placeholder="06:00 – 22:00" />
              </Field>
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-2 rounded-xl bg-mint-50 px-3 py-2.5 text-[10.5px] text-charcoal-600">
                  <Clock className="h-3.5 w-3.5 text-midnight-800" /> Booking slots are generated from these hours.
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Amenities" description="Select everything available on site.">
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map((amenity) => {
                const active = form.amenities.includes(amenity)
                return (
                  <button
                    key={amenity}
                    onClick={() => toggleAmenity(amenity)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-medium transition',
                      active ? 'border-lime-500 bg-lime/15 text-midnight-900' : 'border-midnight-900/10 bg-white text-charcoal-600 hover:border-lime-400',
                    )}
                  >
                    {active ? <Check className="h-3 w-3 text-lime-700" /> : <span className="h-3 w-3 rounded border border-charcoal-200" />}
                    {amenity}
                  </button>
                )
              })}
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <SectionCard title="Cover photo" description="The first thing drivers see in search.">
            <div className="relative overflow-hidden rounded-2xl border border-dashed border-midnight-900/15 bg-mint-50">
              {previewSrc ? (
                <>
                  <SmartImage src={previewSrc} alt="Station cover" className="aspect-[4/3] w-full" imgClassName="object-cover" />
                  <button
                    onClick={() => { setCover(null); setCoverPreview('') }}
                    className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-midnight-950/70 text-white backdrop-blur hover:bg-red-500"
                    aria-label="Remove selected photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <button onClick={() => fileRef.current?.click()} className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-midnight-800"><ImagePlus className="h-5 w-5" /></span>
                  <span className="text-[12px] font-semibold text-midnight-900">Upload a cover photo</span>
                  <span className="max-w-[200px] text-[10px] leading-relaxed text-muted">JPG or PNG, up to 8 MB. Show the chargers, parking and entrance.</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => pickCover(event.target.files?.[0])} />
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}>
                <Camera className="h-3.5 w-3.5" /> {previewSrc ? 'Replace photo' : 'Choose photo'}
              </Button>
            </div>
            <p className="mt-2 text-[9.5px] leading-relaxed text-muted">Use a real photo of the station. Stock or unrelated images are rejected during verification.</p>
          </SectionCard>

          <div className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-lime-600" />
              <p className="font-display text-base font-semibold text-midnight-900">Before you publish</p>
            </div>
            <ul className="mt-3 space-y-2.5">
              {[
                'Exact street address and entrance pin',
                'At least one charger with correct connector and price',
                'Working station phone number',
                'Real cover photo with good lighting',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[10.5px] leading-relaxed text-charcoal-600">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-lime-600" /> {item}
                </li>
              ))}
            </ul>
          </div>

          {editing && (
            <div className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Station record</p>
              <div className="mt-3 space-y-2 text-[11px]">
                <div className="flex items-center justify-between"><span className="text-muted">Status</span><span className="font-semibold capitalize text-midnight-900">{station?.status}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted">Created</span><span className="font-mono text-midnight-900">{station ? formatDate(station.created_at) : '—'}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted">Chargers</span><span className="font-mono text-midnight-900">{station?.chargers.length ?? 0}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted">Rating</span><span className="font-mono text-midnight-900">{station?.rating_average.toFixed(1)} ({station?.rating_count})</span></div>
              </div>
              <Link to={`/operator/chargers?station=${station?.id}`} className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-semibold text-lime-700 hover:underline"><Sparkles className="h-3 w-3" /> Manage chargers</Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
