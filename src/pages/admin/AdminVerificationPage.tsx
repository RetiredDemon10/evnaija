import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  ImageIcon,
  MapPin,
  PlugZap,
  Search,
  ShieldCheck,
  Star,
  XCircle,
} from 'lucide-react'
import { listAllStations, listOperators, setStationStatusAdmin, writeAuditLog } from '@/services/admin'
import type { Station } from '@/types'
import { PageHeader, SectionCard, Tabs } from '@/components/ui/Data'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Field, Textarea } from '@/components/ui/Form'
import { SelectFilter, TableEmpty } from '@/components/dashboard/Kit'
import { SmartImage } from '@/components/common/SmartImage'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { connectorLabels, formatDate, formatNaira } from '@/lib/utils'

type Tab = 'pending' | 'approved' | 'rejected' | 'suspended'

export default function AdminVerificationPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('pending')
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('all')
  const [detail, setDetail] = useState<Station | null>(null)
  const [decision, setDecision] = useState<{ station: Station; type: 'approved' | 'rejected' } | null>(null)
  const [reason, setReason] = useState('')
  const [feature, setFeature] = useState(false)
  const [working, setWorking] = useState(false)
  usePageTitle('Station verification')

  const { data: stations = [], isLoading } = useQuery({ queryKey: ['admin-stations'], queryFn: listAllStations })
  const { data: operators = [] } = useQuery({ queryKey: ['admin-operators'], queryFn: listOperators })

  const cities = useMemo(() => Array.from(new Set(stations.map((station) => station.city))), [stations])
  const counts = useMemo(() => ({
    pending: stations.filter((station) => station.status === 'pending').length,
    approved: stations.filter((station) => station.status === 'approved').length,
    rejected: stations.filter((station) => station.status === 'rejected').length,
    suspended: stations.filter((station) => station.status === 'suspended').length,
  }), [stations])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return stations.filter((station) => {
      const matchesTab = station.status === tab
      const matchesCity = city === 'all' || station.city === city
      const matchesSearch = !term || station.name.toLowerCase().includes(term) || station.address.toLowerCase().includes(term) || (station.operator?.business_name ?? '').toLowerCase().includes(term)
      return matchesTab && matchesCity && matchesSearch
    })
  }, [stations, tab, city, search])

  const operatorFor = (station: Station) => operators.find((operator) => operator.id === station.operator_id)

  const openDecision = (station: Station, type: 'approved' | 'rejected') => {
    setDecision({ station, type })
    setReason('')
    setFeature(station.is_featured)
  }

  const submit = async () => {
    if (!decision) return
    if (decision.type === 'rejected' && reason.trim().length < 8) {
      toast.error('Add a rejection reason', 'Operators need clear correction instructions.')
      return
    }
    setWorking(true)
    try {
      await setStationStatusAdmin(decision.station.id, decision.type, decision.type === 'approved' ? feature : undefined)
      if (user) {
        await writeAuditLog(user.id, `station.${decision.type}`, 'station', decision.station.id, {
          name: decision.station.name,
          city: decision.station.city,
          featured: decision.type === 'approved' ? feature : undefined,
          reason: reason.trim() || undefined,
        })
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-stations'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
      toast.success(
        decision.type === 'approved' ? 'Station approved' : 'Station rejected',
        decision.type === 'approved' ? 'It is now live in search and can accept bookings.' : 'The operator has been notified with your reason.',
      )
      setDecision(null)
      setDetail(null)
    } catch (error) {
      toast.error('Could not update station', (error as Error).message)
    } finally {
      setWorking(false)
    }
  }

  if (isLoading) return <PageLoader label="Loading verification queue" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trust & safety"
        title="Station verification"
        description="Verify that locations are real, safe and correctly described before they accept paid bookings."
        actions={<Link to="/admin/operators?status=pending" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-midnight-900/10 px-4 text-[11px] font-semibold text-charcoal-600 hover:bg-mint-50"><Building2 className="h-4 w-4" /> Operator queue</Link>}
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Awaiting review', value: counts.pending, tone: 'text-amber-700' },
          { label: 'Live stations', value: counts.approved, tone: 'text-emerald-700' },
          { label: 'Rejected', value: counts.rejected, tone: 'text-red-500' },
          { label: 'Suspended', value: counts.suspended, tone: 'text-red-500' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{stat.label}</p>
            <p className={`mt-2 font-mono text-xl font-medium ${stat.tone}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'pending', label: 'Pending', count: counts.pending },
            { value: 'approved', label: 'Approved', count: counts.approved },
            { value: 'rejected', label: 'Rejected', count: counts.rejected },
            { value: 'suspended', label: 'Suspended', count: counts.suspended },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search station, address or operator" className="input-base h-9 pl-9 text-[11px]" />
          </div>
          <SelectFilter value={city} onChange={setCity} options={[{ value: 'all', label: 'All cities' }, ...cities.map((value) => ({ value, label: value }))]} />
        </div>
      </div>

      {filtered.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((station) => {
            const operator = operatorFor(station)
            const cover = station.images?.find((image) => image.is_cover)?.image_url ?? station.images?.[0]?.image_url
            const ready = Boolean(cover) && (station.images?.length ?? 0) > 0 && (station.chargers?.length ?? 0) > 0
            return (
              <article key={station.id} className="overflow-hidden rounded-3xl border border-midnight-900/[0.07] bg-white shadow-card">
                <div className="relative h-36">
                  <SmartImage src={cover} alt={station.name} className="absolute inset-0 h-full w-full" imgClassName="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-midnight-950/80 via-midnight-950/20 to-transparent" />
                  <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-2">
                    <div>
                      <p className="font-display text-base font-semibold text-white">{station.name}</p>
                      <p className="flex items-center gap-1 text-[10px] text-white/65"><MapPin className="h-3 w-3" /> {station.address}, {station.city}</p>
                    </div>
                    <Badge tone={tab === 'approved' ? 'success' : tab === 'pending' ? 'warning' : 'danger'}>{station.status}</Badge>
                  </div>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Photos', value: station.images?.length ?? 0 },
                      { label: 'Chargers', value: station.chargers?.length ?? 0 },
                      { label: 'Points', value: station.chargers?.reduce((sum, charger) => sum + charger.connector_count, 0) ?? 0 },
                      { label: 'Rating', value: station.rating_average.toFixed(1) },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl bg-mint-50 px-2 py-2 text-center">
                        <p className="font-mono text-[12px] font-medium text-midnight-900">{item.value}</p>
                        <p className="text-[8px] uppercase tracking-[0.1em] text-muted">{item.label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2.5 text-[10px] text-muted">Operator: {operator?.business_name ?? 'Unknown'} · Applied {formatDate(station.created_at)}</p>
                  {!ready && tab === 'pending' && (
                    <div className="mt-2.5 flex items-start gap-1.5 rounded-xl bg-amber-50 px-2.5 py-2 text-[9.5px] text-amber-800">
                      <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" /> Missing a real cover photo or chargers. Request corrections before approval.
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-1.5 border-t border-midnight-900/[0.06] pt-3">
                    <Button size="sm" variant="outline" onClick={() => setDetail(station)}>Inspect</Button>
                    {station.status === 'pending' && (
                      <>
                        <Button size="sm" onClick={() => openDecision(station, 'approved')}><CheckCircle2 className="h-3.5 w-3.5" /> Approve</Button>
                        <Button size="sm" variant="danger" onClick={() => openDecision(station, 'rejected')}><XCircle className="h-3.5 w-3.5" /> Reject</Button>
                      </>
                    )}
                    {station.status === 'approved' && (
                      <Button size="sm" variant="danger" onClick={() => openDecision(station, 'rejected')}>Suspend</Button>
                    )}
                    {(station.status === 'rejected' || station.status === 'suspended') && (
                      <Button size="sm" onClick={() => openDecision(station, 'approved')}>Approve</Button>
                    )}
                    <span className="ml-auto font-mono text-[9px] text-muted">{station.slug}</span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <TableEmpty
          title={tab === 'pending' ? 'Verification queue is clear' : `No ${tab} stations`}
          description={tab === 'pending' ? 'New station submissions will appear here for inspection.' : 'Try another tab or clear your filters.'}
        />
      )}

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name ?? 'Station'}
        description={detail ? `${detail.address}, ${detail.city}, ${detail.state}` : undefined}
        footer={detail ? (
          <>
            <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
            {detail.status !== 'approved' && <Button onClick={() => openDecision(detail, 'approved')}><Check className="h-4 w-4" /> Approve</Button>}
            {detail.status !== 'rejected' && detail.status !== 'suspended' && <Button variant="danger" onClick={() => openDecision(detail, 'rejected')}>Reject</Button>}
          </>
        ) : undefined}
      >
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(detail.images?.length ? detail.images : [{ id: 'none', image_url: '', alt_text: 'No photos' }]).slice(0, 6).map((image) => (
                <div key={image.id} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-charcoal-50">
                  {image.image_url ? <SmartImage src={image.image_url} alt={image.alt_text ?? detail.name} className="h-full w-full" imgClassName="object-cover" /> : (
                    <div className="flex h-full flex-col items-center justify-center gap-1 text-charcoal-300"><ImageIcon className="h-5 w-5" /><span className="text-[8px]">No photo</span></div>
                  )}
                </div>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { label: 'Operator', value: operatorFor(detail)?.business_name ?? 'Unknown' },
                { label: 'Operator status', value: operatorFor(detail)?.status ?? 'Unknown' },
                { label: 'Hours', value: detail.operating_hours },
                { label: 'Phone', value: detail.contact_phone ?? '—' },
                { label: 'Coordinates', value: `${detail.latitude.toFixed(5)}, ${detail.longitude.toFixed(5)}` },
                { label: 'Submitted', value: formatDate(detail.created_at) },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-mint-50 px-3 py-2.5">
                  <p className="text-[8.5px] uppercase tracking-[0.12em] text-muted">{item.label}</p>
                  <p className="mt-0.5 text-[11px] capitalize text-charcoal-700">{item.value}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Description</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-charcoal-600">{detail.description || 'No description provided.'}</p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Amenities</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(detail.amenities ?? []).length ? detail.amenities.map((amenity) => <span key={amenity} className="rounded-md bg-charcoal-50 px-2 py-1 text-[9.5px] text-charcoal-600">{amenity}</span>) : <span className="text-[10px] text-muted">None listed</span>}
              </div>
            </div>

            <SectionCard padded={false} title="Chargers" description="Physical equipment attached to this station." className="shadow-none">
              <div className="divide-y divide-midnight-900/[0.06]">
                {detail.chargers?.length ? detail.chargers.map((charger) => (
                  <div key={charger.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint text-midnight-800"><PlugZap className="h-3.5 w-3.5" /></span>
                      <div>
                        <p className="text-[11px] font-semibold text-midnight-900">{charger.name}</p>
                        <p className="font-mono text-[9px] text-muted">{charger.charger_code} · {connectorLabels[charger.connector_type]} · {charger.capacity_kw} kW</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[11px] text-midnight-900">{formatNaira(charger.price_per_kwh)}/kWh</p>
                      <p className="text-[9px] capitalize text-muted">{charger.status}</p>
                    </div>
                  </div>
                )) : <p className="px-4 py-5 text-center text-[11px] text-muted">No chargers added. This station cannot go live.</p>}
              </div>
            </SectionCard>

            <a href={`https://www.google.com/maps/search/?api=1&query=${detail.latitude},${detail.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-lime-700 hover:underline">
              <MapPin className="h-3 w-3" /> Verify pin on Google Maps
            </a>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        title={decision?.type === 'approved' ? 'Approve this station' : 'Reject or suspend this station'}
        description={decision ? `${decision.station.name} · ${decision.station.city}` : undefined}
        footer={<><Button variant="outline" onClick={() => setDecision(null)}>Cancel</Button><Button variant={decision?.type === 'approved' ? 'primary' : 'danger'} loading={working} onClick={submit}>{decision?.type === 'approved' ? 'Approve station' : 'Confirm rejection'}</Button></>}
      >
        {decision?.type === 'approved' ? (
          <div className="space-y-3">
            <div className="rounded-2xl bg-lime/15 px-4 py-3 text-[11px] leading-relaxed text-charcoal-600">
              Confirming makes this location visible in search and open for paid bookings. Ensure the pin, photos and
              charger list match reality.
            </div>
            <label className="flex items-center gap-2 text-[12px] text-charcoal-600">
              <input type="checkbox" checked={feature} onChange={(event) => setFeature(event.target.checked)} className="h-4 w-4 rounded border-midnight-900/20 text-lime focus:ring-lime" />
              Feature this station on the homepage and search
            </label>
            <Field label="Internal note (optional)">
              <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Photos and pin verified against operator documents." />
            </Field>
          </div>
        ) : (
          <Field label="Reason for the operator" required hint="Be specific about what must change before approval.">
            <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Photos do not show the installed charger; upload a clear photo of the unit and re-submit." />
          </Field>
        )}
      </Modal>
    </div>
  )
}
