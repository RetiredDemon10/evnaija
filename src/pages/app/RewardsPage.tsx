import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BadgeCheck,
  Coins,
  Copy,
  Gift,
  Mail,
  Share2,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getLoyaltyAccount, getReferralCode, listLoyaltyTransactions, listReferrals, redeemPoints } from '@/services/rewards'
import { PageHeader, SectionCard, StatCard } from '@/components/ui/Data'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { EmptyState, PageLoader, useToast } from '@/components/ui/Feedback'
import { InfoNote, MiniStat } from '@/components/dashboard/Kit'
import { usePageTitle } from '@/hooks/usePageTitle'
import { REWARDS, nairaForPoints, nextTier, referralLink, tierMeta } from '@/lib/rewards'
import { formatNaira, formatNumber, relativeTime } from '@/lib/utils'

export default function RewardsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  usePageTitle('Rewards & referrals')

  const userId = user?.id ?? ''
  const [redeemValue, setRedeemValue] = useState(String(REWARDS.minimumRedemptionPoints))
  const [redeeming, setRedeeming] = useState(false)

  const { data: account, isLoading } = useQuery({
    queryKey: ['loyalty-account', userId],
    queryFn: () => getLoyaltyAccount(userId),
    enabled: Boolean(userId),
  })
  const { data: transactions = [] } = useQuery({
    queryKey: ['loyalty-transactions', userId],
    queryFn: () => listLoyaltyTransactions(userId),
    enabled: Boolean(userId),
  })
  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals', userId],
    queryFn: () => listReferrals(userId),
    enabled: Boolean(userId),
  })
  const { data: code } = useQuery({
    queryKey: ['referral-code', userId],
    queryFn: () => getReferralCode(userId),
    enabled: Boolean(userId),
  })

  const link = useMemo(() => referralLink(code), [code])
  const tier = tierMeta(account?.tier ?? 'bronze')
  const upcoming = nextTier(account?.lifetime_points ?? 0)
  const progress = upcoming
    ? Math.min(
        100,
        Math.round(
          (((account?.lifetime_points ?? 0) - tier.minLifetimePoints) /
            (upcoming.minLifetimePoints - tier.minLifetimePoints)) *
            100,
        ),
      )
    : 100

  const rewardedInvites = referrals.filter((referral) => referral.status === 'rewarded').length

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  const share = async () => {
    if (!link) return
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join me on EV Naija', text: 'Charge your EV across Nigeria — use my code for a welcome bonus.', url: link })
        return
      } catch {
        // fall through to clipboard
      }
    }
    void copy(link, 'Invite link')
  }

  const redeem = async () => {
    const points = Math.floor(Number(redeemValue))
    if (!Number.isFinite(points) || points <= 0) {
      toast.error('Enter how many points to redeem')
      return
    }
    setRedeeming(true)
    try {
      await redeemPoints(userId, points)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['loyalty-account', userId] }),
        queryClient.invalidateQueries({ queryKey: ['loyalty-transactions', userId] }),
      ])
      toast.success(`Redeemed ${formatNumber(points)} points`, `${formatNaira(nairaForPoints(points))} credit added to your account.`)
      setRedeemValue(String(REWARDS.minimumRedemptionPoints))
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setRedeeming(false)
    }
  }

  if (isLoading) return <PageLoader label="Loading your rewards…" />

  const points = account?.points ?? 0
  const credit = account?.credit_balance ?? 0
  const canRedeem = points >= REWARDS.minimumRedemptionPoints

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rewards & referrals"
        description="Earn points every time you charge, invite friends, and turn your points into booking credit."
        eyebrow="EV Naija Rewards"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Points balance" value={formatNumber(points)} icon={<Coins className="h-4 w-4" />} hint={`${formatNaira(nairaForPoints(points))} redeemable`} tone="dark" />
        <StatCard label="Booking credit" value={formatNaira(credit)} icon={<Wallet className="h-4 w-4" />} hint="Applied at checkout" />
        <StatCard label="Lifetime points" value={formatNumber(account?.lifetime_points ?? 0)} icon={<TrendingUp className="h-4 w-4" />} hint={`${tier.name} tier`} />
        <StatCard label="Friends joined" value={formatNumber(referrals.length)} icon={<Users className="h-4 w-4" />} hint={`${rewardedInvites} rewarded`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="Refer a friend, both earn"
          description="Share your code. When a friend joins and completes their first charge, you both get points."
          action={
            <Button variant="outline" size="sm" onClick={share} disabled={!link}>
              <Share2 className="h-3.5 w-3.5" /> Share
            </Button>
          }
        >
          <div className="rounded-2xl border border-lime-400/40 bg-lime/10 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-lime-700">Your referral code</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="font-mono text-2xl font-semibold tracking-[0.08em] text-midnight-900">{code ?? '—'}</span>
              <Button variant="soft" size="sm" onClick={() => code && copy(code, 'Referral code')} disabled={!code}>
                <Copy className="h-3.5 w-3.5" /> Copy code
              </Button>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={link} className="font-mono text-[12px]" aria-label="Referral link" />
              <Button variant="dark" onClick={() => copy(link, 'Invite link')} disabled={!link}>
                <Copy className="h-4 w-4" /> Copy link
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MiniStat label="You earn" value={`${formatNumber(REWARDS.referral.referrerPoints)} pts`} tone="lime" />
            <MiniStat label="They earn" value={`${formatNumber(REWARDS.referral.refereePoints)} pts`} />
          </div>

          <div className="mt-6">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">Invites</p>
            {referrals.length ? (
              <ul className="mt-3 divide-y divide-midnight-900/[0.06]">
                {referrals.map((referral) => (
                  <li key={referral.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-mint text-midnight-800">
                        <UserPlus className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[13px] font-medium text-midnight-900">
                          {referral.referee?.full_name ?? 'Invite sent'}
                        </p>
                        <p className="text-[11px] text-muted">Joined {relativeTime(referral.created_at)}</p>
                      </div>
                    </div>
                    <Badge tone={referral.status === 'rewarded' ? 'success' : referral.status === 'joined' ? 'lime' : 'neutral'}>
                      {referral.status === 'rewarded' ? 'Rewarded' : referral.status === 'joined' ? 'Awaiting first charge' : 'Invited'}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3">
                <EmptyState icon={<Users className="h-5 w-5" />} title="No invites yet" description="Share your code to start earning points." />
              </div>
            )}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Your tier" description={`${tier.name} · ${tier.perk}`}>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-midnight-900 text-lime">
                <BadgeCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-lg font-semibold text-midnight-900">{tier.name}</p>
                <p className="text-[11px] text-muted">{formatNumber(account?.lifetime_points ?? 0)} lifetime points</p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-charcoal-100">
              <div className="h-full rounded-full bg-lime-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-muted">
              {upcoming
                ? `${formatNumber(upcoming.minLifetimePoints - (account?.lifetime_points ?? 0))} points to ${upcoming.name}`
                : 'You have reached the top tier.'}
            </p>
          </SectionCard>

          <SectionCard title="Redeem points" description="Turn points into credit for your next booking.">
            <InfoNote title="How credit works">
              {REWARDS.nairaPerPointRedeemed} point equals {formatNaira(REWARDS.nairaPerPointRedeemed)} of booking credit, capped at the platform fees on a booking so operator earnings are never reduced.
            </InfoNote>
            <div className="mt-4 flex items-end gap-3">
              <Field label="Points to redeem" hint={`Minimum ${REWARDS.minimumRedemptionPoints}`} className="flex-1">
                <Input
                  type="number"
                  min={REWARDS.minimumRedemptionPoints}
                  step={10}
                  value={redeemValue}
                  onChange={(event) => setRedeemValue(event.target.value)}
                />
              </Field>
              <Button variant="dark" onClick={redeem} loading={redeeming} disabled={!canRedeem} className="mb-[2px]">
                <Gift className="h-4 w-4" /> Redeem
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted">
              You will receive <span className="font-semibold text-midnight-900">{formatNaira(nairaForPoints(Math.floor(Number(redeemValue) || 0)))}</span> credit.
            </p>
            {!canRedeem && (
              <p className="mt-2 text-[11px] text-amber-700">
                Earn {formatNumber(REWARDS.minimumRedemptionPoints - points)} more points to unlock redemption.
              </p>
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Points activity" description="Every earn, referral bonus and redemption.">
        {transactions.length ? (
          <ul className="divide-y divide-midnight-900/[0.06]">
            {transactions.map((transaction) => (
              <li key={transaction.id} className="flex items-center justify-between gap-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-mint text-midnight-800">
                    {transaction.type === 'redeem' ? <Wallet className="h-4 w-4" /> : transaction.type === 'referral' ? <Sparkles className="h-4 w-4" /> : <Coins className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-[13px] font-medium text-midnight-900">{transaction.description}</p>
                    <p className="text-[11px] text-muted">{relativeTime(transaction.created_at)}</p>
                  </div>
                </div>
                <span className={`font-mono text-[13px] font-semibold ${transaction.points < 0 ? 'text-charcoal-500' : 'text-emerald-600'}`}>
                  {transaction.points > 0 ? '+' : ''}
                  {formatNumber(transaction.points)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Coins className="h-5 w-5" />} title="No activity yet" description="Charge at any EV Naija station to start earning points." />
        )}
      </SectionCard>

      <div className="flex items-center gap-2 text-[11px] text-muted">
        <Mail className="h-3.5 w-3.5" />
        Manage email, SMS and WhatsApp delivery in your notification settings.
      </div>
    </div>
  )
}
