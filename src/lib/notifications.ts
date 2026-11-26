import type { AppNotification, NotificationChannel } from '@/types'

/**
 * Notification channel metadata shared by the client and the
 * `send-notification` edge function. Preference keys are stored on
 * `profiles.notification_preferences` and are all opt-in by default for
 * transactional messages.
 */
export const NOTIFICATION_CHANNELS: {
  key: NotificationChannel
  label: string
  description: string
}[] = [
  { key: 'email', label: 'Email', description: 'Receipts, confirmations and account notices.' },
  { key: 'sms', label: 'SMS', description: 'Short reminders sent to your Nigerian mobile number.' },
  { key: 'whatsapp', label: 'WhatsApp', description: 'Booking reminders and support replies on WhatsApp.' },
]

export interface NotificationPreferenceState {
  email_transactional: boolean
  email_marketing: boolean
  sms_transactional: boolean
  whatsapp_transactional: boolean
  [key: string]: boolean
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferenceState = {
  email_transactional: true,
  email_marketing: false,
  sms_transactional: true,
  whatsapp_transactional: false,
}

export function readNotificationPreferences(
  stored: Record<string, boolean> | null | undefined,
): NotificationPreferenceState {
  const value = stored ?? {}
  return {
    email_transactional: value.email_transactional ?? value.email_bookings ?? DEFAULT_NOTIFICATION_PREFERENCES.email_transactional,
    email_marketing: value.email_marketing ?? DEFAULT_NOTIFICATION_PREFERENCES.email_marketing,
    sms_transactional: value.sms_transactional ?? value.sms_bookings ?? DEFAULT_NOTIFICATION_PREFERENCES.sms_transactional,
    whatsapp_transactional: value.whatsapp_transactional ?? DEFAULT_NOTIFICATION_PREFERENCES.whatsapp_transactional,
  }
}

/** Marketing types opt into marketing consent; everything else is transactional. */
export function isMarketingType(type: AppNotification['type'] | string) {
  return type === 'marketing'
}

export function preferenceKeyFor(channel: NotificationChannel, type: AppNotification['type'] | string) {
  if (channel === 'email') return isMarketingType(type) ? 'email_marketing' : 'email_transactional'
  if (channel === 'sms') return 'sms_transactional'
  return 'whatsapp_transactional'
}
