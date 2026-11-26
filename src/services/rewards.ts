import type { Booking, LoyaltyAccount, LoyaltyTransaction, Profile, Referral } from '@/types'
import { supabase } from '@/lib/supabase'
import { isPreviewMode } from '@/lib/env'
import { demoStore } from '@/data/demo'
import { REWARDS, pointsForAmount, tierForLifetimePoints } from '@/lib/rewards'

const REFERRAL_SELECT = `
  *,
  referee:profiles!referrals_referee_id_fkey(*)
`

function emptyAccount(userId: string): LoyaltyAccount {
  return {
    id: `local-${userId}`,
    user_id: userId,
    points: 0,
    lifetime_points: 0,
    tier: 'bronze',
    credit_balance: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function attachReferral(referral: Referral): Referral {
  return {
    ...referral,
    referee: referral.referee_id
      ? demoStore.customers.find((c) => c.id === referral.referee_id) ?? null
      : null,
  }
}

export async function getLoyaltyAccount(userId: string): Promise<LoyaltyAccount> {
  if (isPreviewMode || !supabase) return demoStore.loyaltyAccount
  const { data, error } = await supabase
    .from('loyalty_accounts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as LoyaltyAccount) ?? emptyAccount(userId)
}

export async function listLoyaltyTransactions(userId: string): Promise<LoyaltyTransaction[]> {
  if (isPreviewMode || !supabase) {
    return [...demoStore.loyaltyTransactions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  }
  const { data, error } = await supabase
    .from('loyalty_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as LoyaltyTransaction[]
}

export async function listReferrals(userId: string): Promise<Referral[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.referrals
      .filter((referral) => referral.referrer_id === userId)
      .map(attachReferral)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }
  const { data, error } = await supabase
    .from('referrals')
    .select(REFERRAL_SELECT)
    .eq('referrer_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Referral[]
}

export async function getReferralCode(userId: string): Promise<string | null> {
  if (isPreviewMode || !supabase) return demoStore.profile.referral_code ?? null
  const { data, error } = await supabase
    .from('profiles')
    .select('referral_code')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  const existing = (data as Pick<Profile, 'referral_code'> | null)?.referral_code
  if (existing) return existing
  const { data: created, error: createError } = await supabase.rpc('ensure_referral_code')
  if (createError) throw createError
  return (created as string) ?? null
}

/** Points earned for a paid booking, mirrored from the server trigger. */
export function previewPointsForBooking(totalAmount: number) {
  return pointsForAmount(totalAmount)
}

export async function redeemPoints(userId: string, points: number): Promise<LoyaltyAccount> {
  if (points < REWARDS.minimumRedemptionPoints) {
    throw new Error(`Redeem at least ${REWARDS.minimumRedemptionPoints} points.`)
  }
  if (isPreviewMode || !supabase) {
    const account = demoStore.loyaltyAccount
    if (account.points < points) throw new Error('You do not have enough points.')
    const credit = points * REWARDS.nairaPerPointRedeemed
    account.points -= points
    account.credit_balance += credit
    account.updated_at = new Date().toISOString()
    demoStore.loyaltyTransactions.unshift({
      id: `ltx-${Date.now()}`,
      user_id: userId,
      points: -points,
      type: 'redeem',
      description: `Redeemed ${points} points for ₦${credit.toLocaleString('en-NG')} booking credit`,
      booking_id: null,
      created_at: new Date().toISOString(),
    })
    return { ...account }
  }
  const { data, error } = await supabase.rpc('redeem_loyalty_points', { p_points: points })
  if (error) throw new Error(error.message)
  return data as LoyaltyAccount
}

/**
 * Applies available reward credit to a pending booking. Capped at the platform
 * fees (service fee + VAT) so operator earnings are never reduced.
 */
export async function applyCreditToBooking(bookingId: string, userId: string): Promise<Booking | null> {
  if (isPreviewMode || !supabase) {
    const booking = demoStore.bookings.find((b) => b.id === bookingId)
    if (!booking) return null
    const account = demoStore.loyaltyAccount
    const cap = booking.service_fee + booking.tax_amount
    const applied = Math.min(account.credit_balance, cap, booking.total_amount)
    if (applied <= 0) return booking
    booking.discount_amount = (booking.discount_amount ?? 0) + applied
    booking.total_amount = Math.max(0, booking.total_amount - applied)
    account.credit_balance -= applied
    account.updated_at = new Date().toISOString()
    const payment = demoStore.payments.find((p) => p.booking_id === bookingId && p.status === 'pending')
    if (payment) payment.amount = Math.max(0, payment.amount - applied)
    demoStore.loyaltyTransactions.unshift({
      id: `ltx-${Date.now()}`,
      user_id: userId,
      points: 0,
      type: 'redeem',
      description: `Applied ₦${applied.toLocaleString('en-NG')} reward credit to booking ${booking.booking_reference}`,
      booking_id: bookingId,
      created_at: new Date().toISOString(),
    })
    return booking
  }
  const { data, error } = await supabase.rpc('apply_credit_to_booking', { p_booking_id: bookingId })
  if (error) throw new Error(error.message)
  return (data as Booking) ?? null
}

/** Called right after signup so a referred driver is linked to their inviter. */
export async function claimReferral(code: string, userId: string): Promise<void> {
  if (isPreviewMode || !supabase) return
  const { error } = await supabase.rpc('claim_referral', { p_code: code })
  if (error) throw new Error(error.message)
}

/** Local helper used by the preview checkout to reflect the earned points. */
export function applyPreviewPoints(userId: string, booking: Booking) {
  const account = demoStore.loyaltyAccount
  const earned = previewPointsForBooking(booking.total_amount)
  if (earned <= 0) return account
  account.points += earned
  account.lifetime_points += earned
  account.tier = tierForLifetimePoints(account.lifetime_points)
  account.updated_at = new Date().toISOString()
  demoStore.loyaltyTransactions.unshift({
    id: `ltx-${Date.now()}`,
    user_id: userId,
    points: earned,
    type: 'earn',
    description: `Points for booking ${booking.booking_reference}`,
    booking_id: booking.id,
    created_at: new Date().toISOString(),
  })
  return account
}
