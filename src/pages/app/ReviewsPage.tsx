import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, MessageSquare, Star, ThumbsUp } from 'lucide-react'
import { listCustomerBookings } from '@/services/bookings'
import { createReview, listMyReviews } from '@/services/reviews'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Feedback'
import { Button, buttonVariants } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Form'
import { PageHeader, Tabs, SectionCard } from '@/components/ui/Data'
import { EmptyState, PageLoader } from '@/components/ui/Feedback'
import { StarRating } from '@/components/ui/Brand'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatNaira, cn } from '@/lib/utils'
import type { Booking, Review } from '@/types'

const SUB_RATINGS = [
  { key: 'charging_experience', label: 'Charging experience' },
  { key: 'equipment_condition', label: 'Equipment condition' },
  { key: 'customer_service', label: 'Customer service' },
  { key: 'location_accessibility', label: 'Location accessibility' },
] as const

type SubKey = (typeof SUB_RATINGS)[number]['key']

function StarPicker({ value, onChange, size = 22 }: { value: number; onChange: (value: number) => void; size?: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="transition hover:scale-110"
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
        >
          <Star
            style={{ width: size, height: size }}
            className={star <= value ? 'fill-amber-400 text-amber-400' : 'text-charcoal-200'}
          />
        </button>
      ))}
    </div>
  )
}

export default function ReviewsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const [tab, setTab] = useState<'pending' | 'reviews'>('pending')
  const [selected, setSelected] = useState<Booking | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [overall, setOverall] = useState(5)
  const [subs, setSubs] = useState<Record<SubKey, number>>({
    charging_experience: 5,
    equipment_condition: 5,
    customer_service: 5,
    location_accessibility: 5,
  })
  const [comment, setComment] = useState('')
  usePageTitle('Reviews & ratings')

  const bookingsQuery = useQuery({
    queryKey: ['customer-bookings', user?.id],
    queryFn: () => listCustomerBookings(user?.id),
    enabled: Boolean(user?.id),
  })
  const reviewsQuery = useQuery({
    queryKey: ['my-reviews', user?.id],
    queryFn: () => listMyReviews(user!.id),
    enabled: Boolean(user?.id),
  })

  const bookings = bookingsQuery.data ?? []
  const reviews = reviewsQuery.data ?? []
  const reviewedBookingIds = new Set(reviews.map((review) => review.booking_id))
  const pending = useMemo(
    () => bookings.filter((booking) => booking.status === 'completed' && !reviewedBookingIds.has(booking.id)),
    [bookings, reviews],
  )

  useEffect(() => {
    const bookingId = params.get('booking')
    if (!bookingId) return
    const match = bookings.find((booking) => booking.id === bookingId && booking.status === 'completed' && !reviewedBookingIds.has(booking.id))
    if (match) {
      setSelected(match)
      setOpen(true)
    }
  }, [params, bookings])

  const openReview = (booking: Booking) => {
    setSelected(booking)
    setOverall(5)
    setSubs({ charging_experience: 5, equipment_condition: 5, customer_service: 5, location_accessibility: 5 })
    setComment('')
    setOpen(true)
  }

  const submit = async () => {
    if (!selected || !user) return
    if (comment.trim().length < 10) {
      toast.error('Add a little detail', 'Please write at least 10 characters so your review is useful.')
      return
    }
    setSaving(true)
    try {
      await createReview({
        bookingId: selected.id,
        stationId: selected.station_id,
        customerId: user.id,
        overallRating: overall,
        chargingExperience: subs.charging_experience,
        equipmentCondition: subs.equipment_condition,
        customerService: subs.customer_service,
        locationAccessibility: subs.location_accessibility,
        comment: comment.trim(),
      })
      await queryClient.invalidateQueries({ queryKey: ['my-reviews', user.id] })
      await queryClient.invalidateQueries({ queryKey: ['customer-bookings', user.id] })
      await reviewsQuery.refetch()
      toast.success('Review published', 'Thank you — your verified review is now helping other drivers.')
      setOpen(false)
      setTab('reviews')
    } catch (error) {
      toast.error('Could not publish review', (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (bookingsQuery.isLoading || reviewsQuery.isLoading) return <PageLoader label="Loading reviews" />

  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.overall_rating, 0) / reviews.length : 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Community"
        title="Reviews & ratings"
        description="Verified feedback from your completed sessions. Reviews help operators improve and help drivers choose."
        actions={<Link to="/app/bookings" className={buttonVariants({ variant: 'outline', size: 'md' })}><Star className="h-4 w-4" /> My bookings</Link>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Reviews written', value: reviews.length, hint: 'Verified after a completed session' },
          { label: 'Awaiting your review', value: pending.length, hint: 'Completed sessions without feedback' },
          { label: 'Your average rating', value: average ? average.toFixed(1) : '—', hint: 'Across stations you reviewed' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{stat.label}</p>
            <p className="mt-2 font-mono text-xl font-medium text-midnight-900">{stat.value}</p>
            <p className="mt-0.5 text-[10px] text-muted">{stat.hint}</p>
          </div>
        ))}
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'pending', label: 'Awaiting review', count: pending.length },
          { value: 'reviews', label: 'My reviews', count: reviews.length },
        ]}
      />

      {tab === 'pending' ? (
        pending.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {pending.map((booking) => (
              <div key={booking.id} className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-midnight-900">{booking.station?.name}</p>
                    <p className="mt-0.5 text-[10.5px] text-muted">{formatDate(booking.start_time, 'EEE, dd MMM yyyy')} · {booking.charger?.name}</p>
                  </div>
                  <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> Completed</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-2xl bg-mint-50 px-3 py-2.5">
                  <span className="text-[10.5px] text-muted">Session total</span>
                  <span className="font-mono text-[12px] font-medium text-midnight-900">{formatNaira(booking.total_amount)}</span>
                </div>
                <Button className="mt-4 w-full" onClick={() => openReview(booking)}>
                  <Star className="h-4 w-4" /> Write a review
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<MessageSquare className="h-6 w-6" />}
            title="Nothing waiting for a review"
            description="Once a charging session is completed, you can review the station here. Only verified sessions can be reviewed."
            action={<Link to="/app/bookings" className={buttonVariants({ variant: 'dark' })}>View bookings</Link>}
          />
        )
      ) : reviews.length ? (
        <div className="space-y-3">
          {reviews.map((review: Review) => (
            <SectionCard key={review.id} padded={false}>
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-midnight-900">{review.station?.name ?? 'Station'}</p>
                    <p className="mt-0.5 text-[10.5px] text-muted">{formatDate(review.created_at)} · Booking {review.booking_id.slice(-6).toUpperCase()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StarRating value={review.overall_rating} size={13} />
                    <span className="font-mono text-[12px] font-medium text-midnight-900">{review.overall_rating.toFixed(1)}</span>
                  </div>
                </div>
                {review.comment && <p className="mt-3 text-[13px] leading-relaxed text-charcoal-600">{review.comment}</p>}
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SUB_RATINGS.map((item) => (
                    <div key={item.key} className="rounded-xl bg-mint-50 px-2.5 py-2">
                      <p className="font-mono text-[11px] font-medium text-midnight-900">{review[item.key].toFixed(1)}</p>
                      <p className="mt-0.5 text-[8.5px] uppercase tracking-[0.1em] text-muted">{item.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-midnight-900/[0.06] pt-3">
                  <Badge tone={review.status === 'published' ? 'success' : review.status === 'hidden' ? 'danger' : 'warning'}>{review.status}</Badge>
                  <span className="flex items-center gap-1 text-[9.5px] text-muted"><ThumbsUp className="h-3 w-3" /> Verified session</span>
                </div>
                {review.response && (
                  <div className="mt-3 rounded-2xl border-l-2 border-lime bg-mint-50 px-3.5 py-3">
                    <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-midnight-600">Operator response</p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-charcoal-600">{review.response.response}</p>
                  </div>
                )}
              </div>
            </SectionCard>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Star className="h-6 w-6" />}
          title="No reviews written yet"
          description="Complete a charging session and share your experience. Verified reviews are the most valuable signal on the network."
          action={<Link to="/app/stations" className={buttonVariants({ variant: 'dark' })}>Book a session</Link>}
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Review your charging session"
        description={selected ? `${selected.station?.name} · ${formatDate(selected.start_time, 'dd MMM yyyy')}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={submit}>Publish review</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="rounded-2xl bg-mint-50 p-4 text-center">
            <p className="text-[11px] font-semibold text-midnight-900">Overall rating</p>
            <div className="mt-2 flex justify-center"><StarPicker value={overall} onChange={setOverall} size={28} /></div>
            <p className="mt-1.5 text-[10px] text-muted">{['Poor', 'Fair', 'Good', 'Very good', 'Excellent'][overall - 1]}</p>
          </div>
          <div className="space-y-3">
            {SUB_RATINGS.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-4">
                <span className="text-[12px] text-charcoal-600">{item.label}</span>
                <StarPicker value={subs[item.key]} onChange={(value) => setSubs((current) => ({ ...current, [item.key]: value }))} size={18} />
              </div>
            ))}
          </div>
          <div>
            <label htmlFor="review-comment" className="label-base">Your review</label>
            <Textarea
              id="review-comment"
              rows={4}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="How was the charger, the location, the operator? What should other drivers know?"
            />
            <p className={cn('mt-1 text-right font-mono text-[9.5px]', comment.length < 10 ? 'text-muted' : 'text-lime-700')}>{comment.length} characters</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
