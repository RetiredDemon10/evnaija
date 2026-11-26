import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Globe2, MapPin, Pencil, Plus, Search } from 'lucide-react'
import { listLocations, saveLocation, writeAuditLog } from '@/services/admin'
import type { Location } from '@/types'
import { PageHeader, DataTable, Tabs, type Column } from '@/components/ui/Data'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Field, Input } from '@/components/ui/Form'
import { ExportButton, TableEmpty } from '@/components/dashboard/Kit'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatNumber } from '@/lib/utils'

type Filter = 'all' | 'active' | 'inactive'

const EMPTY: { state: string; city: string; slug: string; latitude: string; longitude: string; is_active: boolean; hero_image_url: string } = {
  state: '',
  city: '',
  slug: '',
  latitude: '',
  longitude: '',
  is_active: true,
  hero_image_url: '',
}

export default function AdminLocationsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Location | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  usePageTitle('Locations')

  const { data: locations = [], isLoading } = useQuery({ queryKey: ['admin-locations'], queryFn: listLocations })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return locations.filter((location) => {
      const matchesFilter =
        filter === 'all' || (filter === 'active' && location.is_active) || (filter === 'inactive' && !location.is_active)
      const matchesSearch = !term || location.city.toLowerCase().includes(term) || location.state.toLowerCase().includes(term) || location.slug.includes(term)
      return matchesFilter && matchesSearch
    })
  }, [locations, filter, search])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setErrors({})
    setOpen(true)
  }

  const openEdit = (location: Location) => {
    setEditing(location)
    setForm({
      state: location.state,
      city: location.city,
      slug: location.slug,
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      is_active: location.is_active,
      hero_image_url: location.hero_image_url ?? '',
    })
    setErrors({})
    setOpen(true)
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (form.state.trim().length < 2) next.state = 'Enter the state name.'
    if (form.city.trim().length < 2) next.city = 'Enter the city name.'
    if (!/^[a-z0-9-]+$/.test(form.slug.trim())) next.slug = 'Use lowercase letters, numbers and dashes only.'
    if (!form.latitude || Number.isNaN(Number(form.latitude)) || Math.abs(Number(form.latitude)) > 90) next.latitude = 'Enter a valid latitude.'
    if (!form.longitude || Number.isNaN(Number(form.longitude)) || Math.abs(Number(form.longitude)) > 180) next.longitude = 'Enter a valid longitude.'
    if (form.hero_image_url && !/^https?:\/\//.test(form.hero_image_url)) next.hero_image_url = 'Use a full https:// image URL.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await saveLocation({
        ...(editing ? { id: editing.id } : {}),
        state: form.state.trim(),
        city: form.city.trim(),
        slug: form.slug.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        is_active: form.is_active,
        hero_image_url: form.hero_image_url.trim() || null,
      })
      if (user) {
        await writeAuditLog(user.id, editing ? 'location.updated' : 'location.created', 'location', editing?.id ?? null, {
          city: form.city.trim(),
          state: form.state.trim(),
          active: form.is_active,
        })
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-locations'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
      await queryClient.invalidateQueries({ queryKey: ['locations'] })
      toast.success(editing ? 'Location updated' : 'Location added', `${form.city.trim()}, ${form.state.trim()} is ready.`)
      setOpen(false)
    } catch (error) {
      toast.error('Could not save location', (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const columns: Column<Location>[] = [
    {
      key: 'city',
      header: 'City',
      render: (location) => (
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint text-midnight-800">
            <MapPin className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[12px] font-semibold text-midnight-900">{location.city}</p>
            <p className="text-[9.5px] text-muted">{location.state} State</p>
          </div>
        </div>
      ),
    },
    {
      key: 'slug',
      header: 'Slug',
      render: (location) => <span className="font-mono text-[10px] text-charcoal-500">/{location.slug}</span>,
    },
    {
      key: 'coords',
      header: 'Coordinates',
      render: (location) => (
        <span className="font-mono text-[10px] text-charcoal-600">
          {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
        </span>
      ),
    },
    {
      key: 'image',
      header: 'Hero image',
      render: (location) => (
        <span className="text-[10px] text-muted">{location.hero_image_url ? 'Configured' : 'Not set'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (location) => <Badge tone={location.is_active ? 'success' : 'neutral'}>{location.is_active ? 'Active' : 'Hidden'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (location) => (
        <div className="flex justify-end">
          <button
            onClick={() => openEdit(location)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-midnight-900/10 px-2.5 text-[10px] font-semibold text-charcoal-600 hover:bg-mint-50"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        </div>
      ),
    },
  ]

  if (isLoading) return <PageLoader label="Loading locations" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuration"
        title="Service locations"
        description="Cities where EV Naija is available. Inactive cities disappear from public search but keep existing stations and bookings."
        actions={
          <>
            <ExportButton
              filename="ev-naija-locations.csv"
              rows={filtered.map((location) => ({
                city: location.city,
                state: location.state,
                slug: location.slug,
                latitude: location.latitude,
                longitude: location.longitude,
                active: location.is_active ? 'Yes' : 'No',
              }))}
            />
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add location
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Live cities', value: locations.filter((location) => location.is_active).length, hint: 'Visible to drivers' },
          { label: 'Hidden cities', value: locations.filter((location) => !location.is_active).length, hint: 'Not accepting discovery' },
          { label: 'Total markets', value: locations.length, hint: 'Launch and expansion' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{stat.label}</p>
            <p className="mt-2 font-mono text-xl font-medium text-midnight-900">{formatNumber(stat.value)}</p>
            <p className="mt-0.5 text-[9.5px] text-muted">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'all', label: 'All', count: locations.length },
            { value: 'active', label: 'Active', count: locations.filter((location) => location.is_active).length },
            { value: 'inactive', label: 'Hidden', count: locations.filter((location) => !location.is_active).length },
          ]}
        />
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search city, state or slug"
            className="input-base h-9 pl-9 text-[11px]"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        minWidth={780}
        empty={<TableEmpty title="No locations in this view" description="Add a city to open EV Naija in a new market." action={<Button size="sm" onClick={openCreate}>Add location</Button>} />}
        mobileRender={(location) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[12px] font-semibold text-midnight-900">{location.city}</p>
                <p className="text-[9.5px] text-muted">{location.state} State · /{location.slug}</p>
              </div>
              <Badge tone={location.is_active ? 'success' : 'neutral'}>{location.is_active ? 'Active' : 'Hidden'}</Badge>
            </div>
            <button onClick={() => openEdit(location)} className="mt-2 text-[10.5px] font-semibold text-lime-700">
              Edit location
            </button>
          </div>
        )}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.city}` : 'Add service location'}
        description="City metadata powers discovery, SEO pages and map defaults."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={save}>
              {editing ? 'Save changes' : 'Add location'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="State" required error={errors.state}>
            <Input value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} placeholder="Lagos" />
          </Field>
          <Field label="City" required error={errors.city}>
            <Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="Lagos" />
          </Field>
          <Field label="URL slug" required error={errors.slug} hint="Used in /stations?city=slug">
            <Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase() })} placeholder="lagos" />
          </Field>
          <Field label="Hero image URL" error={errors.hero_image_url} hint="Optional city image for landing pages.">
            <Input value={form.hero_image_url} onChange={(event) => setForm({ ...form, hero_image_url: event.target.value })} placeholder="https://…" />
          </Field>
          <Field label="Latitude" required error={errors.latitude}>
            <Input value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} placeholder="6.4541" />
          </Field>
          <Field label="Longitude" required error={errors.longitude}>
            <Input value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} placeholder="3.3947" />
          </Field>
          <label className="flex items-center gap-2 text-[12px] text-charcoal-600 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
              className="h-4 w-4 rounded border-midnight-900/20 text-lime focus:ring-lime"
            />
            City is live and searchable
          </label>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-mint-50 px-3 py-2.5">
          <Globe2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-midnight-700" />
          <p className="text-[9.5px] leading-relaxed text-charcoal-600">
            Verify coordinates with Google Maps before saving. Station distance and map centring depend on this city pin.
          </p>
        </div>
      </Modal>
    </div>
  )
}
