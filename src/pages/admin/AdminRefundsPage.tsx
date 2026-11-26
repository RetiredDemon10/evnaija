import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock, Download, Receipt, RotateCcw, Search, XCircle } from 'lucide-react'
import { listRefunds, processRefundRemote, writeAuditLog } from '@/services/admin'
import type { Refund } from '@/types'
import { PageHeader, DataTable, Pagination, Tabs, type Column } from '@/components/ui/Data'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Field, Textarea } from '@/components/ui/Form'
import { DetailRow, ExportButton, InfoNote, TableEmpty, usePaged } from '@/components/dashboard/Kit'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatDateTime, formatNaira } from '@/lib/utils'

type Filter = 'all' | 'pending' | 'processing' | 'completed' | 'failed'

const TONE: Record<Refund['status'], 'success' | 'warning' | 'danger' | 'neutral'> = {
  pending: 'warning',
  processing: 'warning',
  completed: 'success',
  failed: 'danger',
}

export default function AdminRefundsPage() {
  const { user, isPreview } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [target, setTarget] = useState<Refund | null>(null)
  const [detail, setDetail] = useState<Refund | null>(null)
  const [notes, setNotes] = useState('')
  const [working, setWorking] = useState(false)
  usePageTitle('Refunds')

  const { data: refunds = [], isLoading } = useQuery({ queryKey: ['admin-refunds'], queryFn: listRefunds })

  const counts = useMemo(() => ({
    all: refunds.length,
    pending: refunds.filter((refund) => refund.status === 'pending').length,
    processing: refunds.filter((refund) => refund.status === 'processing').length,
    completed: refunds.filter((refund) => refund.status === 'completed').length,
    failed: refunds.filter((refund) => refund.status === 'failed').length,
  }), [refunds])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return refunds.filter((refund) => {
      const matchesFilter = filter === 'all' || refund.status === filter
      const matchesSearch = !term || refund.reason.toLowerCase().includes(term) || (refund.booking?.booking_reference ?? '').toLowerCase().includes(term) || (refund.payment?.reference ?? '').toLowerCase().includes(term)
      return matchesFilter && matchesSearch
    })
  }, [refunds, filter, search])

  const { rows, pageCount } = usePaged(filtered, 12, page)

  const process = async () => {
    if (!target) return
    setWorking(true)
    try {
      await processRefundRemote(target.id)
      if (user) {
        await writeAuditLog(user.id, 'refund.processed', 'refund', target.id, {
          amount: target.amount,
          booking: target.booking?.booking_reference,
          notes: notes.trim() || undefined,
        })
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-refunds'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-payments'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-ledger'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
      toast.success('Refund processed', `${formatNaira(target.amount)} has been sent back to the original payment method.`)
      setTarget(null)
      setNotes('')
    } catch (error) {
      toast.error('Refund failed', (error as Error).message)
    } finally {
      setWorking(false)
    }
  }

  const columns: Column<Refund>[] = [
    {
      key: 'refund',
      header: 'Refund',
      render: (refund) => (
        <div>
          <p className="font-mono text-[11px] font-medium text-midnight-900">{formatNaira(refund.amount)}</p>
          <p className="text-[9.5px] text-muted">{formatDate(refund.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'booking',
      header: 'Booking / payment',
      render: (refund) => (
        <div>
          <p className="font-mono text-[10px] text-charcoal-700">{refund.booking?.booking_reference ?? refund.booking_id}</p>
          <p className="font-mono text-[9px] text-muted">{refund.payment?.reference ?? refund.payment_id}</p>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (refund) => <p className="max-w-[260px] truncate text-[10.5px] text-charcoal-600" title={refund.reason}>{refund.reason}</p>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (refund) => <Badge tone={TONE[refund.status]}>{refund.status}</Badge>,
    },
    {
      key: 'processed',
      header: 'Processed',
      render: (refund) => <span className="text-[10px] text-muted">{refund.processed_at ? formatDate(refund.processed_at) : '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (refund) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => setDetail(refund)} className="inline-flex h-8 items-center rounded-lg border border-midnight-900/10 px-2.5 text-[10px] font-semibold text-charcoal-600 hover:bg-mint-50">View</button>
          {['pending', 'failed'].includes(refund.status) && (
            <button onClick={() => setTarget(refund)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-midnight-900 px-2.5 text-[10px] font-semibold text-lime hover:bg-midnight-800"><RotateCcw className="h-3 w-3" /> {refund.status === 'failed' ? 'Retry' : 'Process'}</button>
          )}
        </div>
      ),
    },
  ]

  if (isLoading) return <PageLoader label="Loading refunds" />

  const completedValue = refunds.filter((refund) => refund.status === 'completed').reduce((sum, refund) => sum + refund.amount, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bookings & finance"
        title="Refunds"
        description="Refunds are executed by the process-refund edge function against Paystack. Preview mode never contacts Paystack."
        actions={<ExportButton filename="ev-naija-refunds.csv" rows={filtered.map((refund) => ({ amount: refund.amount, booking: refund.booking?.booking_reference ?? refund.booking_id, payment: refund.payment?.reference ?? refund.payment_id, reason: refund.reason, status: refund.status, createdAt: refund.created_at, processedAt: refund.processed_at ?? '' }))} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Pending refunds', value: counts.pending, icon: Clock, tone: 'text-amber-700', hint: 'Awaiting processing' },
          { label: 'Processing', value: counts.processing, icon: RotateCcw, tone: 'text-amber-700', hint: 'Sent to Paystack' },
          { label: 'Completed', value: counts.completed, icon: CheckCircle2, tone: 'text-emerald-700', hint: formatNaira(completedValue, { compact: true }) },
          { label: 'Failed', value: counts.failed, icon: XCircle, tone: 'text-red-500', hint: 'Needs retry or manual review' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
            <div className="flex items-center justify-between"><p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{stat.label}</p><stat.icon className={`h-4 w-4 ${stat.tone}`} /></div>
            <p className={`mt-2 font-mono text-xl font-medium ${stat.tone}`}>{stat.value}</p>
            <p className="mt-0.5 text-[9.5px] text-muted">{stat.hint}</p>
          </div>
        ))}
      </div>

      {isPreview && <InfoNote title="Preview mode" tone="warning">Refund processing updates sample data only. Connect Supabase and Paystack secrets to exercise real refunds.</InfoNote>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter}
          onChange={(value) => { setFilter(value); setPage(1) }}
          tabs={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'pending', label: 'Pending', count: counts.pending },
            { value: 'processing', label: 'Processing', count: counts.processing },
            { value: 'completed', label: 'Completed', count: counts.completed },
            { value: 'failed', label: 'Failed', count: counts.failed },
          ]}
        />
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search reason, booking or payment" className="input-base h-9 pl-9 text-[11px]" />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        minWidth={780}
        empty={<TableEmpty title="No refunds in this view" description="Refund requests raised by support or customers will appear here." />}
        mobileRender={(refund) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[12px] font-medium text-midnight-900">{formatNaira(refund.amount)}</p>
                <p className="font-mono text-[9px] text-muted">{refund.booking?.booking_reference ?? refund.booking_id}</p>
              </div>
              <Badge tone={TONE[refund.status]}>{refund.status}</Badge>
            </div>
            <p className="mt-2 line-clamp-2 text-[10px] text-muted">{refund.reason}</p>
          </div>
        )}
      />
      <Pagination page={page} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={12} />

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Refund details" description={detail ? formatNaira(detail.amount) : undefined} footer={<Button variant="outline" onClick={() => setDetail(null)}>Close</Button>}>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl bg-mint-50 px-4 py-3">
              <div>
                <p className="text-[9px] uppercase tracking-[0.12em] text-muted">Refund amount</p>
                <p className="font-mono text-xl font-medium text-midnight-900">{formatNaira(detail.amount)}</p>
              </div>
              <Badge tone={TONE[detail.status]}>{detail.status}</Badge>
            </div>
            <div className="divide-y divide-midnight-900/[0.06] rounded-2xl border border-midnight-900/[0.07] px-4">
              <DetailRow label="Booking" value={detail.booking?.booking_reference ?? detail.booking_id} mono />
              <DetailRow label="Payment" value={detail.payment?.reference ?? detail.payment_id} mono />
              <DetailRow label="Paystack refund ref" value={detail.paystack_refund_reference ?? '—'} mono />
              <DetailRow label="Requested" value={formatDateTime(detail.created_at)} />
              <DetailRow label="Processed" value={detail.processed_at ? formatDateTime(detail.processed_at) : '—'} />
            </div>
            <div className="rounded-xl bg-charcoal-50 px-3 py-2.5">
              <p className="text-[8.5px] uppercase tracking-[0.12em] text-muted">Reason</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-charcoal-600">{detail.reason}</p>
            </div>
            {['pending', 'failed'].includes(detail.status) && (
              <div className="flex justify-end"><Button onClick={() => { setTarget(detail); setDetail(null) }}><RotateCcw className="h-4 w-4" /> {detail.status === 'failed' ? 'Retry refund' : 'Process refund'}</Button></div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={target?.status === 'failed' ? 'Retry refund' : 'Process refund'}
        description={target ? `${formatNaira(target.amount)} · ${target.booking?.booking_reference ?? target.booking_id}` : undefined}
        footer={<><Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button><Button loading={working} onClick={process}><RotateCcw className="h-4 w-4" /> Confirm refund</Button></>}
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[10.5px] leading-relaxed text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            This sends a real refund request to Paystack once configured. Verify the amount and booking before continuing.
          </div>
          <div className="rounded-xl bg-mint-50 px-3 py-2.5">
            <p className="text-[8.5px] uppercase tracking-[0.12em] text-muted">Original reason</p>
            <p className="mt-0.5 text-[11px] text-charcoal-600">{target?.reason}</p>
          </div>
          <Field label="Internal processing note (optional)">
            <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. Approved by support after charger outage." />
          </Field>
        </div>
      </Modal>

      <div className="flex items-start gap-2 rounded-2xl border border-midnight-900/[0.07] bg-white px-4 py-3.5">
        <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" />
        <p className="text-[10.5px] leading-relaxed text-charcoal-500">
          Refunds reverse the original Paystack transaction and are recorded in the ledger. Partial refunds are supported
          by the edge function; never issue a refund outside this queue.
        </p>
      </div>
    </div>
  )
}
