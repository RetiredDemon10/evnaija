import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CheckCircle2, CreditCard, Receipt, Search, XCircle } from 'lucide-react'
import { listAllPayments } from '@/services/admin'
import type { Payment } from '@/types'
import { PageHeader, DataTable, Pagination, Tabs, type Column } from '@/components/ui/Data'
import { PaymentStatusBadge } from '@/components/booking/StatusBadges'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { DetailRow, ExportButton, SelectFilter, TableEmpty, usePaged } from '@/components/dashboard/Kit'
import { PageLoader } from '@/components/ui/Feedback'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatDateTime, formatNaira, humanize } from '@/lib/utils'

type Filter = 'all' | 'success' | 'pending' | 'failed' | 'reversed'

export default function AdminPaymentsPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const [channel, setChannel] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<Payment | null>(null)
  usePageTitle('Payments')

  const { data: payments = [], isLoading } = useQuery({ queryKey: ['admin-payments'], queryFn: listAllPayments })

  const counts = useMemo(() => ({
    all: payments.length,
    success: payments.filter((payment) => payment.status === 'success').length,
    pending: payments.filter((payment) => payment.status === 'pending').length,
    failed: payments.filter((payment) => ['failed', 'abandoned'].includes(payment.status)).length,
    reversed: payments.filter((payment) => payment.status === 'reversed').length,
  }), [payments])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return payments.filter((payment) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'failed' && ['failed', 'abandoned'].includes(payment.status)) ||
        (filter !== 'failed' && payment.status === filter)
      const matchesChannel = channel === 'all' || payment.channel === channel
      const matchesSearch =
        !term ||
        payment.reference.toLowerCase().includes(term) ||
        (payment.customer?.email ?? '').toLowerCase().includes(term) ||
        (payment.customer?.full_name ?? '').toLowerCase().includes(term) ||
        (payment.booking?.booking_reference ?? '').toLowerCase().includes(term)
      return matchesFilter && matchesChannel && matchesSearch
    })
  }, [payments, filter, channel, search])

  const { rows, pageCount } = usePaged(filtered, 14, page)
  const successfulValue = payments.filter((payment) => payment.status === 'success').reduce((sum, payment) => sum + payment.amount, 0)

  const columns: Column<Payment>[] = [
    {
      key: 'reference',
      header: 'Reference',
      render: (payment) => (
        <div>
          <p className="font-mono text-[10.5px] font-medium text-midnight-900">{payment.reference}</p>
          <p className="text-[9px] text-muted">{payment.booking?.booking_reference ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (payment) => (
        <div>
          <p className="text-[11px] font-semibold text-midnight-900">{payment.customer?.full_name ?? '—'}</p>
          <p className="text-[9.5px] text-muted">{payment.customer?.email ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (payment) => <span className="font-mono text-[11.5px] font-medium text-midnight-900">{formatNaira(payment.amount)}</span>,
    },
    {
      key: 'channel',
      header: 'Channel',
      render: (payment) => <Badge tone="neutral">{humanize(payment.channel ?? 'unknown')}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (payment) => <PaymentStatusBadge status={payment.status} />,
    },
    {
      key: 'paid',
      header: 'Date',
      render: (payment) => (
        <div>
          <p className="text-[10px] text-charcoal-600">{formatDate(payment.created_at)}</p>
          <p className="font-mono text-[9px] text-muted">{payment.paid_at ? formatDate(payment.paid_at, 'HH:mm') : '—'}</p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (payment) => (
        <button onClick={() => setDetail(payment)} className="inline-flex h-8 items-center rounded-lg border border-midnight-900/10 px-2.5 text-[10px] font-semibold text-charcoal-600 hover:bg-mint-50">View</button>
      ),
    },
  ]

  if (isLoading) return <PageLoader label="Loading payments" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bookings & finance"
        title="Payments"
        description="Every Paystack transaction and its server-verified state. Never rely on client callbacks alone."
        actions={<ExportButton filename="ev-naija-payments.csv" rows={filtered.map((payment) => ({ reference: payment.reference, paystack: payment.paystack_reference ?? '', booking: payment.booking?.booking_reference ?? '', customer: payment.customer?.full_name ?? '', amount: payment.amount, channel: payment.channel ?? '', status: payment.status, paidAt: payment.paid_at ?? '', createdAt: payment.created_at }))} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Successful value', value: formatNaira(successfulValue, { compact: true }), hint: `${counts.success} payments`, icon: CheckCircle2, tone: 'text-emerald-700' },
          { label: 'Total transactions', value: counts.all, hint: 'All attempts', icon: CreditCard, tone: 'text-midnight-900' },
          { label: 'Pending', value: counts.pending, hint: 'Awaiting confirmation', icon: Receipt, tone: 'text-amber-700' },
          { label: 'Failed / reversed', value: counts.failed + counts.reversed, hint: 'No revenue recognised', icon: XCircle, tone: 'text-red-500' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
            <div className="flex items-center justify-between"><p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{stat.label}</p><stat.icon className={`h-4 w-4 ${stat.tone}`} /></div>
            <p className={`mt-2 font-mono text-xl font-medium ${stat.tone}`}>{stat.value}</p>
            <p className="mt-0.5 text-[9.5px] text-muted">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          value={filter}
          onChange={(value) => { setFilter(value); setPage(1) }}
          tabs={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'success', label: 'Successful', count: counts.success },
            { value: 'pending', label: 'Pending', count: counts.pending },
            { value: 'failed', label: 'Failed', count: counts.failed },
            { value: 'reversed', label: 'Reversed', count: counts.reversed },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search reference, customer or booking" className="input-base h-9 pl-9 text-[11px]" />
          </div>
          <SelectFilter value={channel} onChange={(value) => { setChannel(value); setPage(1) }} options={[{ value: 'all', label: 'All channels' }, { value: 'card', label: 'Card' }, { value: 'bank_transfer', label: 'Bank transfer' }, { value: 'ussd', label: 'USSD' }, { value: 'mobile_money', label: 'Mobile money' }]} />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        minWidth={820}
        empty={<TableEmpty title="No payments in this view" description="Try another tab or clear the search." />}
        mobileRender={(payment) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[12px] font-semibold text-midnight-900">{payment.customer?.full_name ?? 'Customer'}</p>
                <p className="font-mono text-[9px] text-muted">{payment.reference}</p>
              </div>
              <PaymentStatusBadge status={payment.status} />
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-midnight-900/[0.06] pt-2 text-[10px]">
              <span className="capitalize text-muted">{humanize(payment.channel ?? '—')}</span>
              <span className="font-mono font-medium text-midnight-900">{formatNaira(payment.amount)}</span>
            </div>
          </div>
        )}
      />
      <Pagination page={page} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={14} />

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Payment details" description={detail?.reference} footer={<button onClick={() => setDetail(null)} className="inline-flex h-10 items-center rounded-xl border border-midnight-900/10 px-4 text-[11px] font-semibold text-charcoal-600">Close</button>}>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl bg-mint-50 px-4 py-3">
              <div>
                <p className="text-[9px] uppercase tracking-[0.12em] text-muted">Amount</p>
                <p className="font-mono text-xl font-medium text-midnight-900">{formatNaira(detail.amount)}</p>
              </div>
              <PaymentStatusBadge status={detail.status} />
            </div>
            <div className="divide-y divide-midnight-900/[0.06] rounded-2xl border border-midnight-900/[0.07] px-4">
              <DetailRow label="Paystack reference" value={detail.paystack_reference ?? '—'} mono />
              <DetailRow label="Booking" value={detail.booking?.booking_reference ?? detail.booking_id} mono />
              <DetailRow label="Customer" value={detail.customer?.email ?? detail.customer_id} />
              <DetailRow label="Channel" value={humanize(detail.channel ?? '—')} />
              <DetailRow label="Currency" value={detail.currency} />
              <DetailRow label="Initiated" value={formatDateTime(detail.created_at)} />
              <DetailRow label="Paid at" value={detail.paid_at ? formatDateTime(detail.paid_at) : '—'} />
              <DetailRow label="Gateway response" value={detail.gateway_response ?? '—'} />
            </div>
            {detail.status === 'success' && (
              <Link to="/admin/refunds" className="inline-flex h-9 items-center rounded-xl border border-midnight-900/10 px-3 text-[10.5px] font-semibold text-charcoal-600 hover:bg-mint-50">Open refunds queue</Link>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
