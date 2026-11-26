import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, FileClock, Search, ShieldCheck } from 'lucide-react'
import { listAuditLogs } from '@/services/admin'
import type { AdminAuditLog } from '@/types'
import { PageHeader, DataTable, Pagination, type Column } from '@/components/ui/Data'
import { Avatar } from '@/components/ui/Brand'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ExportButton, SelectFilter, TableEmpty, usePaged } from '@/components/dashboard/Kit'
import { PageLoader } from '@/components/ui/Feedback'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDateTime, humanize } from '@/lib/utils'

const ACTION_TONE = (action: string): 'success' | 'danger' | 'warning' | 'neutral' | 'lime' => {
  if (action.includes('rejected') || action.includes('suspended') || action.includes('hidden')) return 'danger'
  if (action.includes('approved') || action.includes('activated') || action.includes('published')) return 'success'
  if (action.includes('updated') || action.includes('broadcast')) return 'warning'
  return 'neutral'
}

export default function AdminAuditPage() {
  const [search, setSearch] = useState('')
  const [entity, setEntity] = useState('all')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<AdminAuditLog | null>(null)
  usePageTitle('Audit logs')

  const { data: logs = [], isLoading } = useQuery({ queryKey: ['admin-audit'], queryFn: listAuditLogs })

  const entities = useMemo(() => Array.from(new Set(logs.map((log) => log.entity_type))).sort(), [logs])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return logs.filter((log) => {
      const matchesEntity = entity === 'all' || log.entity_type === entity
      const matchesSearch =
        !term ||
        log.action.toLowerCase().includes(term) ||
        (log.admin?.full_name ?? '').toLowerCase().includes(term) ||
        (log.entity_id ?? '').toLowerCase().includes(term) ||
        JSON.stringify(log.details ?? {}).toLowerCase().includes(term)
      return matchesEntity && matchesSearch
    })
  }, [logs, entity, search])

  const { rows, pageCount } = usePaged(filtered, 16, page)

  const columns: Column<AdminAuditLog>[] = [
    {
      key: 'action',
      header: 'Action',
      render: (log) => (
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint text-midnight-800">
            <Activity className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[11.5px] font-semibold text-midnight-900">{humanize(log.action.replace('.', ' — '))}</p>
            <p className="font-mono text-[8.5px] text-muted">{log.action}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'admin',
      header: 'Admin',
      render: (log) => (
        <div className="flex items-center gap-2">
          <Avatar name={log.admin?.full_name ?? 'Admin'} src={log.admin?.avatar_url} size={26} />
          <div>
            <p className="text-[10.5px] font-medium text-charcoal-700">{log.admin?.full_name ?? 'System'}</p>
            <p className="text-[9px] text-muted">{log.admin?.email ?? ''}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'entity',
      header: 'Entity',
      render: (log) => (
        <div>
          <Badge tone="neutral">{humanize(log.entity_type)}</Badge>
          {log.entity_id && <p className="mt-1 max-w-[150px] truncate font-mono text-[8.5px] text-muted">{log.entity_id}</p>}
        </div>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      render: (log) => {
        const details = log.details ?? {}
        const summary = Object.entries(details)
          .slice(0, 2)
          .map(([key, value]) => `${humanize(key)}: ${String(value)}`)
          .join(' · ')
        return <p className="max-w-[280px] truncate text-[9.5px] text-muted">{summary || '—'}</p>
      },
    },
    {
      key: 'time',
      header: 'When',
      render: (log) => (
        <div>
          <p className="text-[10px] text-charcoal-600">{formatDateTime(log.created_at)}</p>
          <p className="font-mono text-[8.5px] text-muted">{log.id.slice(-10)}</p>
        </div>
      ),
    },
    {
      key: 'view',
      header: '',
      render: (log) => (
        <button
          onClick={() => setDetail(log)}
          className="inline-flex h-8 items-center rounded-lg border border-midnight-900/10 px-2.5 text-[10px] font-semibold text-charcoal-600 hover:bg-mint-50"
        >
          Inspect
        </button>
      ),
    },
  ]

  if (isLoading) return <PageLoader label="Loading audit logs" />

  const today = logs.filter((log) => new Date(log.created_at).toDateString() === new Date().toDateString()).length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuration"
        title="Admin audit logs"
        description="An append-only record of privileged actions. Use it to investigate disputes, verify approvals and meet internal controls."
        actions={
          <ExportButton
            filename="ev-naija-audit.csv"
            rows={filtered.map((log) => ({
              time: log.created_at,
              admin: log.admin?.full_name ?? log.admin_id,
              email: log.admin?.email ?? '',
              action: log.action,
              entityType: log.entity_type,
              entityId: log.entity_id ?? '',
              details: JSON.stringify(log.details ?? {}),
            }))}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Logged actions', value: logs.length, hint: 'Recent activity retained', icon: FileClock },
          { label: 'Today', value: today, hint: 'Actions in the last 24h', icon: Activity },
          { label: 'Administrators', value: new Set(logs.map((log) => log.admin_id)).size, hint: 'Distinct actors', icon: ShieldCheck },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{stat.label}</p>
              <stat.icon className="h-4 w-4 text-midnight-700" />
            </div>
            <p className="mt-2 font-mono text-xl font-medium text-midnight-900">{stat.value}</p>
            <p className="mt-0.5 text-[9.5px] text-muted">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search action, admin, entity or detail"
            className="input-base h-10 pl-9 text-[12px]"
          />
        </div>
        <SelectFilter
          value={entity}
          onChange={(value) => {
            setEntity(value)
            setPage(1)
          }}
          label="Entity"
          options={[{ value: 'all', label: 'All entities' }, ...entities.map((value) => ({ value, label: humanize(value) }))]}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        minWidth={900}
        empty={<TableEmpty title="No audit entries in this view" description="Privileged actions will be recorded here automatically." />}
        mobileRender={(log) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11.5px] font-semibold text-midnight-900">{humanize(log.action.replace('.', ' — '))}</p>
                <p className="text-[9.5px] text-muted">{log.admin?.full_name ?? 'System'} · {formatDateTime(log.created_at)}</p>
              </div>
              <Badge tone={ACTION_TONE(log.action)}>{log.entity_type}</Badge>
            </div>
            <button onClick={() => setDetail(log)} className="mt-2 text-[10.5px] font-semibold text-lime-700">
              Inspect details
            </button>
          </div>
        )}
      />
      <Pagination page={page} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={16} />

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Audit entry"
        description={detail ? formatDateTime(detail.created_at) : undefined}
        footer={
          <button
            onClick={() => setDetail(null)}
            className="inline-flex h-10 items-center rounded-xl border border-midnight-900/10 px-4 text-[11px] font-semibold text-charcoal-600"
          >
            Close
          </button>
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl bg-mint-50 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Avatar name={detail.admin?.full_name ?? 'Admin'} src={detail.admin?.avatar_url} size={38} />
                <div>
                  <p className="text-[12px] font-semibold text-midnight-900">{detail.admin?.full_name ?? 'System'}</p>
                  <p className="text-[9.5px] text-muted">{detail.admin?.email ?? detail.admin_id}</p>
                </div>
              </div>
              <Badge tone={ACTION_TONE(detail.action)}>{detail.action}</Badge>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-charcoal-50 px-3 py-2.5">
                <p className="text-[8.5px] uppercase tracking-[0.12em] text-muted">Entity type</p>
                <p className="mt-0.5 text-[11px] text-charcoal-700">{humanize(detail.entity_type)}</p>
              </div>
              <div className="rounded-xl bg-charcoal-50 px-3 py-2.5">
                <p className="text-[8.5px] uppercase tracking-[0.12em] text-muted">Entity ID</p>
                <p className="mt-0.5 break-all font-mono text-[9.5px] text-charcoal-700">{detail.entity_id ?? '—'}</p>
              </div>
            </div>

            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">Recorded details</p>
              <pre className="mt-1.5 max-h-64 overflow-auto rounded-xl bg-midnight-950 p-3 font-mono text-[9.5px] leading-relaxed text-lime/90">
{JSON.stringify(detail.details ?? {}, null, 2)}
              </pre>
            </div>

            <p className="text-[9.5px] leading-relaxed text-muted">
              Audit entries cannot be edited or deleted from the dashboard. Retain them according to your data policy.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
