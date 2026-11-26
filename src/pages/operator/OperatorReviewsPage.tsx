import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Flag, MessageSquare, Search, Star, ThumbsUp } from 'lucide-react'
import { useOperatorData } from '@/hooks/useOperatorData'
import { listOperatorReviews } from '@/services/operator'
import { reportReview, respondToReview } from '@/services/reviews'
import type { Review } from '@/types'
import { PageHeader, SectionCard, Tabs } from '@/components/ui/Data'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Field, Textarea } from '@/components/ui/Form'
import { StarRating } from '@/components/ui/Brand'
import { SelectFilter, TableEmpty } from '@/components/dashboard/Kit'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, cn } from '@/lib/utils'

type Filter = 'all' | 'unanswered' | 'positive' | 'critical'

export default function OperatorReviewsPage() {
  const { stationIds, operatorId, stations, isLoading } = useOperatorData()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('all')
  const [stationFilter, setStationFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [responding, setResponding] = useState<Review | null>(null)
  const [reporting, setReporting] = useState<Review | null>(null)
  const [reply, setReply] = useState('')
  const [reportReason, setReportReason] = useState('')
  const [saving, setSaving] = useState(false)
  usePageTitle('Reviews')

  const { data: reviews = [], isLoading: loadingReviews } = useQuery({
    queryKey: ['operator-reviews', operatorId, stationIds],
    queryFn: () => listOperatorReviews(stationIds),
    enabled: Boolean(operatorId) && stationIds.length > 0,
  })

  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.overall_rating, 0) / reviews.length : 0
  const unanswered = reviews.filter((review) => !review.response)
  const positive = reviews.filter((review) => review.overall_rating >= 4)
  const critical = reviews.filter((review) => review.overall_rating <= 2)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const active = filter === 'unanswered' ? unanswered : filter === 'positive' ? positive : filter === 'critical' ? critical : reviews
    return active.filter((review) => {
      const matchesStation = stationFilter === 'all' || review.station_id === stationFilter
      const matchesSearch = !term || (review.comment ?? '').toLowerCase().includes(term) || (review.customer?.full_name ?? '').toLowerCase().includes(term) || (review.station?.name ?? '').toLowerCase().includes(term)
      return matchesStation && matchesSearch
    })
  }, [reviews, filter, stationFilter, search, unanswered, positive, critical])

  const submitResponse = async () => {
    if (!responding || !operatorId) return
    if (reply.trim().length < 10) {
      toast.error('Add a little more detail', 'Responses must be at least 10 characters.')
      return
    }
    setSaving(true)
    try {
      await respondToReview({ reviewId: responding.id, operatorId, response: reply.trim() })
      await queryClient.invalidateQueries({ queryKey: ['operator-reviews', operatorId, stationIds] })
      toast.success('Response published', 'Drivers will see your reply on the public station page.')
      setResponding(null)
      setReply('')
    } catch (error) {
      toast.error('Could not publish response', (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const submitReport = async () => {
    if (!reporting) return
    if (reportReason.trim().length < 8) {
      toast.error('Add a report reason')
      return
    }
    setSaving(true)
    try {
      await reportReview(reporting.id, reportReason.trim())
      await queryClient.invalidateQueries({ queryKey: ['operator-reviews', operatorId, stationIds] })
      toast.success('Review reported', 'Our moderation team will review it within 2 business days.')
      setReporting(null)
      setReportReason('')
    } catch (error) {
      toast.error('Could not report review', (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || loadingReviews) return <PageLoader label="Loading reviews" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reputation"
        title="Reviews & ratings"
        description="Verified feedback from completed sessions. Reply publicly, thank drivers and address issues quickly."
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-3xl bg-midnight-950 p-5 text-white">
          <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/40">Average rating</p>
          <div className="mt-1.5 flex items-end gap-2">
            <p className="font-mono text-3xl font-medium text-lime">{average.toFixed(1)}</p>
            <span className="pb-1 text-[10px] text-white/40">/ 5.0</span>
          </div>
          <div className="mt-2"><StarRating value={Math.round(average)} size={12} /></div>
        </div>
        <div className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">Total reviews</p>
          <p className="mt-2 font-mono text-xl font-medium text-midnight-900">{reviews.length}</p>
          <p className="mt-0.5 text-[9.5px] text-muted">Verified sessions only</p>
        </div>
        <div className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">Awaiting reply</p>
          <p className="mt-2 font-mono text-xl font-medium text-amber-700">{unanswered.length}</p>
          <p className="mt-0.5 text-[9.5px] text-muted">Respond to build trust</p>
        </div>
        <div className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">Critical (1–2★)</p>
          <p className="mt-2 font-mono text-xl font-medium text-red-500">{critical.length}</p>
          <p className="mt-0.5 text-[9.5px] text-muted">Resolve equipment issues</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'all', label: 'All', count: reviews.length },
            { value: 'unanswered', label: 'Unanswered', count: unanswered.length },
            { value: 'positive', label: 'Positive', count: positive.length },
            { value: 'critical', label: 'Critical', count: critical.length },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search review or driver" className="input-base h-9 pl-9 text-[11px]" />
          </div>
          <SelectFilter value={stationFilter} onChange={setStationFilter} options={[{ value: 'all', label: 'All stations' }, ...stations.map((station) => ({ value: station.id, label: station.name }))]} />
        </div>
      </div>

      {filtered.length ? (
        <div className="space-y-3">
          {filtered.map((review) => (
            <SectionCard key={review.id} padded={false}>
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[12.5px] font-semibold text-midnight-900">{review.customer?.full_name ?? 'Verified driver'}</p>
                      {review.is_verified && <Badge tone="success"><ThumbsUp className="h-2.5 w-2.5" /> Verified</Badge>}
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted">{review.station?.name} · {formatDate(review.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StarRating value={review.overall_rating} size={13} />
                    <span className="font-mono text-[12px] font-medium text-midnight-900">{review.overall_rating.toFixed(1)}</span>
                  </div>
                </div>

                {review.comment && <p className="mt-3 text-[12.5px] leading-relaxed text-charcoal-600">{review.comment}</p>}

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: 'Charging', value: review.charging_experience },
                    { label: 'Equipment', value: review.equipment_condition },
                    { label: 'Service', value: review.customer_service },
                    { label: 'Access', value: review.location_accessibility },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-mint-50 px-2.5 py-2">
                      <p className="font-mono text-[11px] font-medium text-midnight-900">{item.value.toFixed(1)}</p>
                      <p className="mt-0.5 text-[8.5px] uppercase tracking-[0.1em] text-muted">{item.label}</p>
                    </div>
                  ))}
                </div>

                {review.response ? (
                  <div className="mt-4 rounded-2xl border-l-2 border-lime bg-mint-50 px-4 py-3">
                    <p className="flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-[0.14em] text-midnight-600"><MessageSquare className="h-2.5 w-2.5" /> Your response</p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-charcoal-600">{review.response.response}</p>
                    <button onClick={() => { setResponding(review); setReply(review.response?.response ?? '') }} className="mt-1.5 text-[9.5px] font-semibold text-lime-700 hover:underline">Edit response</button>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-midnight-900/[0.06] pt-3">
                    <p className="text-[10px] text-muted">No response yet — drivers appreciate a reply.</p>
                    <div className="flex gap-1.5">
                      <button onClick={() => { setResponding(review); setReply('') }} className="inline-flex h-8 items-center gap-1 rounded-lg bg-midnight-900 px-2.5 text-[10px] font-semibold text-lime hover:bg-midnight-800"><MessageSquare className="h-3 w-3" /> Reply</button>
                      <button onClick={() => setReporting(review)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-midnight-900/10 px-2.5 text-[10px] font-semibold text-charcoal-600 hover:bg-mint-50"><Flag className="h-3 w-3" /> Report</button>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          ))}
        </div>
      ) : (
        <TableEmpty title="No reviews in this view" description="Verified reviews from completed sessions will appear here." />
      )}

      <SectionCard title="Build a stronger rating" description="What moves the needle with drivers.">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { title: 'Fast responses', text: 'Reply to reviews within 48 hours. It signals an active operator.' },
            { title: 'Accurate availability', text: 'Keep charger status current. “Unavailable” is the top complaint.' },
            { title: 'Clean, lit sites', text: 'Photos and amenities set expectations before arrival.' },
          ].map((tip) => (
            <div key={tip.title} className="rounded-2xl bg-mint-50 p-4">
              <Star className="h-4 w-4 text-amber-500" />
              <p className="mt-2 text-[11.5px] font-semibold text-midnight-900">{tip.title}</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{tip.text}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <Modal
        open={Boolean(responding)}
        onClose={() => setResponding(null)}
        title="Respond to review"
        description={responding ? `${responding.customer?.full_name ?? 'Driver'} · ${formatDate(responding.created_at)}` : undefined}
        footer={<><Button variant="outline" onClick={() => setResponding(null)}>Cancel</Button><Button loading={saving} onClick={submitResponse}>{responding?.response ? 'Update response' : 'Publish response'}</Button></>}
      >
        <Field label="Your public response" hint="Be specific, polite and solution-oriented. Do not include personal customer data.">
          <Textarea rows={4} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Thank you for the feedback. The cable at Bay B was replaced on…" />
        </Field>
      </Modal>

      <Modal
        open={Boolean(reporting)}
        onClose={() => setReporting(null)}
        title="Report this review"
        description="Use this for reviews that contain abuse, personal data or content unrelated to a real session."
        footer={<><Button variant="outline" onClick={() => setReporting(null)}>Cancel</Button><Button variant="danger" loading={saving} onClick={submitReport}>Submit report</Button></>}
      >
        <Field label="Reason for reporting" required>
          <Textarea rows={3} value={reportReason} onChange={(event) => setReportReason(event.target.value)} placeholder="Explain why this review should be moderated…" />
        </Field>
        <div className={cn('mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[10px] leading-relaxed text-amber-800')}>
          Reporting does not remove the review immediately. Moderators review the evidence from both sides.
        </div>
      </Modal>
    </div>
  )
}
