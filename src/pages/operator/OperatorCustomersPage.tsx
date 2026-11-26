import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Mail, Phone, Search, Users } from 'lucide-react'
import { useOperatorData } from '@/hooks/useOperatorData'
import { listOperatorCustomers } from '@/services/operator'
import { PageHeader, DataTable, type Column } from '@/components/ui/Data'
import { ExportButton, TableEmpty } from '@/components/dashboard/Kit'
import { Avatar } from '@/components/ui/Brand'
import { PageLoader } from '@/components/ui/Feedback'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatNaira } from '@/lib/utils'
import type { Profile } from '@/types'

type CustomerRow = Profile & { bookings: number; totalSpent: number }

export default function OperatorCustomersPage() {
  const { stationIds, operatorId, isLoading } = useOperatorData()
  const [search, setSearch] = useState('')
  usePageTitle('Customers')

  const { data = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['operator-customers', operatorId, stationIds],
    queryFn: () => listOperatorCustomers(stationIds) as Promise<CustomerRow[]>,
    enabled: Boolean(operatorId) && stationIds.length > 0,
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return data.filter((customer) => !term || customer.full_name.toLowerCase().includes(term) || customer.email.toLowerCase().includes(term) || (customer.phone ?? '').includes(term))
  }, [data, search])

  const columns: Column<CustomerRow>[] = [
    {
      key: 'customer',
      header: 'Driver',
      render: (customer) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={customer.full_name} src={customer.avatar_url} size={34} />
          <div>
            <p className="text-[12px] font-semibold text-midnight-900">{customer.full_name}</p>
            <p className="text-[10px] text-muted">{customer.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (customer) => (
        <div className="space-y-0.5 text-[10.5px] text-charcoal-600">
          <p className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted" /> {customer.phone ?? '—'}</p>
          <p className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted" /> {customer.email}</p>
        </div>
      ),
    },
    {
      key: 'city',
      header: 'City',
      render: (customer) => <span className="text-[11px] text-charcoal-600">{customer.preferred_city ?? '—'}</span>,
    },
    {
      key: 'bookings',
      header: 'Bookings',
      render: (customer) => <span className="font-mono text-[12px] font-medium text-midnight-900">{customer.bookings}</span>,
    },
    {
      key: 'spent',
      header: 'Spent',
      render: (customer) => <span className="font-mono text-[12px] font-medium text-midnight-900">{formatNaira(customer.totalSpent)}</span>,
    },
    {
      key: 'joined',
      header: 'First seen',
      render: (customer) => <span className="text-[10.5px] text-muted">{formatDate(customer.created_at)}</span>,
    },
  ]

  if (isLoading || loadingCustomers) return <PageLoader label="Loading customers" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Relationships"
        title="Customers"
        description="Drivers who have booked at least one session at your stations. Contact details are for booking support only."
        actions={<ExportButton filename="ev-naija-operator-customers.csv" rows={filtered.map((customer) => ({ name: customer.full_name, email: customer.email, phone: customer.phone ?? '', city: customer.preferred_city ?? '', bookings: customer.bookings, totalSpent: customer.totalSpent }))} />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">Unique drivers</p>
          <p className="mt-2 font-mono text-xl font-medium text-midnight-900">{data.length}</p>
          <p className="mt-0.5 text-[9.5px] text-muted">Have booked your stations</p>
        </div>
        <div className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">Repeat drivers</p>
          <p className="mt-2 font-mono text-xl font-medium text-midnight-900">{data.filter((customer) => customer.bookings > 1).length}</p>
          <p className="mt-0.5 text-[9.5px] text-muted">Two or more sessions</p>
        </div>
        <div className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">Gross customer spend</p>
          <p className="mt-2 font-mono text-xl font-medium text-midnight-900">{formatNaira(data.reduce((sum, customer) => sum + customer.totalSpent, 0))}</p>
          <p className="mt-0.5 text-[9.5px] text-muted">Includes platform fees</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or phone" className="input-base h-10 pl-9 text-[12px]" />
        </div>
        <span className="hidden items-center gap-1 text-[10px] text-muted sm:flex"><Users className="h-3 w-3" /> {filtered.length} shown</span>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        minWidth={680}
        empty={<TableEmpty title="No customers yet" description="Once drivers book and pay for sessions at your stations, they will appear here." />}
        mobileRender={(customer) => (
          <div>
            <div className="flex items-center gap-2.5">
              <Avatar name={customer.full_name} src={customer.avatar_url} size={34} />
              <div>
                <p className="text-[12.5px] font-semibold text-midnight-900">{customer.full_name}</p>
                <p className="text-[10px] text-muted">{customer.email}</p>
              </div>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-midnight-900/[0.06] pt-2.5 text-[10.5px] text-muted">
              <span>{customer.bookings} bookings</span>
              <span className="text-right font-mono font-medium text-midnight-900">{formatNaira(customer.totalSpent)}</span>
            </div>
          </div>
        )}
      />
    </div>
  )
}
