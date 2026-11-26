import type { AppNotification, NotificationChannel, NotificationLogEntry } from '@/types'
import { supabase } from '@/lib/supabase'
import { isPreviewMode } from '@/lib/env'
import { demoStore } from '@/data/demo'

export { NOTIFICATION_CHANNELS } from '@/lib/notifications'

export interface SendNotificationInput {
  audience: 'all' | 'customers' | 'operators' | 'custom'
  userIds?: string[]
  title: string
  message: string
  link?: string | null
  type?: AppNotification['type'] | 'marketing'
  channels?: NotificationChannel[]
}

export async function listNotificationLog(userId: string): Promise<NotificationLogEntry[]> {
  if (isPreviewMode || !supabase) {
    return [...demoStore.notificationLog]
      .filter((entry) => entry.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }
  const { data, error } = await supabase
    .from('notification_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as NotificationLogEntry[]
}

/**
 * Sends a transactional message through the `send-notification` edge function.
 * The function writes the in-app row and fans out to email/SMS/WhatsApp for
 * every recipient who opted in; unconfigured providers are recorded as
 * `skipped` rather than pretending to have sent.
 */
export async function sendNotification(input: SendNotificationInput): Promise<{ recipients: number; dispatched: number }> {
  if (isPreviewMode || !supabase) {
    const recipients = input.userIds ?? []
    for (const userId of recipients) {
      demoStore.notifications.unshift({
        id: `ntf-${Date.now()}-${userId}`,
        user_id: userId,
        title: input.title,
        message: input.message,
        type: (input.type as AppNotification['type']) ?? 'system',
        is_read: false,
        link: input.link ?? null,
        created_at: new Date().toISOString(),
      })
      for (const channel of input.channels ?? []) {
        demoStore.notificationLog.unshift({
          id: `nlog-${Date.now()}-${channel}-${userId}`,
          user_id: userId,
          channel,
          title: input.title,
          status: 'skipped',
          provider: null,
          error: 'Preview mode — no delivery provider configured',
          created_at: new Date().toISOString(),
        })
      }
    }
    return { recipients: recipients.length, dispatched: 0 }
  }
  const { data, error } = await supabase.functions.invoke('send-notification', { body: input })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return { recipients: data?.recipients ?? 0, dispatched: data?.dispatched ?? 0 }
}
