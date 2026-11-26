import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  BadgeCheck,
  Ban,
  Building2,
  CheckCircle2,
  Clock,
  FileCheck2,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldAlert,
  Store,
  XCircle,
} from 'lucide-react'
import {
  listAllStations,
  listOperators,
  setOperatorStatus,
  writeAuditLog,
} from '@/services/admin'
import { listOperatorDocuments } from '@/services/operator'
import type { OperatorProfile } from '@/types'
import { PageHeader, DataTable, Pagination, Tabs, type Column } from '@/components/ui/Data'
import { Avatar } from '@/components/ui/Brand'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Field, Textarea } from '@/components/ui/Form'
import { ExportButton, TableEmpty, usePaged } from '@/components/dashboard/Kit'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate } from '@/lib/utils'

type Filter = 'all' | 'pending' | 'approved' | 'rejected' | 'suspended'

const STATUS_TONE: Record<OperatorProfile['status'], 'success' | 'warning' | 'danger' | 'neutral'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
  suspended: 'danger',
}

export default function AdminOperatorsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const [filter, setFilter] = useState<Filter>((params.get('status') as Filter) ?? 'all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<OperatorProfile | null>(null)
  const [action, setAction] = useState<{ operator: OperatorProfile; type: 'approved' | 'rejected' | 'suspended' } | null>(null)
  const [reason, setReason] = useState('')
  const [working, setWorking] = useState(false)
  usePageTitle('Station operators')

  const { data: operators = [], isLoading } = useQuery({ queryKey: ['admin-operators'], queryFn: listOperators })
  const { data: stations = [] } = useQuery({ queryKey: ['admin-stations'], queryFn: listAllStations })

  useEffect(() => {
    const focus = params.get('focus')
    if (focus) {
      const match = operators.find((operator) => operator.id === focus)
      if (match) setDetail(match)
    }
  }, [params, operators])

  const documentsQuery = useQuery({
    queryKey: ['admin-operator-documents', detail?.id],
    queryFn: () => listOperatorDocuments(detail!.id),
    enabled: Boolean(detail?.id),
  })

  const counts = useMemo(() => ({
    all: operators.length,
    pending: operators.filter((operator) => operator.status === 'pending').length,
    approved: operators.filter((operator) => operator.status === 'approved').length,
    rejected: operators.filter((operator) => operator.status === 'rejected').length,
    suspended: operators.filter((operator) => operator.status === 'suspended').length,
  }), [operators])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return operators.filter((operator) => {
      const matchesFilter = filter === 'all' || operator.status === filter
      const matchesSearch =
        !term ||
        operator.business_name.toLowerCase().includes(term) ||
        operator.owner_name.toLowerCase().includes(term) ||
        operator.email.toLowerCase().includes(term)
      return matchesFilter && matchesSearch
    })
  }, [operators, filter, search])

  const { rows, pageCount } = usePaged(filtered, 12, page)

  const openAction = (operator: OperatorProfile, type: 'approved' | 'rejected' | 'suspended') => {
    setAction({ operator, type })
    setReason('')
  }

  const submitAction = async () => {
    if (!action) return
    if ((action.type === 'rejected' || action.type === 'suspended') && reason.trim().length < 8) {
      toast.error('Add a reason', 'Operators need a clear reason to correct their submission.')
      return
    }
    setWorking(true)
    try {
      await setOperatorStatus(action.operator.id, action.type, reason.trim() || undefined)
      if (user) {
        await writeAuditLog(user.id, `operator.${action.type}`, 'operator_profile', action.operator.id, {
          business: action.operator.business_name,
          reason: reason.trim() || undefined,
        })
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-operators'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
      await queryClient.invalidateQueries({ queryKey: ['operator-profile'] })
      toast.success(
        action.type === 'approved' ? 'Operator approved' : action.type === 'rejected' ? 'Application rejected' : 'Operator suspended',
        action.type === 'approved' ? 'They can now publish approved stations and receive bookings.' : 'The operator has been notified with your reason.',
      )
      setAction(null)
      setDetail(null)
    } catch (error) {
      toast.error('Could not update operator', (error as Error).message)
    } finally {
      setWorking(false)
    }
  }

  const stationCount = (operatorId: string) => stations.filter((station) => station.operator_id === operatorId).length

  const columns: Column<OperatorProfile>[] = [
    {
      key: 'business',
      header: 'Business',
      render: (operator) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={operator.business_name} src={operator.logo_url} size={34} />
          <div>
            <p className="text-[12px] font-semibold text-midnight-900">{operator.business_name}</p>
            <p className="text-[10px] text-muted">{operator.owner_name}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (operator) => (
        <div className="space-y-0.5 text-[10.5px] text-charcoal-600">
          <p className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted" /> {operator.email}</p>
          <p className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted" /> {operator.phone}</p>
        </div>
      ),
    },
    {
      key: 'stations',
      header: 'Stations',
      render: (operator) => <span className="font-mono text-[12px] text-midnight-900">{stationCount(operator.id)}</span>,
    },
    {
      key: 'applied',
      header: 'Applied',
      render: (operator) => <span className="text-[10.5px] text-muted">{formatDate(operator.created_at)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (operator) => <Badge tone={STATUS_TONE[operator.status]}>{operator.status}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (operator) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => setDetail(operator)} className="inline-flex h-8 items-center rounded-lg border border-midnight-900/10 px-2.5 text-[10px] font-semibold text-charcoal-600 hover:bg-mint-50">Review</button>
          {operator.status === 'pending' && (
            <>
              <button onClick={() => openAction(operator, 'approved')} className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="h-3 w-3" /> Approve</button>
              <button onClick={() => openAction(operator, 'rejected')} className="inline-flex h-8 items-center gap-1 rounded-lg bg-red-50 px-2.5 text-[10px] font-semibold text-red-600 hover:bg-red-100"><XCircle className="h-3 w-3" /> Reject</button>
            </>
          )}
          {operator.status === 'approved' && (
            <button onClick={() => openAction(operator, 'suspended')} className="inline-flex h-8 items-center gap-1 rounded-lg bg-red-50 px-2.5 text-[10px] font-semibold text-red-600 hover:bg-red-100"><Ban className="h-3 w-3" /> Suspend</button>
          )}
          {(operator.status === 'suspended' || operator.status === 'rejected') && (
            <button onClick={() => openAction(operator, 'approved')} className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"><BadgeCheck className="h-3 w-3" /> Approve</button>
          )}
        </div>
      ),
    },
  ]

  if (isLoading) return <PageLoader label="Loading operators" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketplace"
        title="Station operators"
        description="Review business applications, verify documents and manage operator access. Approving an operator does not automatically approve their stations."
        actions={<ExportButton filename="ev-naija-operators.csv" rows={filtered.map((operator) => ({ business: operator.business_name, owner: operator.owner_name, email: operator.email, phone: operator.phone, status: operator.status, stations: stationCount(operator.id), applied: operator.created_at }))} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Pending applications', value: counts.pending, tone: 'text-amber-700', icon: Clock },
          { label: 'Approved operators', value: counts.approved, tone: 'text-emerald-700', icon: BadgeCheck },
          { label: 'Rejected', value: counts.rejected, tone: 'text-red-500', icon: XCircle },
          { label: 'Suspended', value: counts.suspended, tone: 'text-red-500', icon: ShieldAlert },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
            <div className="flex items-center justify-between"><p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{stat.label}</p><stat.icon className={`h-4 w-4 ${stat.tone}`} /></div>
            <p className={`mt-2 font-mono text-xl font-medium ${stat.tone}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          value={filter}
          onChange={(value) => { setFilter(value); setPage(1) }}
          tabs={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'pending', label: 'Pending', count: counts.pending },
            { value: 'approved', label: 'Approved', count: counts.approved },
            { value: 'rejected', label: 'Rejected', count: counts.rejected },
            { value: 'suspended', label: 'Suspended', count: counts.suspended },
          ]}
        />
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search business, owner or email" className="input-base h-9 pl-9 text-[11px]" />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        minWidth={760}
        empty={<TableEmpty title="No operators in this view" description="Operator applications will appear here for review." />}
        mobileRender={(operator) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Avatar name={operator.business_name} src={operator.logo_url} size={34} />
                <div>
                  <p className="text-[12.5px] font-semibold text-midnight-900">{operator.business_name}</p>
                  <p className="text-[10px] text-muted">{operator.owner_name}</p>
                </div>
              </div>
              <Badge tone={STATUS_TONE[operator.status]}>{operator.status}</Badge>
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-midnight-900/[0.06] pt-2.5">
              <p className="text-[10px] text-muted">{stationCount(operator.id)} stations · {formatDate(operator.created_at)}</p>
              <button onClick={() => setDetail(operator)} className="text-[10.5px] font-semibold text-lime-700">Review</button>
            </div>
          </div>
        )}
      />
      <Pagination page={page} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={12} />

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.business_name ?? 'Operator'}
        description={detail ? `${detail.owner_name} · Applied ${formatDate(detail.created_at)}` : undefined}
        footer={
          detail ? (
            <>
              <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
              {detail.status === 'pending' && <Button variant="danger" onClick={() => openAction(detail, 'rejected')}>Reject</Button>}
              {detail.status === 'pending' && <Button onClick={() => openAction(detail, 'approved')}><CheckCircle2 className="h-4 w-4" /> Approve operator</Button>}
              {detail.status === 'approved' && <Button variant="danger" onClick={() => openAction(detail, 'suspended')}><Ban className="h-4 w-4" /> Suspend</Button>}
              {(detail.status === 'rejected' || detail.status === 'suspended') && <Button onClick={() => openAction(detail, 'approved')}><BadgeCheck className="h-4 w-4" /> Approve</Button>}
            </>
          ) : undefined
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={detail.business_name} src={detail.logo_url} size={48} />
              <div>
                <div className="flex items-center gap-2"><p className="font-display text-base font-semibold text-midnight-900">{detail.business_name}</p><Badge tone={STATUS_TONE[detail.status]}>{detail.status}</Badge></div>
                <p className="text-[10.5px] text-muted">{detail.email}</p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { icon: Store, label: 'Owner', value: detail.owner_name },
                { icon: Phone, label: 'Phone', value: detail.phone },
                { icon: Mail, label: 'Email', value: detail.email },
                { icon: FileCheck2, label: 'CAC / RC', value: detail.business_registration_number ?? 'Not provided' },
                { icon: MapPin, label: 'Business address', value: detail.business_address },
                { icon: Building2, label: 'Stations', value: `${stationCount(detail.id)} listed` },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-mint-50 px-3 py-2.5">
                  <p className="flex items-center gap-1 text-[8.5px] uppercase tracking-[0.12em] text-muted"><item.icon className="h-2.5 w-2.5" /> {item.label}</p>
                  <p className="mt-0.5 break-words text-[11px] text-charcoal-700">{item.value}</p>
                </div>
              ))}
            </div>

            {detail.business_description && <p className="rounded-xl bg-charcoal-50 px-3 py-2.5 text-[11px] leading-relaxed text-charcoal-600">{detail.business_description}</p>}

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Verification documents</p>
              {documentsQuery.isLoading ? (
                <div className="mt-2 space-y-2">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-10 animate-pulse rounded-xl bg-charcoal-50" />)}</div>
              ) : documentsQuery.data?.length ? (
                <div className="mt-2 space-y-1.5">
                  {documentsQuery.data.map((document) => (
                    <a key={document.id} href={document.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl border border-midnight-900/[0.07] px-3 py-2 transition hover:bg-mint-50">
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="h-3.5 w-3.5 text-midnight-700" />
                        <div>
                          <p className="text-[10.5px] font-semibold capitalize text-midnight-900">{document.document_type.replace(/_/g, ' ')}</p>
                          <p className="text-[9px] text-muted">{document.file_name}</p>
                        </div>
                      </div>
                      <Badge tone={document.status === 'verified' ? 'success' : document.status === 'rejected' ? 'danger' : 'warning'}>{document.status}</Badge>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[10.5px] text-amber-800">No documents uploaded yet. Do not approve until required documents are provided.</p>
              )}
            </div>

            {detail.rejection_reason && (
              <div className="rounded-xl bg-red-50 px-3 py-2.5 text-[10.5px] text-red-700"><strong>Last decision:</strong> {detail.rejection_reason}</div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title={
          action?.type === 'approved'
            ? 'Approve operator'
            : action?.type === 'rejected'
              ? 'Reject application'
              : 'Suspend operator'
        }
        description={action ? `${action.operator.business_name} · ${action.operator.owner_name}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button variant={action?.type === 'approved' ? 'primary' : 'danger'} loading={working} onClick={submitAction}>
              {action?.type === 'approved' ? 'Approve operator' : action?.type === 'rejected' ? 'Reject application' : 'Suspend operator'}
            </Button>
          </>
        }
      >
        {action?.type === 'approved' ? (
          <div className="space-y-3">
            <div className="rounded-2xl bg-lime/15 px-4 py-3 text-[11px] leading-relaxed text-charcoal-600">
              Approving confirms the business and documents are legitimate. The operator can publish approved stations and
              receive paid bookings. Payouts still depend on a verified bank account.
            </div>
            <Field label="Internal note (optional)" hint="Recorded in the audit log only.">
              <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. CAC and ownership documents verified." />
            </Field>
          </div>
        ) : (
          <Field label={action?.type === 'suspended' ? 'Suspension reason' : 'Rejection reason'} required hint="Shown to the operator so they can correct the issue.">
            <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={action?.type === 'rejected' ? 'e.g. CAC certificate is expired; please upload the renewed certificate.' : 'e.g. Account suspended pending investigation of repeated safety reports.'} />
          </Field>
        )}
      </Modal>
    </div>
  )
}
