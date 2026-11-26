import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Download, Search } from 'lucide-react'
import { useOperatorData } from '@/hooks/useOperatorData'
import { listOperatorTransactions } from '@/services/operator'
import type { FinancialLedgerEntry } from '@/types'
import { PageHeader, DataTable, type Column, Tabs } from '@/components/ui/Data'
import { ExportButton, TableEmpty } from '@/components/dashboard/Kit'
import { PageLoader } from '@/components/ui/Feedback'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatDateTime, formatNaira, humanize } from '@/lib/utils'

type Filter = 'all' | 'credit' | 'debit'

export default function TransactionsPage() {
  const { operatorId, isLoading } = useOperatorData()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  usePageTitle('Transactions')

  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['operator-transactions', operatorId],
    queryFn: () => listOperatorTransactions(operatorId),
    enabled: Boolean(operatorId),
  })

  const credits = entries.filter((entry) => entry.direction === 'credit').reduce((sum, entry) => sum + entry.amount, 0)
  const debits = entries.filter((entry) => entry.direction === 'debit').reduce((sum, entry) => sum + entry.amount, 0)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return entries.filter((entry) => {
      const matchesFilter = filter === 'all' || entry.direction === filter
      const matchesSearch = !term || entry.description.toLowerCase().includes(term) || entry.entry_type.toLowerCase().includes(term)
      return matchesFilter && matchesSearch
    })
  }, [entries, filter, search])

  const columns: Column<FinancialLedgerEntry>[] = [
    {
      key: 'description',
      header: 'Entry',
      render: (entry) => (
        <div className="flex items-center gap-2.5">
          <span className={`grid h-8 w-8 place-items-center rounded-lg ${entry.direction === 'credit' ? 'bg-lime/25 text-midnight-800' : 'bg-red-50 text-red-500'}`}>
            {entry.direction === 'credit' ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
          </span>
          <div>
            <p className="text-[12px] font-semibold text-midnight-900">{entry.description}</p>
            <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">{humanize(entry.entry_type)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (entry) => <span className="font-mono text-[10px] text-charcoal-500">{entry.booking_id?.slice(-8).toUpperCase() ?? entry.payout_id?.slice(-8).toUpperCase() ?? '—'}</span>,
    },
    {
      key: 'direction',
      header: 'Direction',
      render: (entry) => <span className={`text-[10.5px] font-semibold capitalize ${entry.direction === 'credit' ? 'text-emerald-600' : 'text-red-500'}`}>{entry.direction}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (entry) => <span className={`font-mono text-[12px] font-medium ${entry.direction === 'credit' ? 'text-midnight-900' : 'text-red-600'}`}>{entry.direction === 'debit' ? '−' : '+'}{formatNaira(entry.amount)}</span>,
    },
    {
      key: 'date',
      header: 'Date',
      render: (entry) => (
        <div>
          <p className="text-[10.5px] text-charcoal-600">{formatDate(entry.created_at)}</p>
          <p className="font-mono text-[9px] text-muted">{formatDate(entry.created_at, 'HH:mm')}</p>
        </div>
      ),
    },
  ]

  if (isLoading || loadingEntries) return <PageLoader label="Loading transactions" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ledger"
        title="Transactions"
        description="An auditable, read-only record of every credit and debit tied to your operator account."
        actions={<ExportButton filename="ev-naija-operator-ledger.csv" rows={filtered.map((entry) => ({ date: entry.created_at, type: entry.entry_type, description: entry.description, direction: entry.direction, amount: entry.amount, booking: entry.booking_id ?? '', payout: entry.payout_id ?? '' }))} />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
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
        <div className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">Net balance</p>
          <p className="mt-2 font-mono text-xl font-medium text-midnight-900">{formatNaira(credits - debits)}</p>
          <p className="mt-0.5 text-[9.5px] text-muted">Credits minus debits</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'all', label: 'All entries', count: entries.length },
            { value: 'credit', label: 'Credits', count: entries.filter((entry) => entry.direction === 'credit').length },
            { value: 'debit', label: 'Debits', count: entries.filter((entry) => entry.direction === 'debit').length },
          ]}
        />
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search description or type" className="input-base h-9 pl-9 text-[11px]" />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        minWidth={640}
        empty={<TableEmpty title="No transactions yet" description="Completed bookings, commissions and payouts will create ledger entries here." />}
        mobileRender={(entry) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[12px] font-semibold text-midnight-900">{entry.description}</p>
                <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">{humanize(entry.entry_type)}</p>
              </div>
              <span className={`font-mono text-[12px] font-medium ${entry.direction === 'credit' ? 'text-emerald-700' : 'text-red-600'}`}>{entry.direction === 'debit' ? '−' : '+'}{formatNaira(entry.amount)}</span>
            </div>
            <p className="mt-2 font-mono text-[9px] text-muted">{formatDateTime(entry.created_at)}</p>
          </div>
        )}
      />

      <div className="flex items-start gap-2 rounded-2xl border border-midnight-900/[0.07] bg-white px-4 py-3.5">
        <ArrowLeftRight className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" />
        <p className="text-[10.5px] leading-relaxed text-charcoal-500">
          Ledger entries are append-only. If you believe an entry is wrong, open a support ticket with the reference
          shown here; do not edit financial records directly.
        </p>
      </div>
    </div>
  )
}
