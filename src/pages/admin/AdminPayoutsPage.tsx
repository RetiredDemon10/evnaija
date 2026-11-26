import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Banknote, CheckCircle2, Clock, Landmark, Search, Send, Wallet, XCircle } from 'lucide-react'
import { listPayouts, processPayoutRemote, setPayoutStatus, writeAuditLog } from '@/services/admin'
import type { PayoutRequest } from '@/types'
import { PageHeader, DataTable, Pagination, Tabs, type Column } from '@/components/ui/Data'
import { PayoutStatusBadge } from '@/components/booking/StatusBadges'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Field, Textarea } from '@/components/ui/Form'
import { DetailRow, ExportButton, InfoNote, TableEmpty, usePaged } from '@/components/dashboard/Kit'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatDateTime, formatNaira } from '@/lib/utils'

type Filter = 'all' | 'pending' | 'approved' | 'processing' | 'paid' | 'rejected'
type Action = { payout: PayoutRequest; type: 'approved' | 'rejected' | 'transfer' }

export default function AdminPayoutsPage() {
  const { user, isPreview } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const [filter, setFilter] = useState<Filter>((params.get('status') as Filter) ?? 'all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [action, setAction] = useState<Action | null>(null)
  const [detail, setDetail] = useState<PayoutRequest | null>(null)
  const [notes, setNotes] = useState('')
  const [working, setWorking] = useState(false)
  usePageTitle('Payout management')

  const { data: payouts = [], isLoading } = useQuery({ queryKey: ['admin-payouts'], queryFn: listPayouts })

  const counts = useMemo(() => ({
    all: payouts.length,
    pending: payouts.filter((payout) => payout.status === 'pending').length,
    approved: payouts.filter((payout) => payout.status === 'approved').length,
    processing: payouts.filter((payout) => payout.status === 'processing').length,
    paid: payouts.filter((payout) => payout.status === 'paid').length,
    rejected: payouts.filter((payout) => payout.status === 'rejected').length,
  }), [payouts])

  const pendingValue = payouts.filter((payout) => payout.status === 'pending').reduce((sum, payout) => sum + payout.amount, 0)
  const approvedValue = payouts.filter((payout) => payout.status === 'approved').reduce((sum, payout) => sum + payout.amount, 0)
  const paidValue = payouts.filter((payout) => payout.status === 'paid').reduce((sum, payout) => sum + payout.amount, 0)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return payouts.filter((payout) => {
      const matchesFilter = filter === 'all' || payout.status === filter
      const matchesSearch = !term || (payout.operator?.business_name ?? '').toLowerCase().includes(term) || (payout.account?.account_number ?? '').includes(term) || payout.id.toLowerCase().includes(term)
      return matchesFilter && matchesSearch
    })
  }, [payouts, filter, search])

  const { rows, pageCount } = usePaged(filtered, 12, page)

  const openAction = (payout: PayoutRequest, type: 'approved' | 'rejected' | 'transfer') => {
    setAction({ payout, type })
    setNotes('')
  }

  const submit = async () => {
    if (!action) return
    if (action.type === 'rejected' && notes.trim().length < 6) {
      toast.error('Add a rejection reason', 'The operator needs to know why the payout was declined.')
      return
    }
    setWorking(true)
    try {
      if (action.type === 'transfer') {
        await processPayoutRemote(action.payout.id)
        if (user) await writeAuditLog(user.id, 'payout.transfer_sent', 'payout_request', action.payout.id, { amount: action.payout.amount, operator: action.payout.operator?.business_name })
        await queryClient.invalidateQueries({ queryKey: ['admin-payouts'] })
        await queryClient.invalidateQueries({ queryKey: ['admin-ledger'] })
        await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
        toast.success('Transfer sent', `${formatNaira(action?.payout.amount ?? 0)} is on its way to ${action.payout.account?.bank_name ?? 'the operator'}.`)
      } else {
        await setPayoutStatus(action.payout.id, action.type, notes.trim() || undefined)
        if (user) await writeAuditLog(user.id, `payout.${action.type}`, 'payout_request', action.payout.id, { amount: action.payout.amount, notes: notes.trim() || undefined })
        await queryClient.invalidateQueries({ queryKey: ['admin-payouts'] })
        await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
        await queryClient.invalidateQueries({ queryKey: ['operator-payouts'] })
        toast.success(action.type === 'approved' ? 'Payout approved' : 'Payout rejected', action.type === 'approved' ? 'You can now send the transfer from this queue.' : 'The operator has been notified and their balance remains available.')
      }
      setAction(null)
      setDetail(null)
      setNotes('')
    } catch (error) {
      toast.error('Could not update payout', (error as Error).message)
    } finally {
      setWorking(false)
    }
  }

  const columns: Column<PayoutRequest>[] = [
    {
      key: 'operator',
      header: 'Operator',
      render: (payout) => (
        <div>
          <p className="text-[11.5px] font-semibold text-midnight-900">{payout.operator?.business_name ?? 'Operator'}</p>
          <p className="text-[9.5px] text-muted">{payout.operator?.email ?? payout.operator_id}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (payout) => <span className="font-mono text-[12px] font-medium text-midnight-900">{formatNaira(payout.amount)}</span>,
    },
    {
      key: 'account',
      header: 'Destination',
      render: (payout) => (
        <div>
          <p className="text-[10.5px] text-charcoal-700">{payout.account?.bank_name ?? '—'}</p>
          <p className="font-mono text-[9px] text-muted">{payout.account?.account_number ?? '—'} · {payout.account?.account_name ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'requested',
      header: 'Requested',
      render: (payout) => <span className="text-[10px] text-muted">{formatDate(payout.requested_at, 'dd MMM · HH:mm')}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (payout) => <PayoutStatusBadge status={payout.status} />,
    },
    {
      key: 'actions',
      header: '',
      render: (payout) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => setDetail(payout)} className="inline-flex h-8 items-center rounded-lg border border-midnight-900/10 px-2.5 text-[10px] font-semibold text-charcoal-600 hover:bg-mint-50">View</button>
          {payout.status === 'pending' && (
            <>
              <button onClick={() => openAction(payout, 'approved')} className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="h-3 w-3" /> Approve</button>
              <button onClick={() => openAction(payout, 'rejected')} className="inline-flex h-8 items-center gap-1 rounded-lg bg-red-50 px-2.5 text-[10px] font-semibold text-red-600 hover:bg-red-100"><XCircle className="h-3 w-3" /> Reject</button>
            </>
          )}
          {payout.status === 'approved' && (
            <>
              <button onClick={() => openAction(payout, 'transfer')} className="inline-flex h-8 items-center gap-1 rounded-lg bg-midnight-900 px-2.5 text-[10px] font-semibold text-lime hover:bg-midnight-800"><Send className="h-3 w-3" /> Send transfer</button>
              <button onClick={() => openAction(payout, 'rejected')} className="inline-flex h-8 items-center rounded-lg bg-red-50 px-2.5 text-[10px] font-semibold text-red-600 hover:bg-red-100">Reject</button>
            </>
          )}
        </div>
      ),
    },
  ]

  if (isLoading) return <PageLoader label="Loading payouts" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bookings & finance"
        title="Payout management"
        description="Review operator withdrawals, approve balances and trigger Paystack transfers. Transfers are irreversible after release."
        actions={<ExportButton filename="ev-naija-payouts.csv" rows={filtered.map((payout) => ({ operator: payout.operator?.business_name ?? payout.operator_id, amount: payout.amount, bank: payout.account?.bank_name ?? '', account: payout.account?.account_number ?? '', status: payout.status, requested: payout.requested_at, processed: payout.processed_at ?? '', transferRef: payout.paystack_transfer_reference ?? '' }))} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl bg-midnight-950 p-5 text-white">
          <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/40">Pending approval</p>
          <p className="mt-1.5 font-mono text-2xl font-medium text-lime">{formatNaira(pendingValue)}</p>
          <p className="mt-1 text-[9.5px] text-white/40">{counts.pending} requests</p>
        </div>
        <div className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">Approved, not sent</p>
          <p className="mt-2 font-mono text-xl font-medium text-amber-700">{formatNaira(approvedValue)}</p>
          <p className="mt-0.5 text-[9.5px] text-muted">{counts.approved} awaiting transfer</p>
        </div>
        <div className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">Paid out</p>
          <p className="mt-2 font-mono text-xl font-medium text-emerald-700">{formatNaira(paidValue)}</p>
          <p className="mt-0.5 text-[9.5px] text-muted">{counts.paid} completed transfers</p>
        </div>
        <div className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">Rejected</p>
          <p className="mt-2 font-mono text-xl font-medium text-red-500">{counts.rejected}</p>
          <p className="mt-0.5 text-[9.5px] text-muted">Balance returned to operator</p>
        </div>
      </div>

      {isPreview && <InfoNote title="Preview mode" tone="warning">Transfer actions update sample data and never contact Paystack. Production requires the <code>operator-payout</code> edge function and Paystack transfer secrets.</InfoNote>}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          value={filter}
          onChange={(value) => { setFilter(value); setPage(1) }}
          tabs={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'pending', label: 'Pending', count: counts.pending },
            { value: 'approved', label: 'Approved', count: counts.approved },
            { value: 'processing', label: 'Processing', count: counts.processing },
            { value: 'paid', label: 'Paid', count: counts.paid },
            { value: 'rejected', label: 'Rejected', count: counts.rejected },
          ]}
        />
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search operator, account or ID" className="input-base h-9 pl-9 text-[11px]" />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        minWidth={900}
        empty={<TableEmpty title="No payouts in this view" description="Operator withdrawal requests will appear here for review." />}
        mobileRender={(payout) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[12px] font-semibold text-midnight-900">{payout.operator?.business_name ?? 'Operator'}</p>
                <p className="font-mono text-[9px] text-muted">{payout.account?.bank_name} · {payout.account?.account_number}</p>
              </div>
              <PayoutStatusBadge status={payout.status} />
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-midnight-900/[0.06] pt-2 text-[10px]">
              <span className="text-muted">{formatDate(payout.requested_at)}</span>
              <span className="font-mono font-medium text-midnight-900">{formatNaira(payout.amount)}</span>
            </div>
            {payout.status === 'approved' && (
              <button onClick={() => openAction(payout, 'transfer')} className="mt-2 inline-flex h-8 items-center gap-1 rounded-lg bg-midnight-900 px-2.5 text-[10px] font-semibold text-lime"><Send className="h-3 w-3" /> Send transfer</button>
            )}
          </div>
        )}
      />
      <Pagination page={page} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={12} />

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Payout details" description={detail?.operator?.business_name} footer={<Button variant="outline" onClick={() => setDetail(null)}>Close</Button>}>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl bg-mint-50 px-4 py-3">
              <div>
                <p className="text-[9px] uppercase tracking-[0.12em] text-muted">Requested amount</p>
                <p className="font-mono text-xl font-medium text-midnight-900">{formatNaira(detail.amount)}</p>
              </div>
              <PayoutStatusBadge status={detail.status} />
            </div>
            <div className="divide-y divide-midnight-900/[0.06] rounded-2xl border border-midnight-900/[0.07] px-4">
              <DetailRow label="Operator" value={detail.operator?.business_name ?? detail.operator_id} />
              <DetailRow label="Bank" value={detail.account?.bank_name ?? '—'} />
              <DetailRow label="Account name" value={detail.account?.account_name ?? '—'} />
              <DetailRow label="Account number" value={detail.account?.account_number ?? '—'} mono />
              <DetailRow label="Paystack recipient" value={detail.account?.recipient_code ?? 'Created on first transfer'} mono />
              <DetailRow label="Requested" value={formatDateTime(detail.requested_at)} />
              <DetailRow label="Processed" value={detail.processed_at ? formatDateTime(detail.processed_at) : '—'} />
              <DetailRow label="Transfer reference" value={detail.paystack_transfer_reference ?? '—'} mono />
            </div>
            {detail.notes && <p className="rounded-xl bg-charcoal-50 px-3 py-2.5 text-[10.5px] text-charcoal-600"><strong>Operator note:</strong> {detail.notes}</p>}
            {detail.admin_notes && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-[10.5px] text-red-700"><strong>Admin note:</strong> {detail.admin_notes}</p>}
            {detail.status === 'pending' && (
              <div className="flex justify-end gap-2">
                <Button variant="danger" onClick={() => { openAction(detail, 'rejected'); setDetail(null) }}>Reject</Button>
                <Button onClick={() => { openAction(detail, 'approved'); setDetail(null) }}><CheckCircle2 className="h-4 w-4" /> Approve</Button>
              </div>
            )}
            {detail.status === 'approved' && (
              <div className="flex justify-end"><Button onClick={() => { openAction(detail, 'transfer'); setDetail(null) }}><Send className="h-4 w-4" /> Send transfer</Button></div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title={action?.type === 'approved' ? 'Approve payout' : action?.type === 'rejected' ? 'Reject payout' : 'Send bank transfer'}
        description={action ? `${formatNaira(action?.payout.amount ?? 0)} · ${action.payout.operator?.business_name ?? 'Operator'}` : undefined}
        footer={<><Button variant="outline" onClick={() => setAction(null)}>Cancel</Button><Button variant={action?.type === 'rejected' ? 'danger' : 'primary'} loading={working} onClick={submit}>{action?.type === 'approved' ? 'Approve payout' : action?.type === 'rejected' ? 'Reject payout' : 'Send transfer'}</Button></>}
      >
        {action?.type === 'transfer' ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[10.5px] leading-relaxed text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              This executes a Paystack transfer to the saved account. Confirm the account name and number before sending.
            </div>
            <div className="rounded-2xl bg-mint-50 px-4 py-3">
              <p className="flex items-center gap-1 text-[9px] uppercase tracking-[0.12em] text-muted"><Landmark className="h-2.5 w-2.5" /> Destination</p>
              <p className="mt-1 text-[12px] font-semibold text-midnight-900">{action.payout.account?.bank_name}</p>
              <p className="font-mono text-[11px] text-charcoal-600">{action.payout.account?.account_number} · {action.payout.account?.account_name}</p>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-midnight-950 px-4 py-3 text-white">
              <span className="text-[10px] uppercase tracking-[0.12em] text-white/50">Amount</span>
              <span className="font-mono text-lg font-medium text-lime">{formatNaira(action?.payout.amount ?? 0)}</span>
            </div>
          </div>
        ) : action?.type === 'rejected' ? (
          <Field label="Rejection reason" required hint="Shown to the operator. Their available balance is unaffected.">
            <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. Account name does not match the verified business name. Update the payout account and re-request." />
          </Field>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl bg-lime/15 px-4 py-3 text-[11px] leading-relaxed text-charcoal-600">
              Approving confirms the requested amount is available in the operator ledger and the destination account is
              verified. It does not send money yet.
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-mint-50 px-4 py-3">
              <span className="text-[10.5px] text-charcoal-600">Operator</span>
              <span className="text-[11px] font-semibold text-midnight-900">{action?.payout.operator?.business_name}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-mint-50 px-4 py-3">
              <span className="text-[10.5px] text-charcoal-600">Amount</span>
              <span className="font-mono text-[12px] font-medium text-midnight-900">{formatNaira(action?.payout.amount ?? 0)}</span>
            </div>
            <Field label="Approval note (optional)">
              <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. Ledger reconciled against Paystack settlements." />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  )
}
