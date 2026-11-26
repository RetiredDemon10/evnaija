import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Search } from 'lucide-react'
import { listLedger } from '@/services/admin'
import type { FinancialLedgerEntry } from '@/types'
import { PageHeader, DataTable, Pagination, Tabs, type Column } from '@/components/ui/Data'
import { ExportButton, SelectFilter, TableEmpty, usePaged } from '@/components/dashboard/Kit'
import { PageLoader } from '@/components/ui/Feedback'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatDateTime, formatNaira, humanize } from '@/lib/utils'

type Filter = 'all' | 'credit' | 'debit'

const TYPE_OPTIONS = [
  'booking_payment',
  'platform_commission',
  'operator_earning',
  'service_fee',
  'tax',
  'refund',
  'payout',
  'subscription',
  'promotion',
]

export default function AdminTransactionsPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const [type, setType] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  usePageTitle('Platform ledger')

  const { data: entries = [], isLoading } = useQuery({ queryKey: ['admin-ledger'], queryFn: listLedger })

  const credits = entries.filter((entry) => entry.direction === 'credit').reduce((sum, entry) => sum + entry.amount, 0)
  const debits = entries.filter((entry) => entry.direction === 'debit').reduce((sum, entry) => sum + entry.amount, 0)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return entries.filter((entry) => {
      const matchesFilter = filter === 'all' || entry.direction === filter
      const matchesType = type === 'all' || entry.entry_type === type
      const matchesSearch = !term || entry.description.toLowerCase().includes(term) || entry.entry_type.toLowerCase().includes(term) || (entry.booking_id ?? '').toLowerCase().includes(term)
      return matchesFilter && matchesType && matchesSearch
    })
  }, [entries, filter, type, search])

  const { rows, pageCount } = usePaged(filtered, 16, page)

  const columns: Column<FinancialLedgerEntry>[] = [
    {
      key: 'type',
      header: 'Entry',
      render: (entry) => (
        <div className="flex items-center gap-2.5">
          <span className={`grid h-8 w-8 place-items-center rounded-lg ${entry.direction === 'credit' ? 'bg-lime/25 text-midnight-800' : 'bg-red-50 text-red-500'}`}>
            {entry.direction === 'credit' ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
          </span>
          <div>
            <p className="text-[11.5px] font-semibold text-midnight-900">{humanize(entry.entry_type)}</p>
            <p className="max-w-[240px] truncate text-[9.5px] text-muted">{entry.description}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'booking',
      header: 'Booking / payout',
      render: (entry) => <span className="font-mono text-[9.5px] text-charcoal-500">{entry.booking_id?.slice(-10).toUpperCase() ?? entry.payout_id?.slice(-10).toUpperCase() ?? '—'}</span>,
    },
    {
      key: 'operator',
      header: 'Operator ID',
      render: (entry) => <span className="font-mono text-[9px] text-muted">{entry.operator_id?.slice(-10) ?? 'platform'}</span>,
    },
    {
      key: 'direction',
      header: 'Direction',
      render: (entry) => <span className={`text-[10px] font-semibold capitalize ${entry.direction === 'credit' ? 'text-emerald-700' : 'text-red-500'}`}>{entry.direction}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (entry) => <span className={`font-mono text-[11.5px] font-medium ${entry.direction === 'credit' ? 'text-midnight-900' : 'text-red-600'}`}>{entry.direction === 'debit' ? '−' : '+'}{formatNaira(entry.amount)}</span>,
    },
    {
      key: 'date',
      header: 'Recorded',
      render: (entry) => (
        <div>
          <p className="text-[10px] text-charcoal-600">{formatDate(entry.created_at)}</p>
          <p className="font-mono text-[9px] text-muted">{formatDate(entry.created_at, 'HH:mm')}</p>
        </div>
      ),
    },
  ]

  if (isLoading) return <PageLoader label="Loading ledger" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bookings & finance"
        title="Platform ledger"
        description="Append-only financial journal across bookings, commissions, refunds and payouts. This is the source of truth for money movement."
        actions={<ExportButton filename="ev-naija-ledger.csv" rows={filtered.map((entry) => ({ date: entry.created_at, type: entry.entry_type, direction: entry.direction, amount: entry.amount, booking: entry.booking_id ?? '', payout: entry.payout_id ?? '', operator: entry.operator_id ?? '', description: entry.description }))} />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl bg-midnight-950 p-5 text-white">
          <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/40">Net journal balance</p>
          <p className="mt-1.5 font-mono text-2xl font-medium text-lime">{formatNaira(credits - debits)}</p>
          <p className="mt-1 text-[9.5px] text-white/40">Credits minus debits</p>
        </div>
        <div className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">Total credits</p>
          <p className="mt-2 font-mono text-xl font-medium text-emerald-700">{formatNaira(credits)}</p>
          <p className="mt-0.5 text-[9.5px] text-muted">{entries.filter((entry) => entry.direction === 'credit').length} entries</p>
        </div>
        <div className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">Total debits</p>
          <p className="mt-2 font-mono text-xl font-medium text-red-500">{formatNaira(debits)}</p>
          <p className="mt-0.5 text-[9.5px] text-muted">{entries.filter((entry) => entry.direction === 'debit').length} entries</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          value={filter}
          onChange={(value) => { setFilter(value); setPage(1) }}
          tabs={[
            { value: 'all', label: 'All', count: entries.length },
            { value: 'credit', label: 'Credits', count: entries.filter((entry) => entry.direction === 'credit').length },
            { value: 'debit', label: 'Debits', count: entries.filter((entry) => entry.direction === 'debit').length },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search description or booking" className="input-base h-9 pl-9 text-[11px]" />
          </div>
          <SelectFilter value={type} onChange={(value) => { setType(value); setPage(1) }} options={[{ value: 'all', label: 'All entry types' }, ...TYPE_OPTIONS.map((value) => ({ value, label: humanize(value) }))]} />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        minWidth={820}
        empty={<TableEmpty title="No ledger entries in this view" description="Try another direction or entry type." />}
        mobileRender={(entry) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11.5px] font-semibold text-midnight-900">{humanize(entry.entry_type)}</p>
                <p className="max-w-[200px] truncate text-[9.5px] text-muted">{entry.description}</p>
              </div>
              <span className={`font-mono text-[12px] font-medium ${entry.direction === 'credit' ? 'text-emerald-700' : 'text-red-600'}`}>{entry.direction === 'debit' ? '−' : '+'}{formatNaira(entry.amount)}</span>
            </div>
            <p className="mt-2 font-mono text-[9px] text-muted">{formatDateTime(entry.created_at)}</p>
          </div>
        )}
      />
      <Pagination page={page} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={16} />

      <div className="flex items-start gap-2 rounded-2xl border border-midnight-900/[0.07] bg-white px-4 py-3.5">
        <ArrowLeftRight className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" />
        <p className="text-[10.5px] leading-relaxed text-charcoal-500">
          Ledger rows are immutable. Corrections are made with compensating entries, never updates. Reconcile this journal
          against Paystack settlement reports before approving payouts.
        </p>
      </div>
    </div>
  )
}
