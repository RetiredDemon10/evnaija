import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CheckCircle2, Clock, Megaphone, Search, Sparkles, XCircle } from 'lucide-react'
import { listPromotions, setPromotionStatus, writeAuditLog } from '@/services/admin'
import type { PromotionalListing } from '@/types'
import { PageHeader, DataTable, Pagination, Tabs, type Column } from '@/components/ui/Data'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/Modal'
import { ExportButton, TableEmpty, usePaged } from '@/components/dashboard/Kit'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatNaira, humanize } from '@/lib/utils'

type Filter = 'all' | 'pending' | 'active' | 'expired' | 'rejected'

const TONE: Record<PromotionalListing['status'], 'success' | 'warning' | 'danger' | 'neutral'> = {
  pending: 'warning',
  active: 'success',
  expired: 'neutral',
  rejected: 'danger',
}

export default function AdminPromotionsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [confirm, setConfirm] = useState<{ promotion: PromotionalListing; status: PromotionalListing['status'] } | null>(null)
  const [working, setWorking] = useState(false)
  usePageTitle('Promotions')

  const { data: promotions = [], isLoading } = useQuery({ queryKey: ['admin-promotions'], queryFn: listPromotions })

  const counts = useMemo(
    () => ({
      all: promotions.length,
      pending: promotions.filter((promotion) => promotion.status === 'pending').length,
      active: promotions.filter((promotion) => promotion.status === 'active').length,
      expired: promotions.filter((promotion) => promotion.status === 'expired').length,
      rejected: promotions.filter((promotion) => promotion.status === 'rejected').length,
    }),
    [promotions],
  )

  const revenue = promotions.filter((promotion) => promotion.status === 'active').reduce((sum, promotion) => sum + promotion.amount, 0)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return promotions.filter((promotion) => {
      const matchesFilter = filter === 'all' || promotion.status === filter
      const matchesSearch =
        !term ||
        (promotion.station?.name ?? '').toLowerCase().includes(term) ||
        (promotion.station?.city ?? '').toLowerCase().includes(term)
      return matchesFilter && matchesSearch
    })
  }, [promotions, filter, search])

  const { rows, pageCount } = usePaged(filtered, 10, page)

  const submit = async () => {
    if (!confirm) return
    setWorking(true)
    try {
      await setPromotionStatus(confirm.promotion.id, confirm.status)
      if (user) {
        await writeAuditLog(user.id, `promotion.${confirm.status}`, 'promotional_listing', confirm.promotion.id, {
          station: confirm.promotion.station?.name,
          amount: confirm.promotion.amount,
          placement: confirm.promotion.placement,
        })
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-promotions'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
      toast.success(
        confirm.status === 'active' ? 'Promotion activated' : confirm.status === 'rejected' ? 'Promotion rejected' : 'Promotion ended',
        confirm.status === 'active' ? 'The station now appears in the selected placements.' : 'Promotion visibility has been removed.',
      )
      setConfirm(null)
    } catch (error) {
      toast.error('Could not update promotion', (error as Error).message)
    } finally {
      setWorking(false)
    }
  }

  const columns: Column<PromotionalListing>[] = [
    {
      key: 'station',
      header: 'Station',
      render: (promotion) => (
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime/25 text-midnight-800">
            <Megaphone className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[11.5px] font-semibold text-midnight-900">{promotion.station?.name ?? 'Station'}</p>
            <p className="text-[9.5px] text-muted">{promotion.station?.city ?? ''}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'placement',
      header: 'Placement',
      render: (promotion) => <Badge tone={promotion.placement === 'both' ? 'lime' : 'neutral'}>{humanize(promotion.placement)}</Badge>,
    },
    {
      key: 'amount',
      header: 'Paid',
      render: (promotion) => <span className="font-mono text-[11.5px] font-medium text-midnight-900">{formatNaira(promotion.amount)}</span>,
    },
    {
      key: 'window',
      header: 'Schedule',
      render: (promotion) => (
        <div className="text-[10px] text-charcoal-600">
          <p>{formatDate(promotion.starts_at, 'dd MMM yyyy')} → {formatDate(promotion.ends_at, 'dd MMM yyyy')}</p>
          <p className="text-[9px] text-muted">Created {formatDate(promotion.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (promotion) => <Badge tone={TONE[promotion.status]}>{promotion.status}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (promotion) => (
        <div className="flex justify-end gap-1">
          {promotion.status === 'pending' && (
            <>
              <button
                onClick={() => setConfirm({ promotion, status: 'active' })}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                <CheckCircle2 className="h-3 w-3" /> Approve
              </button>
              <button
                onClick={() => setConfirm({ promotion, status: 'rejected' })}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-red-50 px-2.5 text-[10px] font-semibold text-red-600 hover:bg-red-100"
              >
                <XCircle className="h-3 w-3" /> Reject
              </button>
            </>
          )}
          {promotion.status === 'active' && (
            <button
              onClick={() => setConfirm({ promotion, status: 'expired' })}
              className="inline-flex h-8 items-center rounded-lg border border-midnight-900/10 px-2.5 text-[10px] font-semibold text-charcoal-600 hover:bg-mint-50"
            >
              End promotion
            </button>
          )}
        </div>
      ),
    },
  ]

  if (isLoading) return <PageLoader label="Loading promotions" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Promoted stations"
        description="Operators pay for premium visibility on the homepage and search. Approve paid placements and stop campaigns that breach policy."
        actions={
          <ExportButton
            filename="ev-naija-promotions.csv"
            rows={filtered.map((promotion) => ({
              station: promotion.station?.name ?? '',
              city: promotion.station?.city ?? '',
              placement: promotion.placement,
              amount: promotion.amount,
              starts: promotion.starts_at,
              ends: promotion.ends_at,
              status: promotion.status,
            }))}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Active placements', value: counts.active, icon: Sparkles, tone: 'text-emerald-700', hint: formatNaira(revenue, { compact: true }) + ' active value' },
          { label: 'Pending approval', value: counts.pending, icon: Clock, tone: 'text-amber-700', hint: 'Awaiting payment confirmation' },
          { label: 'Expired', value: counts.expired, icon: CalendarClock, tone: 'text-charcoal-500', hint: 'Campaign window ended' },
          { label: 'Rejected', value: counts.rejected, icon: XCircle, tone: 'text-red-500', hint: 'Not compliant or unpaid' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{stat.label}</p>
              <stat.icon className={`h-4 w-4 ${stat.tone}`} />
            </div>
            <p className={`mt-2 font-mono text-xl font-medium ${stat.tone}`}>{stat.value}</p>
            <p className="mt-0.5 text-[9.5px] text-muted">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter}
          onChange={(value) => {
            setFilter(value)
            setPage(1)
          }}
          tabs={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'pending', label: 'Pending', count: counts.pending },
            { value: 'active', label: 'Active', count: counts.active },
            { value: 'expired', label: 'Expired', count: counts.expired },
            { value: 'rejected', label: 'Rejected', count: counts.rejected },
          ]}
        />
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search station or city"
            className="input-base h-9 pl-9 text-[11px]"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        minWidth={780}
        empty={<TableEmpty title="No promotions in this view" description="Operator promotional purchases will appear here for approval." />}
        mobileRender={(promotion) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[12px] font-semibold text-midnight-900">{promotion.station?.name}</p>
                <p className="text-[9.5px] text-muted">{promotion.station?.city} · {humanize(promotion.placement)}</p>
              </div>
              <Badge tone={TONE[promotion.status]}>{promotion.status}</Badge>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-midnight-900/[0.06] pt-2 text-[10px]">
              <span className="text-muted">{formatDate(promotion.starts_at)} → {formatDate(promotion.ends_at)}</span>
              <span className="font-mono font-medium text-midnight-900">{formatNaira(promotion.amount)}</span>
            </div>
          </div>
        )}
      />
      <Pagination page={page} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={10} />

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={submit}
        title={
          confirm?.status === 'active'
            ? 'Activate promotion?'
            : confirm?.status === 'rejected'
              ? 'Reject promotion?'
              : 'End promotion?'
        }
        description={
          confirm?.status === 'active'
            ? 'Confirm payment has been received. The station will appear in the selected placements immediately.'
            : confirm?.status === 'rejected'
              ? 'The operator will lose the placement. Reject only after confirming payment failed or the listing breaches policy.'
              : 'The station will be removed from promoted placements before its scheduled end date.'
        }
        confirmLabel={confirm?.status === 'active' ? 'Activate' : confirm?.status === 'rejected' ? 'Reject' : 'End promotion'}
        danger={confirm?.status !== 'active'}
        loading={working}
      />

      <div className="flex items-start gap-2 rounded-2xl border border-midnight-900/[0.07] bg-white px-4 py-3.5">
        <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" />
        <p className="text-[10.5px] leading-relaxed text-charcoal-500">
          Promotions must be clearly labelled in search results. Never allow misleading claims about charging speed or
          availability. Revenue from placements is recorded separately in the ledger.
        </p>
      </div>
    </div>
  )
}
