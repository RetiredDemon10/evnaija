import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { listCustomerBookings } from '@/services/bookings'
import { isReminderDue } from '@/lib/recurrence'
import {
  NOTIFICATIONS_SEEN_KEY,
  notificationsEnabled,
  showLocalNotification,
} from '@/lib/pwa'
import { formatDate } from '@/lib/utils'

function readSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_SEEN_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return []
  }
}

function markSeen(id: string) {
  const seen = [id, ...readSeen().filter((value) => value !== id)].slice(0, 60)
  window.localStorage.setItem(NOTIFICATIONS_SEEN_KEY, JSON.stringify(seen))
}

/**
 * Local, on-device reminder. This intentionally does not promise background
 * push: the component checks when the app is open. A production push service
 * can reuse the notification payloads later.
 */
export function BookingReminders() {
  const { user } = useAuth()
  const { data: bookings = [] } = useQuery({
    queryKey: ['customer-bookings', user?.id],
    queryFn: () => listCustomerBookings(user?.id),
    enabled: Boolean(user?.id),
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
  })

  useEffect(() => {
    if (!notificationsEnabled()) return

    const check = () => {
      const seen = new Set(readSeen())
      const due = bookings
        .filter(
          (booking) =>
            ['confirmed', 'checked_in'].includes(booking.status) &&
            !seen.has(booking.id) &&
            isReminderDue(booking.start_time),
        )
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0]

      if (!due) return
      const minutes = Math.max(1, Math.round((new Date(due.start_time).getTime() - Date.now()) / 60_000))
      markSeen(due.id)
      void showLocalNotification('Charging session soon', {
        body: `${due.station?.name ?? 'Your station'} at ${formatDate(due.start_time, 'HH:mm')} — about ${minutes} minutes away.`,
        url: `/app/bookings/${due.id}`,
        tag: `ev-naija-booking-${due.id}`,
        requireInteraction: true,
      })
    }

    check()
    const timer = window.setInterval(check, 60_000)
    return () => window.clearInterval(timer)
  }, [bookings])

  return null
}
