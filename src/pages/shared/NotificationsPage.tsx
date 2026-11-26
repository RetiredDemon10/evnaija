import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bell, BellOff, CalendarCheck, CheckCheck, CreditCard, MessageSquare, ShieldCheck, Star, Wallet } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '@/services/account'
import { useToast } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/Data'
import { EmptyState, PageLoader } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { usePageTitle } from '@/hooks/usePageTitle'
import { relativeTime, cn } from '@/lib/utils'
import type { AppNotification } from '@/types'

const ICONS: Record<AppNotification['type'], typeof Bell> = {
  booking: CalendarCheck,
  payment: CreditCard,
  account: ShieldCheck,
  system: Bell,
  review: Star,
  payout: Wallet,
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  usePageTitle('Notifications')

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => listNotifications(user!.id),
    enabled: Boolean(user?.id),
  })

  const markAll = async () => {
    if (!user) return
    try {
      await markAllNotificationsRead(user.id)
      await queryClient.invalidateQueries({ queryKey: ['notifications', user.id] })
      toast.success('All notifications marked as read')
    } catch (error) {
      toast.error('Could not update notifications', (error as Error).message)
    }
  }

  const markOne = async (notification: AppNotification) => {
    if (!user || notification.is_read) return
    try {
      await markNotificationRead(user.id, notification.id)
      await queryClient.invalidateQueries({ queryKey: ['notifications', user.id] })
    } catch {
      // Non-blocking: navigation should still work.
    }
  }

  if (isLoading) return <PageLoader label="Loading notifications" />
  const unread = notifications.filter((notification) => !notification.is_read).length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Booking updates, payment confirmations and account activity. Transactional messages cannot be turned off."
        actions={
          <Button variant="outline" size="md" onClick={markAll} disabled={!unread}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <Badge tone={unread ? 'lime' : 'neutral'}>{unread} unread</Badge>
        <span className="text-[10.5px] text-muted">{notifications.length} total</span>
      </div>

      {notifications.length ? (
        <div className="overflow-hidden rounded-3xl border border-midnight-900/[0.07] bg-white shadow-card">
          {notifications.map((notification, index) => {
            const Icon = ICONS[notification.type] ?? Bell
            const content = (
              <div className={cn('flex gap-3.5 px-5 py-4 transition sm:px-6', !notification.is_read && 'bg-mint-50/70', index < notifications.length - 1 && 'border-b border-midnight-900/[0.05]')}>
                <span className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl', notification.is_read ? 'bg-charcoal-50 text-charcoal-400' : 'bg-lime/30 text-midnight-800')}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className={cn('text-[12.5px]', notification.is_read ? 'font-medium text-charcoal-600' : 'font-semibold text-midnight-900')}>{notification.title}</p>
                    <span className="shrink-0 font-mono text-[9px] text-muted">{relativeTime(notification.created_at)}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">{notification.message}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge tone="neutral">{notification.type}</Badge>
                    {!notification.is_read && <span className="h-1.5 w-1.5 rounded-full bg-lime-600" />}
                  </div>
                </div>
              </div>
            )
            return notification.link ? (
              <Link key={notification.id} to={notification.link} onClick={() => void markOne(notification)} className="block hover:bg-mint-50/60">
                {content}
              </Link>
            ) : (
              <button key={notification.id} onClick={() => void markOne(notification)} className="block w-full text-left hover:bg-mint-50/60">
                {content}
              </button>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<BellOff className="h-6 w-6" />}
          title="No notifications yet"
          description="Booking confirmations, payment receipts and account updates will appear here."
        />
      )}

      <div className="flex items-start gap-2 rounded-2xl border border-midnight-900/[0.07] bg-white px-4 py-3.5">
        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" />
        <p className="text-[10.5px] leading-relaxed text-charcoal-500">
          Need to change which emails you receive? Update your notification preferences in your profile. Important
          booking and payment messages are always sent.
        </p>
      </div>
    </div>
  )
}
