import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.47.10'

export type NotificationChannel = 'email' | 'sms' | 'whatsapp'
export type DeliveryStatus = 'sent' | 'skipped' | 'failed'

export interface DeliveryResult {
  channel: NotificationChannel
  provider: string | null
  status: DeliveryStatus
  error: string | null
}

export interface NotificationConfig {
  emailEnabled: boolean
  smsEnabled: boolean
  whatsappEnabled: boolean
  emailFromName: string
  emailFromAddress: string
  smsSenderId: string
  whatsappSender: string
}

export interface NotificationRecipient {
  id: string
  email: string | null
  phone: string | null
  notification_preferences: Record<string, boolean> | null
}

const DEFAULT_CONFIG: NotificationConfig = {
  emailEnabled: true,
  smsEnabled: true,
  whatsappEnabled: false,
  emailFromName: 'EV Naija',
  emailFromAddress: 'notifications@evnaija.ng',
  smsSenderId: 'EVNaija',
  whatsappSender: '',
}

function settingValue(rows: { key: string; value: unknown }[], key: string): unknown {
  const row = rows.find((item) => item.key === key)
  const value = row?.value as { value?: unknown } | undefined
  return value?.value
}

export async function loadNotificationConfig(db: SupabaseClient): Promise<NotificationConfig> {
  const { data } = await db
    .from('platform_settings')
    .select('key, value')
    .like('key', 'notification_%')

  const rows = (data ?? []) as { key: string; value: unknown }[]
  return {
    emailEnabled: (settingValue(rows, 'notification_email_enabled') as boolean) ?? DEFAULT_CONFIG.emailEnabled,
    smsEnabled: (settingValue(rows, 'notification_sms_enabled') as boolean) ?? DEFAULT_CONFIG.smsEnabled,
    whatsappEnabled: (settingValue(rows, 'notification_whatsapp_enabled') as boolean) ?? DEFAULT_CONFIG.whatsappEnabled,
    emailFromName: (settingValue(rows, 'notification_email_from_name') as string) || DEFAULT_CONFIG.emailFromName,
    emailFromAddress: (settingValue(rows, 'notification_email_from_address') as string) || DEFAULT_CONFIG.emailFromAddress,
    smsSenderId: (settingValue(rows, 'notification_sms_sender_id') as string) || DEFAULT_CONFIG.smsSenderId,
    whatsappSender: (settingValue(rows, 'notification_whatsapp_sender') as string) || DEFAULT_CONFIG.whatsappSender,
  }
}

function skipped(channel: NotificationChannel, error: string): DeliveryResult {
  return { channel, provider: null, status: 'skipped', error }
}

function failed(channel: NotificationChannel, provider: string, error: string): DeliveryResult {
  return { channel, provider, status: 'failed', error }
}

function sent(channel: NotificationChannel, provider: string): DeliveryResult {
  return { channel, provider, status: 'sent', error: null }
}

function optedIn(recipient: NotificationRecipient, channel: NotificationChannel, marketing: boolean) {
  const prefs = recipient.notification_preferences ?? {}
  if (channel === 'email') {
    return marketing
      ? prefs.email_marketing === true
      : prefs.email_transactional ?? prefs.email_bookings ?? true
  }
  if (channel === 'sms') return prefs.sms_transactional ?? prefs.sms_bookings ?? true
  return prefs.whatsapp_transactional === true
}

async function sendEmail(
  config: NotificationConfig,
  recipient: NotificationRecipient,
  subject: string,
  body: string,
): Promise<DeliveryResult> {
  if (!config.emailEnabled) return skipped('email', 'Email channel is disabled in settings')
  if (!recipient.email) return skipped('email', 'Recipient has no email address')
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return skipped('email', 'RESEND_API_KEY is not configured')

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${config.emailFromName} <${config.emailFromAddress}>`,
        to: [recipient.email],
        subject,
        text: body,
      }),
    })
    if (!response.ok) {
      return failed('email', 'resend', `Resend responded ${response.status}`)
    }
    return sent('email', 'resend')
  } catch (error) {
    return failed('email', 'resend', (error as Error).message)
  }
}

async function sendSms(
  config: NotificationConfig,
  recipient: NotificationRecipient,
  body: string,
): Promise<DeliveryResult> {
  if (!config.smsEnabled) return skipped('sms', 'SMS channel is disabled in settings')
  if (!recipient.phone) return skipped('sms', 'Recipient has no phone number')
  const apiKey = Deno.env.get('TERMII_API_KEY')
  if (!apiKey) return skipped('sms', 'TERMII_API_KEY is not configured')

  try {
    const response = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: recipient.phone,
        from: config.smsSenderId,
        sms: body,
        type: 'plain',
        channel: 'generic',
        api_key: apiKey,
      }),
    })
    if (!response.ok) {
      return failed('sms', 'termii', `Termii responded ${response.status}`)
    }
    return sent('sms', 'termii')
  } catch (error) {
    return failed('sms', 'termii', (error as Error).message)
  }
}

async function sendWhatsApp(
  config: NotificationConfig,
  recipient: NotificationRecipient,
  body: string,
): Promise<DeliveryResult> {
  if (!config.whatsappEnabled) return skipped('whatsapp', 'WhatsApp channel is disabled in settings')
  if (!recipient.phone) return skipped('whatsapp', 'Recipient has no phone number')
  const token = Deno.env.get('WHATSAPP_TOKEN')
  const phoneId = Deno.env.get('WHATSAPP_PHONE_ID') ?? config.whatsappSender
  if (!token || !phoneId) return skipped('whatsapp', 'WHATSAPP_TOKEN or sender is not configured')

  try {
    const response = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipient.phone.replace(/[^\d]/g, ''),
        type: 'text',
        text: { body },
      }),
    })
    if (!response.ok) {
      return failed('whatsapp', 'meta', `Meta Cloud API responded ${response.status}`)
    }
    return sent('whatsapp', 'meta')
  } catch (error) {
    return failed('whatsapp', 'meta', (error as Error).message)
  }
}

/**
 * Fans a message out to every requested channel the recipient has opted into.
 * Unconfigured providers are reported as `skipped`, never as sent.
 */
export async function deliverToRecipient(
  config: NotificationConfig,
  recipient: NotificationRecipient,
  input: { title: string; message: string; channels: NotificationChannel[]; marketing: boolean },
): Promise<DeliveryResult[]> {
  const body = `${input.title}\n\n${input.message}`
  const results: DeliveryResult[] = []

  for (const channel of input.channels) {
    if (!optedIn(recipient, channel, input.marketing)) {
      results.push(skipped(channel, 'Recipient opted out of this channel'))
      continue
    }
    if (channel === 'email') results.push(await sendEmail(config, recipient, input.title, body))
    else if (channel === 'sms') results.push(await sendSms(config, recipient, body))
    else results.push(await sendWhatsApp(config, recipient, body))
  }

  return results
}
