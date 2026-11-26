import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Flag, Search, Star } from 'lucide-react'
import { listAllReviewsAdmin, writeAuditLog } from '@/services/admin'
import { moderateReview } from '@/services/reviews'
import type { Review } from '@/types'
import { PageHeader, DataTable, Pagination, Tabs, type Column } from '@/components/ui/Data'
import { Avatar } from '@/components/ui/Brand'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ExportButton, SelectFilter, TableEmpty, usePaged } from '@/components/dashboard/Kit'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate } from '@/lib/utils'

type Filter = 'all' | 'published' | 'reported' | 'hidden'

const TONE: Record<Review['status'], 'success' | 'warning' | 'danger'> = {
  published: 'success',
  reported: 'warning',
  hidden: 'danger',
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`h-2.5 w-2.5 ${index < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-charcoal-200'}`}
        />
      ))}
    </span>
  )
}

export default function AdminReviewsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  const [rating, setRating] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<Review | null>(null)
  const [working, setWorking] = useState(false)
  usePageTitle('Reviews & reports')

  const { data: reviews = [], isLoading } = useQuery({ queryKey: ['admin-reviews'], queryFn: listAllReviewsAdmin })

  const counts = useMemo(
    () => ({
      all: reviews.length,
      published: reviews.filter((review) => review.status === 'published').length,
      reported: reviews.filter((review) => review.status === 'reported').length,
      hidden: reviews.filter((review) => review.status === 'hidden').length,
    }),
    [reviews],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return reviews.filter((review) => {
      const matchesFilter = filter === 'all' || review.status === filter
      const matchesRating = rating === 'all' || Math.round(review.overall_rating) === Number(rating)
      const matchesSearch =
        !term ||
        (review.comment ?? '').toLowerCase().includes(term) ||
        (review.customer?.full_name ?? '').toLowerCase().includes(term) ||
        (review.station?.name ?? '').toLowerCase().includes(term)
      return matchesFilter && matchesRating && matchesSearch
    })
  }, [reviews, filter, rating, search])

  const { rows, pageCount } = usePaged(filtered, 12, page)

  const moderate = async (review: Review, status: Review['status']) => {
    setWorking(true)
    try {
      await moderateReview(review.id, status)
      if (user) {
        await writeAuditLog(user.id, `review.${status}`, 'review', review.id, {
          station: review.station?.name,
          customer: review.customer?.full_name,
          previousStatus: review.status,
        })
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-reviews'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
      toast.success(
        status === 'published' ? 'Review published' : status === 'hidden' ? 'Review hidden' : 'Review marked for review',
        status === 'published' ? 'It is visible on the station page again.' : 'It is no longer shown publicly.',
      )
      setDetail(null)
    } catch (error) {
      toast.error('Could not moderate review', (error as Error).message)
    } finally {
      setWorking(false)
    }
  }

  const columns: Column<Review>[] = [
    {
      key: 'review',
      header: 'Review',
      render: (review) => (
        <div className="flex items-start gap-2.5">
          <Avatar name={review.customer?.full_name ?? 'Driver'} src={review.customer?.avatar_url} size={34} />
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold text-midnight-900">{review.customer?.full_name ?? 'Driver'}</p>
            <p className="max-w-[260px] truncate text-[9.5px] text-muted">{review.comment ?? 'No written comment'}</p>
            <p className="mt-0.5 text-[9px] text-muted">{formatDate(review.created_at)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'station',
      header: 'Station',
      render: (review) => (
        <div>
          <p className="text-[11px] text-charcoal-700">{review.station?.name ?? '—'}</p>
          <p className="text-[9.5px] text-muted">{review.station?.city ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (review) => (
        <div className="flex items-center gap-1.5">
          <Stars rating={review.overall_rating} />
          <span className="font-mono text-[10.5px] text-charcoal-600">{review.overall_rating.toFixed(1)}</span>
        </div>
      ),
    },
    {
      key: 'flag',
      header: 'Reports',
      render: (review) =>
        review.report_reason ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700">
            <Flag className="h-3 w-3" /> Reported
          </span>
        ) : (
          <span className="text-[10px] text-muted">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (review) => <Badge tone={TONE[review.status]}>{review.status}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (review) => (
        <div className="flex justify-end gap-1">
          <button
            onClick={() => setDetail(review)}
            className="inline-flex h-8 items-center rounded-lg border border-midnight-900/10 px-2.5 text-[10px] font-semibold text-charcoal-600 hover:bg-mint-50"
          >
            View
          </button>
          {review.status === 'hidden' ? (
            <button
              onClick={() => void moderate(review, 'published')}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <Eye className="h-3 w-3" /> Publish
            </button>
          ) : (
            <button
              onClick={() => void moderate(review, 'hidden')}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-red-50 px-2.5 text-[10px] font-semibold text-red-600 hover:bg-red-100"
            >
              <EyeOff className="h-3 w-3" /> Hide
            </button>
          )}
        </div>
      ),
    },
  ]

  if (isLoading) return <PageLoader label="Loading reviews" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Reviews & reports"
        description="Moderate driver reviews, resolve reports and keep station ratings trustworthy. Hiding a review is logged in the audit trail."
        actions={
          <ExportButton
            filename="ev-naija-reviews.csv"
            rows={filtered.map((review) => ({
              customer: review.customer?.full_name ?? '',
              station: review.station?.name ?? '',
              city: review.station?.city ?? '',
              rating: review.overall_rating,
              comment: review.comment ?? '',
              status: review.status,
              reported: review.report_reason ?? '',
              createdAt: review.created_at,
            }))}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total reviews', value: counts.all, hint: 'All time', tone: 'text-midnight-900' },
          { label: 'Published', value: counts.published, hint: 'Visible on stations', tone: 'text-emerald-700' },
          { label: 'Reported', value: counts.reported, hint: 'Awaiting moderation', tone: 'text-amber-700' },
          { label: 'Hidden', value: counts.hidden, hint: 'Removed from public view', tone: 'text-red-500' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{stat.label}</p>
            <p className={`mt-2 font-mono text-xl font-medium ${stat.tone}`}>{stat.value}</p>
            <p className="mt-0.5 text-[9.5px] text-muted">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          value={filter}
          onChange={(value) => {
            setFilter(value)
            setPage(1)
          }}
          tabs={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'published', label: 'Published', count: counts.published },
            { value: 'reported', label: 'Reported', count: counts.reported },
            { value: 'hidden', label: 'Hidden', count: counts.hidden },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search customer, station or text"
              className="input-base h-9 pl-9 text-[11px]"
            />
          </div>
          <SelectFilter
            value={rating}
            onChange={(value) => {
              setRating(value)
              setPage(1)
            }}
            options={[
              { value: 'all', label: 'All ratings' },
              { value: '5', label: '5 stars' },
              { value: '4', label: '4 stars' },
              { value: '3', label: '3 stars' },
              { value: '2', label: '2 stars' },
              { value: '1', label: '1 star' },
            ]}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        minWidth={820}
        empty={<TableEmpty title="No reviews in this view" description="Adjust filters, or wait for drivers to review completed sessions." />}
        mobileRender={(review) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Avatar name={review.customer?.full_name ?? 'Driver'} src={review.customer?.avatar_url} size={34} />
                <div>
                  <p className="text-[12px] font-semibold text-midnight-900">{review.customer?.full_name ?? 'Driver'}</p>
                  <p className="text-[9.5px] text-muted">{review.station?.name}</p>
                </div>
              </div>
              <Badge tone={TONE[review.status]}>{review.status}</Badge>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Stars rating={review.overall_rating} />
              <span className="font-mono text-[10px] text-charcoal-600">{review.overall_rating.toFixed(1)}</span>
            </div>
            {review.comment && <p className="mt-1.5 line-clamp-2 text-[10px] text-muted">{review.comment}</p>}
            <button onClick={() => setDetail(review)} className="mt-2 text-[10.5px] font-semibold text-lime-700">
              Moderate review
            </button>
          </div>
        )}
      />
      <Pagination page={page} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={12} />

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Review details"
        description={detail ? `${detail.station?.name ?? 'Station'} · ${formatDate(detail.created_at)}` : undefined}
        footer={
          detail ? (
            <>
              <Button variant="outline" onClick={() => setDetail(null)}>
                Close
              </Button>
              {detail.status !== 'hidden' ? (
                <Button variant="danger" loading={working} onClick={() => void moderate(detail, 'hidden')}>
                  <EyeOff className="h-4 w-4" /> Hide review
                </Button>
              ) : (
                <Button loading={working} onClick={() => void moderate(detail, 'published')}>
                  <Eye className="h-4 w-4" /> Publish review
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl bg-mint-50 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Avatar name={detail.customer?.full_name ?? 'Driver'} src={detail.customer?.avatar_url} size={40} />
                <div>
                  <p className="text-[12px] font-semibold text-midnight-900">{detail.customer?.full_name ?? 'Driver'}</p>
                  <p className="text-[9.5px] text-muted">{detail.customer?.email ?? ''}</p>
                </div>
              </div>
              <Badge tone={TONE[detail.status]}>{detail.status}</Badge>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { label: 'Overall', value: detail.overall_rating },
                { label: 'Charging experience', value: detail.charging_experience },
                { label: 'Equipment condition', value: detail.equipment_condition },
                { label: 'Customer service', value: detail.customer_service },
                { label: 'Location accessibility', value: detail.location_accessibility },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-charcoal-50 px-3 py-2.5">
                  <p className="text-[8.5px] uppercase tracking-[0.12em] text-muted">{item.label}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Stars rating={item.value} />
                    <span className="font-mono text-[10.5px] text-charcoal-600">{item.value.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-midnight-900/[0.07] p-4">
              <p className="text-[8.5px] uppercase tracking-[0.12em] text-muted">Driver comment</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-charcoal-600">{detail.comment || 'No written comment.'}</p>
            </div>

            {detail.report_reason && (
              <div className="rounded-xl bg-amber-50 px-3 py-2.5">
                <p className="flex items-center gap-1 text-[8.5px] uppercase tracking-[0.12em] text-amber-700">
                  <Flag className="h-2.5 w-2.5" /> Report reason
                </p>
                <p className="mt-0.5 text-[11px] text-amber-800">{detail.report_reason}</p>
              </div>
            )}

            {detail.response?.response && (
              <div className="rounded-xl bg-mint-50 px-3 py-2.5">
                <p className="text-[8.5px] uppercase tracking-[0.12em] text-muted">Operator response</p>
                <p className="mt-0.5 text-[11px] text-charcoal-600">{detail.response.response}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
