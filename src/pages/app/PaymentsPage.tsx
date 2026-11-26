import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CreditCard, Download, Receipt, ShieldCheck, Wallet } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { listPayments } from '@/services/bookings'
import type { Payment } from '@/types'
import { PageHeader, StatCard, DataTable, Tabs, type Column } from '@/components/ui/Data'
import { PaymentStatusBadge } from '@/components/booking/StatusBadges'
import { ExportButton, TableEmpty } from '@/components/dashboard/Kit'
import { PageLoader } from '@/components/ui/Feedback'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatDateTime, formatNaira, humanize } from '@/lib/utils'

type Filter = 'all' | 'success' | 'pending' | 'failed'

export default function PaymentsPage() {
  const { user } = useAuth()
  const [filter, setFilter] = useState<Filter>('all')
  usePageTitle('Payment history')

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments', user?.id],
    queryFn: () => listPayments(user?.id),
    enabled: Boolean(user?.id),
  })

  const successful = payments.filter((payment) => payment.status === 'success')
  const total = successful.reduce((sum, payment) => sum + payment.amount, 0)
  const filtered = useMemo(
    () => payments.filter((payment) => filter === 'all' || payment.status === filter),
    [payments, filter],
  )

  const columns: Column<Payment>[] = [
    {
      key: 'reference',
      header: 'Reference',
      render: (payment) => (
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint text-midnight-800"><Receipt className="h-3.5 w-3.5" /></span>
          <div>
            <p className="font-mono text-[11px] font-medium text-midnight-900">{payment.reference}</p>
            <p className="text-[10px] text-muted">{payment.paystack_reference ?? 'Paystack'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'booking',
      header: 'Booking',
      render: (payment) => (
        <div>
          <p className="text-[12px] font-semibold text-midnight-900">{payment.booking?.station?.name ?? 'Charging session'}</p>
          <p className="font-mono text-[10px] text-muted">{payment.booking?.booking_reference ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (payment) => <span className="font-mono text-[12.5px] font-medium text-midnight-900">{formatNaira(payment.amount)}</span>,
    },
    {
      key: 'channel',
      header: 'Channel',
      render: (payment) => <span className="text-[11px] text-charcoal-600">{humanize(payment.channel ?? 'pending')}</span>,
    },
    {
      key: 'date',
      header: 'Date',
      render: (payment) => (
        <div>
          <p className="text-[11px] text-charcoal-600">{formatDate(payment.paid_at ?? payment.created_at)}</p>
          <p className="font-mono text-[9.5px] text-muted">{formatDate(payment.paid_at ?? payment.created_at, 'HH:mm')}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (payment) => <PaymentStatusBadge status={payment.status} />,
    },
    {
      key: 'actions',
      header: '',
      render: (payment) => (
        <Link to={payment.booking ? `/app/bookings/${payment.booking_id}` : '/app/bookings'} className="inline-flex h-8 items-center gap-1 rounded-lg border border-midnight-900/10 px-2.5 text-[10.5px] font-semibold text-charcoal-700 hover:bg-mint-50">
          Receipt
        </Link>
      ),
    },
  ]

  if (isLoading) return <PageLoader label="Loading payments" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billing"
        title="Payment history"
        description="Every charge, receipt and refund request tied to your EV Naija account."
        actions={
          <ExportButton
            filename="ev-naija-payments.csv"
            rows={filtered.map((payment) => ({
              reference: payment.reference,
              booking: payment.booking?.booking_reference ?? '',
              station: payment.booking?.station?.name ?? '',
              amount: payment.amount,
              currency: payment.currency,
              status: payment.status,
              channel: payment.channel ?? '',
              date: payment.paid_at ?? payment.created_at,
            }))}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total paid" value={formatNaira(total)} icon={<Wallet className="h-4 w-4" />} tone="lime" hint={`${successful.length} successful payments`} />
        <StatCard label="Pending" value={payments.filter((payment) => payment.status === 'pending').length} icon={<CreditCard className="h-4 w-4" />} hint="Awaiting confirmation" />
        <StatCard label="Refunded" value={formatNaira(payments.filter((payment) => payment.status === 'reversed').reduce((sum, payment) => sum + payment.amount, 0))} icon={<Download className="h-4 w-4" />} hint="Reversed transactions" />
      </div>

      <Tabs
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: 'all', label: 'All', count: payments.length },
          { value: 'success', label: 'Successful', count: successful.length },
          { value: 'pending', label: 'Pending', count: payments.filter((payment) => payment.status === 'pending').length },
          { value: 'failed', label: 'Failed', count: payments.filter((payment) => ['failed', 'abandoned', 'reversed'].includes(payment.status)).length },
        ]}
      />

      <DataTable
        columns={columns}
        rows={filtered}
        empty={<TableEmpty title="No payments in this view" description="Completed and pending transactions will show here once you book a session." />}
        mobileRender={(payment) => (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12.5px] font-semibold text-midnight-900">{payment.booking?.station?.name ?? 'Charging session'}</p>
                <p className="font-mono text-[10px] text-muted">{payment.reference}</p>
              </div>
              <PaymentStatusBadge status={payment.status} />
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-midnight-900/[0.06] pt-2.5">
              <span className="text-[10.5px] text-muted">{formatDateTime(payment.paid_at ?? payment.created_at)}</span>
              <span className="font-mono text-[13px] font-medium text-midnight-900">{formatNaira(payment.amount)}</span>
            </div>
          </div>
        )}
      />

      <div className="flex items-start gap-2 rounded-2xl border border-midnight-900/[0.07] bg-white px-4 py-3.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" />
        <p className="text-[10.5px] leading-relaxed text-charcoal-500">
          Payments are processed by Paystack and verified server-side. EV Naija never stores your full card details. If a
          refund is due, it returns to the original payment method and may take 5–10 business days to reflect.
        </p>
      </div>
    </div>
  )
}
