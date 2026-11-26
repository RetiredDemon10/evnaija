import { useState, type FormEvent, type ReactNode } from 'react'
import { BadgeCheck, MapPin, Save, Wrench } from 'lucide-react'
import type { Mechanic, MechanicServiceMode, MechanicServiceType } from '@/types'
import {
  MECHANIC_BRANDS,
  MECHANIC_MODE_OPTIONS,
  MECHANIC_SERVICE_TYPES,
} from '@/lib/mechanics'
import { citiesForState, NIGERIA_STATE_NAMES } from '@/lib/nigeria'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { MechanicRegistrationInput } from '@/services/mechanics'

const emptyInput: MechanicRegistrationInput = {
  businessName: '',
  ownerName: '',
  email: '',
  phone: '',
  whatsapp: '',
  state: 'Lagos',
  city: 'Lagos',
  address: '',
  latitude: 6.5244,
  longitude: 3.3792,
  serviceModes: ['mobile'],
  serviceTypes: [],
  brandsSupported: [],
  yearsExperience: 0,
  certifications: [],
  description: '',
  emergencyAvailable: false,
  hourlyRate: null,
  calloutFee: null,
  operatingHours: '08:00 – 18:00',
  logoUrl: '',
}

function toInput(mechanic?: Mechanic | null): MechanicRegistrationInput {
  if (!mechanic) return { ...emptyInput }
  return {
    businessName: mechanic.business_name,
    ownerName: mechanic.owner_name,
    email: mechanic.email,
    phone: mechanic.phone,
    whatsapp: mechanic.whatsapp ?? '',
    state: mechanic.state,
    city: mechanic.city,
    address: mechanic.address,
    latitude: mechanic.latitude,
    longitude: mechanic.longitude,
    serviceModes: mechanic.service_modes,
    serviceTypes: mechanic.service_types,
    brandsSupported: mechanic.brands_supported,
    yearsExperience: mechanic.years_experience,
    certifications: mechanic.certifications,
    description: mechanic.description ?? '',
    emergencyAvailable: mechanic.emergency_available,
    hourlyRate: mechanic.hourly_rate,
    calloutFee: mechanic.callout_fee,
    operatingHours: mechanic.operating_hours,
    logoUrl: mechanic.logo_url ?? '',
  }
}

export function MechanicForm({
  mechanic,
  onSubmit,
  submitting,
  submitLabel = 'Submit listing',
  showAccountFields = false,
  children,
}: {
  mechanic?: Mechanic | null
  onSubmit: (input: MechanicRegistrationInput) => void
  submitting?: boolean
  submitLabel?: string
  showAccountFields?: boolean
  children?: ReactNode
}) {
  const [form, setForm] = useState<MechanicRegistrationInput>(() => toInput(mechanic))
  const [certText, setCertText] = useState((mechanic?.certifications ?? []).join(', '))
  const cities = citiesForState(form.state)

  const toggleMode = (mode: MechanicServiceMode) =>
    setForm((current) => ({
      ...current,
      serviceModes: current.serviceModes.includes(mode)
        ? current.serviceModes.filter((item) => item !== mode)
        : [...current.serviceModes, mode],
    }))

  const toggleType = (type: MechanicServiceType) =>
    setForm((current) => ({
      ...current,
      serviceTypes: current.serviceTypes.includes(type)
        ? current.serviceTypes.filter((item) => item !== type)
        : [...current.serviceTypes, type],
    }))

  const toggleBrand = (brand: string) =>
    setForm((current) => ({
      ...current,
      brandsSupported: current.brandsSupported.includes(brand)
        ? current.brandsSupported.filter((item) => item !== brand)
        : [...current.brandsSupported, brand],
    }))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      ...form,
      certifications: certText.split(',').map((item) => item.trim()).filter(Boolean),
    })
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-2xl border border-midnight-900/10 bg-white p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-midnight-950">
          <Wrench className="h-4 w-4 text-brand-700" /> Business details
        </h2>
        <p className="mt-1 text-xs text-muted">This is what EV owners will see in the directory.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Business / workshop name" required>
            <Input required value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="VoltFix EV Clinic" />
          </Field>
          <Field label="Owner / lead technician" required>
            <Input required value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} placeholder="Your full name" />
          </Field>
          <Field label="Public email" required>
            <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@workshop.ng" />
          </Field>
          <Field label="Phone number" required>
            <Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+234 800 000 0000" />
          </Field>
          <Field label="WhatsApp (optional)">
            <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+234 800 000 0000" />
          </Field>
          <Field label="Logo / cover image URL" hint="A square image works best.">
            <Input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://..." />
          </Field>
          <Field label="About your workshop" className="sm:col-span-2">
            <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What EVs do you work on? What makes you different?" />
          </Field>
        </div>
      </section>

      {showAccountFields && (
        <section className="rounded-2xl border border-lime/30 bg-lime/[0.06] p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-midnight-950">
            <BadgeCheck className="h-4 w-4 text-brand-700" /> Account
          </h2>
          <p className="mt-1 text-xs text-muted">
            Your listing is created against this account. A password is required when registering a new account; leave blank
            if you are already signed in.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-midnight-900/10 bg-white p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-midnight-950">
          <MapPin className="h-4 w-4 text-brand-700" /> Location
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="State" required>
            <Select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value, city: 'all' })}>
              {NIGERIA_STATE_NAMES.map((state) => <option key={state} value={state}>{state}</option>)}
            </Select>
          </Field>
          <Field label="City" required>
            <Select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
              <option value="all">Select city</option>
              {cities.map((city) => <option key={city} value={city}>{city}</option>)}
            </Select>
          </Field>
          <Field label="Years of experience" required>
            <Input required type="number" min={0} max={60} value={form.yearsExperience} onChange={(e) => setForm({ ...form, yearsExperience: Number(e.target.value) })} />
          </Field>
          <Field label="Street address" required className="sm:col-span-2">
            <Input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Workshop address or service area" />
          </Field>
          <Field label="Operating hours">
            <Input value={form.operatingHours} onChange={(e) => setForm({ ...form, operatingHours: e.target.value })} placeholder="08:00 – 18:00 · Mon–Sat" />
          </Field>
          <Field label="Latitude" hint="Used to place you on the public map.">
            <Input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })} />
          </Field>
          <Field label="Longitude">
            <Input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-midnight-900/10 bg-white p-5">
        <h2 className="font-display text-base font-semibold text-midnight-950">Services &amp; pricing</h2>
        <div className="mt-4">
          <p className="label-base">Service modes <span className="text-red-500">*</span></p>
          <div className="flex flex-wrap gap-2">
            {MECHANIC_MODE_OPTIONS.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => toggleMode(mode.value)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                  form.serviceModes.includes(mode.value)
                    ? 'border-midnight-900 bg-midnight-900 text-lime'
                    : 'border-midnight-900/15 text-muted hover:border-midnight-900/40',
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5">
          <p className="label-base">Specialities <span className="text-red-500">*</span></p>
          <div className="flex flex-wrap gap-2">
            {MECHANIC_SERVICE_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => toggleType(type.value)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                  form.serviceTypes.includes(type.value)
                    ? 'border-midnight-900 bg-midnight-900 text-lime'
                    : 'border-midnight-900/15 text-muted hover:border-midnight-900/40',
                )}
              >
                {type.label}
              </button>
            ))}
          </div>
          {form.serviceTypes.length === 0 && <p className="mt-2 text-xs text-red-500">Choose at least one speciality.</p>}
        </div>
        <div className="mt-5">
          <p className="label-base">Brands you service</p>
          <div className="flex flex-wrap gap-2">
            {MECHANIC_BRANDS.map((brand) => (
              <button
                key={brand}
                type="button"
                onClick={() => toggleBrand(brand)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                  form.brandsSupported.includes(brand)
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-midnight-900/15 text-muted hover:border-midnight-900/40',
                )}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Hourly rate (₦)" hint="Leave blank to show 'quote on request'.">
            <Input type="number" min={0} value={form.hourlyRate ?? ''} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Callout fee (₦)">
            <Input type="number" min={0} value={form.calloutFee ?? ''} onChange={(e) => setForm({ ...form, calloutFee: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Certifications" hint="Comma separated, e.g. HV Safety Level 2, Manufacturer trained" className="sm:col-span-2">
            <Input value={certText} onChange={(e) => setCertText(e.target.value)} />
          </Field>
        </div>
        <label className="mt-5 flex items-center gap-2 text-sm font-semibold text-midnight-900">
          <input
            type="checkbox"
            checked={form.emergencyAvailable}
            onChange={(e) => setForm({ ...form, emergencyAvailable: e.target.checked })}
            className="h-4 w-4 rounded border-midnight-900/20 accent-brand-600"
          />
          I offer emergency / callout service
        </label>
      </section>

      {children}

      <Button type="submit" size="lg" loading={submitting} disabled={!form.serviceModes.length || !form.serviceTypes.length}>
        <Save className="h-4 w-4" /> {submitLabel}
      </Button>
    </form>
  )
}
