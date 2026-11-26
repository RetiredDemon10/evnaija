import type { LoyaltyTier } from '@/types'

/**
 * Loyalty & referral configuration.
 *
 * Points are issued on paid bookings (see the `award_booking_loyalty` trigger)
 * and can be redeemed for account credit that is applied to a future booking's
 * platform fees. All values are mirrored server-side — this module is the
 * single source of truth for the UI and the local preview fixtures.
 */
export const REWARDS = {
  /** 1 point is earned for every ₦100 of a paid booking. */
  nairaPerPointEarned: 100,
  /** 1 point is worth ₦1 when redeemed as booking credit. */
  nairaPerPointRedeemed: 1,
  /** Smallest number of points that can be redeemed in one go. */
  minimumRedemptionPoints: 100,
  /** Credit can never exceed this share of the platform fees on a booking. */
  maxCreditShareOfFees: 1,
  referral: {
    /** Points awarded to the person who shared their code. */
    referrerPoints: 500,
    /** Points awarded to the new driver who used a code. */
    refereePoints: 250,
    prefix: 'EVN',
  },
  tiers: [
    { key: 'bronze', name: 'Bronze', minLifetimePoints: 0, perk: 'Earn 1 point for every ₦100 charged' },
    { key: 'silver', name: 'Silver', minLifetimePoints: 500, perk: 'Priority support on charging issues' },
    { key: 'gold', name: 'Gold', minLifetimePoints: 2000, perk: 'Early access to new stations and offers' },
  ] as { key: LoyaltyTier; name: string; minLifetimePoints: number; perk: string }[],
} as const

export function pointsForAmount(amountNaira: number) {
  return Math.max(0, Math.floor((Number(amountNaira) || 0) / REWARDS.nairaPerPointEarned))
}

export function nairaForPoints(points: number) {
  return Math.max(0, Math.floor(Number(points) || 0) * REWARDS.nairaPerPointRedeemed)
}

export function tierForLifetimePoints(lifetimePoints: number): LoyaltyTier {
  const tiers = [...REWARDS.tiers].reverse()
  const match = tiers.find((tier) => lifetimePoints >= tier.minLifetimePoints)
  return (match?.key ?? 'bronze') as LoyaltyTier
}

export function tierMeta(tier: LoyaltyTier) {
  return REWARDS.tiers.find((item) => item.key === tier) ?? REWARDS.tiers[0]
}

export function nextTier(lifetimePoints: number) {
  return REWARDS.tiers.find((tier) => tier.minLifetimePoints > lifetimePoints) ?? null
}

export function referralLink(code: string | null | undefined) {
  if (!code) return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/register?ref=${encodeURIComponent(code)}`
}
