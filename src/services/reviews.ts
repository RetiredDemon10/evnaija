import type { Review, ReviewResponse, Station } from '@/types'
import { supabase } from '@/lib/supabase'
import { isPreviewMode } from '@/lib/env'
import { demoStore, getDemoAdminStats } from '@/data/demo'

export interface CreateReviewInput {
  bookingId: string
  stationId: string
  customerId: string
  overallRating: number
  chargingExperience: number
  equipmentCondition: number
  customerService: number
  locationAccessibility: number
  comment: string
  photos?: string[]
}

export async function createReview(input: CreateReviewInput): Promise<Review> {
  if (isPreviewMode || !supabase) {
    const booking = demoStore.bookings.find((b) => b.id === input.bookingId)
    if (!booking) throw new Error('Booking not found.')
    if (booking.status !== 'completed') throw new Error('You can only review completed sessions.')
    if (demoStore.reviews.some((r) => r.booking_id === input.bookingId)) {
      throw new Error('You have already reviewed this booking.')
    }
    const review: Review = {
      id: `rev-${Date.now()}`,
      booking_id: input.bookingId,
      station_id: input.stationId,
      customer_id: input.customerId,
      overall_rating: input.overallRating,
      charging_experience: input.chargingExperience,
      equipment_condition: input.equipmentCondition,
      customer_service: input.customerService,
      location_accessibility: input.locationAccessibility,
      comment: input.comment,
      photos: input.photos ?? [],
      status: 'published',
      is_verified: true,
      report_reason: null,
      created_at: new Date().toISOString(),
      customer: demoStore.profile,
      response: null,
    }
    demoStore.reviews.unshift(review)
    const station = demoStore.stations.find((s) => s.id === input.stationId)
    if (station) {
      const stationReviews = demoStore.reviews.filter(
        (r) => r.station_id === station.id && r.status === 'published',
      )
      station.rating_average =
        Math.round(
          (stationReviews.reduce((acc, r) => acc + r.overall_rating, 0) / stationReviews.length) * 10,
        ) / 10
      station.rating_count = stationReviews.length
    }
    return review
  }
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      booking_id: input.bookingId,
      station_id: input.stationId,
      customer_id: input.customerId,
      overall_rating: input.overallRating,
      charging_experience: input.chargingExperience,
      equipment_condition: input.equipmentCondition,
      customer_service: input.customerService,
      location_accessibility: input.locationAccessibility,
      comment: input.comment,
      photos: input.photos ?? [],
      is_verified: true,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Review
}

export async function listMyReviews(customerId: string): Promise<Review[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.reviews
      .filter((r) => r.customer_id === customerId)
      .map((r) => ({
        ...r,
        station: demoStore.stations.find((s) => s.id === r.station_id),
        response: demoStore.reviewResponses.find((rr) => rr.review_id === r.id) ?? null,
      }))
  }
  const { data, error } = await supabase
    .from('reviews')
    .select('*, station:stations(name, city, slug, station_images(*)), response:review_responses(*)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Review[]
}

export async function listStationReviews(stationId: string): Promise<Review[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.reviews
      .filter((r) => r.station_id === stationId && r.status === 'published')
      .map((r) => ({
        ...r,
        customer: demoStore.customers.find((c) => c.id === r.customer_id),
        response: demoStore.reviewResponses.find((rr) => rr.review_id === r.id) ?? null,
      }))
  }
  const { data, error } = await supabase
    .from('reviews')
    .select('*, customer:profiles(*), response:review_responses(*)')
    .eq('station_id', stationId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Review[]
}

export async function respondToReview(input: {
  reviewId: string
  operatorId: string
  response: string
}): Promise<ReviewResponse> {
  if (isPreviewMode || !supabase) {
    const existing = demoStore.reviewResponses.find((r) => r.review_id === input.reviewId)
    if (existing) {
      existing.response = input.response
      return existing
    }
    const response: ReviewResponse = {
      id: `rr-${Date.now()}`,
      review_id: input.reviewId,
      operator_id: input.operatorId,
      response: input.response,
      created_at: new Date().toISOString(),
    }
    demoStore.reviewResponses.push(response)
    return response
  }
  const { data, error } = await supabase
    .from('review_responses')
    .upsert(
      { review_id: input.reviewId, operator_id: input.operatorId, response: input.response },
      { onConflict: 'review_id' },
    )
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ReviewResponse
}

export async function reportReview(reviewId: string, reason: string) {
  if (isPreviewMode || !supabase) {
    const review = demoStore.reviews.find((r) => r.id === reviewId)
    if (review) {
      review.status = 'reported'
      review.report_reason = reason
    }
    return
  }
  const { error } = await supabase.rpc('report_review', {
    p_review_id: reviewId,
    p_reason: reason,
  })
  if (error) throw new Error(error.message)
}

export async function listAllReviews(): Promise<Review[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.reviews.map((r) => ({
      ...r,
      station: demoStore.stations.find((s) => s.id === r.station_id),
      customer: demoStore.customers.find((c) => c.id === r.customer_id),
      response: demoStore.reviewResponses.find((rr) => rr.review_id === r.id) ?? null,
    }))
  }
  const { data, error } = await supabase
    .from('reviews')
    .select('*, station:stations(name, city, slug), customer:profiles(*), response:review_responses(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Review[]
}

export async function moderateReview(reviewId: string, status: Review['status']) {
  if (isPreviewMode || !supabase) {
    const review = demoStore.reviews.find((r) => r.id === reviewId)
    if (review) review.status = status
    return
  }
  const { error } = await supabase.rpc('moderate_review', {
    p_review_id: reviewId,
    p_status: status,
  })
  if (error) throw new Error(error.message)
}

export async function listTopTestimonials(limit = 6): Promise<Review[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.reviews
      .filter((r) => r.status === 'published' && r.overall_rating >= 4)
      .slice(0, limit)
      .map((r) => ({ ...r, station: demoStore.stations.find((s) => s.id === r.station_id) }))
  }
  const { data, error } = await supabase.rpc('get_testimonials', { p_limit: limit })
  if (error) throw error
  return (data ?? []) as unknown as Review[]
}

export function averageRating(reviews: Review[]) {
  if (!reviews.length) return 0
  return Math.round((reviews.reduce((acc, r) => acc + r.overall_rating, 0) / reviews.length) * 10) / 10
}
