import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CheckCircle2, Mail, MapPin, Phone, Search, ShieldAlert, UserCog, Users } from 'lucide-react'
import { listCustomers, setCustomerSuspended, writeAuditLog } from '@/services/admin'
import type { Profile } from '@/types'
import { PageHeader, DataTable, Pagination, Tabs, type Column } from '@/components/ui/Data'
import { Avatar } from '@/components/ui/Brand'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Field, Textarea } from '@/components/ui/Form'
import { ExportButton, SelectFilter, TableEmpty, usePaged } from '@/components/dashboard/Kit'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate } from '@/lib/utils'

type Filter = 'all' | 'active' | 'suspended'

export default function AdminCustomersPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  const [city, setCity] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [target, setTarget] = useState<Profile | null>(null)
  const [reason, setReason] = useState('')
  const [working, setWorking] = useState(false)
  const [detail, setDetail] = useState<Profile | null>(null)
  usePageTitle('Customers')

  const { data: customers = [], isLoading } = useQuery({ queryKey: ['admin-customers'], queryFn: listCustomers })

  const cities = useMemo(() => Array.from(new Set(customers.map((customer) => customer.preferred_city).filter(Boolean))) as string[], [customers])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return customers.filter((customer) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && !customer.is_suspended) ||
        (filter === 'suspended' && customer.is_suspended)
      const matchesCity = city === 'all' || customer.preferred_city === city
      const matchesSearch =
        !term ||
        customer.full_name.toLowerCase().includes(term) ||
        customer.email.toLowerCase().includes(term) ||
        (customer.phone ?? '').includes(term)
      return matchesFilter && matchesCity && matchesSearch
    })
  }, [customers, filter, city, search])

  const { rows, pageCount } = usePaged(filtered, 12, page)

  const toggleSuspension = async () => {
    if (!target) return
    const next = !target.is_suspended
    if (next && reason.trim().length < 6) {
      toast.error('Add a suspension reason', 'The reason is recorded and visible to the customer.')
      return
    }
    setWorking(true)
    try {
      await setCustomerSuspended(target.id, next, next ? reason.trim() : undefined)
      if (user) {
        await writeAuditLog(user.id, next ? 'customer.suspended' : 'customer.reinstated', 'profile', target.id, {
          reason: next ? reason.trim() : undefined,
          email: target.email,
        })
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-customers'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
      toast.success(next ? 'Customer suspended' : 'Customer reinstated', next ? 'They cannot create new bookings until reinstated.' : 'The customer can book again immediately.')
      setTarget(null)
      setReason('')
    } catch (error) {
      toast.error('Could not update customer', (error as Error).message)
    } finally {
      setWorking(false)
    }
  }

  const columns: Column<Profile>[] = [
    {
      key: 'name',
      header: 'Customer',
      render: (customer) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={customer.full_name} src={customer.avatar_url} size={34} />
          <div>
            <p className="text-[12px] font-semibold text-midnight-900">{customer.full_name}</p>
            <p className="text-[10px] text-muted">Joined {formatDate(customer.created_at)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (customer) => (
        <div className="space-y-0.5 text-[10.5px] text-charcoal-600">
          <p className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted" /> {customer.email}</p>
          <p className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted" /> {customer.phone ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (customer) => (
        <div className="text-[10.5px] text-charcoal-600">
          <p>{customer.preferred_city ?? '—'}</p>
          <p className="text-[9.5px] text-muted">{customer.preferred_state ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (customer) => customer.is_suspended ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Active</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (customer) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => setDetail(customer)} className="inline-flex h-8 items-center rounded-lg border border-midnight-900/10 px-2.5 text-[10px] font-semibold text-charcoal-600 hover:bg-mint-50">View</button>
          <button
            onClick={() => { setTarget(customer); setReason(customer.suspended_reason ?? '') }}
            className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[10px] font-semibold ${customer.is_suspended ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
          >
            {customer.is_suspended ? <><CheckCircle2 className="h-3 w-3" /> Reinstate</> : <><Ban className="h-3 w-3" /> Suspend</>}
          </button>
        </div>
      ),
    },
  ]

  if (isLoading) return <PageLoader label="Loading customers" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketplace"
        title="Customers"
        description="Driver accounts, contact details and suspension controls. Suspension blocks new bookings but preserves history."
        actions={<ExportButton filename="ev-naija-customers.csv" rows={filtered.map((customer) => ({ name: customer.full_name, email: customer.email, phone: customer.phone ?? '', city: customer.preferred_city ?? '', state: customer.preferred_state ?? '', status: customer.is_suspended ? 'suspended' : 'active', joined: customer.created_at }))} />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
          <div className="flex items-center justify-between"><p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">Total customers</p><Users className="h-4 w-4 text-midnight-700" /></div>
          <p className="mt-2 font-mono text-xl font-medium text-midnight-900">{customers.length}</p>
          <p className="mt-0.5 text-[9.5px] text-muted">Registered driver accounts</p>
        </div>
        <div className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
          <div className="flex items-center justify-between"><p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">Active</p><CheckCircle2 className="h-4 w-4 text-emerald-600" /></div>
          <p className="mt-2 font-mono text-xl font-medium text-midnight-900">{customers.filter((customer) => !customer.is_suspended).length}</p>
          <p className="mt-0.5 text-[9.5px] text-muted">Can create bookings</p>
        </div>
        <div className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
          <div className="flex items-center justify-between"><p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">Suspended</p><ShieldAlert className="h-4 w-4 text-red-500" /></div>
          <p className="mt-2 font-mono text-xl font-medium text-red-500">{customers.filter((customer) => customer.is_suspended).length}</p>
          <p className="mt-0.5 text-[9.5px] text-muted">Blocked from new bookings</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          value={filter}
          onChange={(value) => { setFilter(value); setPage(1) }}
          tabs={[
            { value: 'all', label: 'All', count: customers.length },
            { value: 'active', label: 'Active', count: customers.filter((customer) => !customer.is_suspended).length },
            { value: 'suspended', label: 'Suspended', count: customers.filter((customer) => customer.is_suspended).length },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search name, email or phone" className="input-base h-9 pl-9 text-[11px]" />
          </div>
          <SelectFilter value={city} onChange={(value) => { setCity(value); setPage(1) }} options={[{ value: 'all', label: 'All cities' }, ...cities.map((value) => ({ value, label: value }))]} />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        minWidth={720}
        empty={<TableEmpty title="No customers in this view" description="Try clearing filters, or wait for new driver registrations." />}
        mobileRender={(customer) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Avatar name={customer.full_name} src={customer.avatar_url} size={34} />
                <div>
                  <p className="text-[12.5px] font-semibold text-midnight-900">{customer.full_name}</p>
                  <p className="text-[10px] text-muted">{customer.email}</p>
                </div>
              </div>
              {customer.is_suspended ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Active</Badge>}
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-midnight-900/[0.06] pt-2.5">
              <p className="text-[10px] text-muted">{customer.preferred_city ?? 'No city'} · {formatDate(customer.created_at)}</p>
              <button onClick={() => setDetail(customer)} className="text-[10.5px] font-semibold text-lime-700">View</button>
            </div>
          </div>
        )}
      />
      <Pagination page={page} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={12} />

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Customer details" description="Read-only profile information." footer={<Button variant="outline" onClick={() => setDetail(null)}>Close</Button>}>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={detail.full_name} src={detail.avatar_url} size={48} />
              <div>
                <p className="font-display text-base font-semibold text-midnight-900">{detail.full_name}</p>
                <p className="text-[10.5px] text-muted">{detail.email}</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { icon: Mail, label: 'Email', value: detail.email },
                { icon: Phone, label: 'Phone', value: detail.phone ?? '—' },
                { icon: MapPin, label: 'Preferred city', value: detail.preferred_city ?? '—' },
                { icon: MapPin, label: 'Home address', value: detail.home_address ?? '—' },
                { icon: UserCog, label: 'Joined', value: formatDate(detail.created_at) },
                { icon: ShieldAlert, label: 'Status', value: detail.is_suspended ? 'Suspended' : 'Active' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-mint-50 px-3 py-2.5">
                  <p className="flex items-center gap-1 text-[8.5px] uppercase tracking-[0.12em] text-muted"><item.icon className="h-2.5 w-2.5" /> {item.label}</p>
                  <p className="mt-0.5 break-words text-[11px] text-charcoal-700">{item.value}</p>
                </div>
              ))}
            </div>
            {detail.is_suspended && detail.suspended_reason && (
              <div className="rounded-xl bg-red-50 px-3 py-2.5 text-[10.5px] text-red-700"><strong>Suspension reason:</strong> {detail.suspended_reason}</div>
            )}
            <div className="flex justify-end">
              <Button variant={detail.is_suspended ? 'soft' : 'danger'} onClick={() => { setTarget(detail); setReason(detail.suspended_reason ?? ''); setDetail(null) }}>
                {detail.is_suspended ? 'Reinstate customer' : 'Suspend customer'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={target?.is_suspended ? 'Reinstate customer' : 'Suspend customer'}
        description={target ? `${target.full_name} · ${target.email}` : undefined}
        footer={<><Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button><Button variant={target?.is_suspended ? 'soft' : 'danger'} loading={working} onClick={toggleSuspension}>{target?.is_suspended ? 'Reinstate' : 'Suspend customer'}</Button></>}
      >
        {target?.is_suspended ? (
          <p className="text-[12px] leading-relaxed text-charcoal-600">This restores the customer's ability to create bookings and leave reviews. Existing records remain unchanged.</p>
        ) : (
          <Field label="Suspension reason" required hint="Recorded in the audit log and shown to the customer.">
            <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Repeated no-shows after charging sessions were reserved…" />
          </Field>
        )}
      </Modal>
    </div>
  )
}
