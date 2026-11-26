import { json, methodNotAllowed, optionsResponse } from '../_shared/http.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'
import {
  deliverToRecipient,
  loadNotificationConfig,
  type NotificationChannel,
  type NotificationRecipient,
} from '../_shared/notify.ts'

const TYPES = new Set(['booking', 'payment', 'account', 'system', 'review', 'payout', 'marketing'])
const CHANNELS: NotificationChannel[] = ['email', 'sms', 'whatsapp']
const PROFILE_COLUMNS = 'id, email, phone, notification_preferences'

async function isAdmin(db: ReturnType<typeof adminClient>, userId: string) {
  const { data } = await db
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle()
  return Boolean(data)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'POST') return methodNotAllowed()

  try {
    const body = await req.json().catch(() => ({})) as {
      audience?: 'all' | 'customers' | 'operators' | 'custom'
      userIds?: string[]
      title?: string
      message?: string
      link?: string
      type?: string
      channels?: NotificationChannel[]
      inApp?: boolean
    }

    const title = body.title?.trim()
    const message = body.message?.trim()
    if (!title || title.length > 140) return json({ success: false, error: 'A title of up to 140 characters is required.' }, 400)
    if (!message || message.length > 2000) return json({ success: false, error: 'A message of up to 2000 characters is required.' }, 400)

    const audience = body.audience ?? 'all'
    if (!['all', 'customers', 'operators', 'custom'].includes(audience)) {
      return json({ success: false, error: 'Invalid audience.' }, 400)
    }

    const type = body.type && TYPES.has(body.type) ? body.type : 'system'
    const marketing = type === 'marketing'
    const channels = (body.channels ?? []).filter((channel): channel is NotificationChannel => CHANNELS.includes(channel))
    const inApp = body.inApp !== false
    const db = adminClient()

    const caller = await requireUser(req)
    const callerIsAdmin = await isAdmin(db, caller.id)

    if (audience === 'custom' && !callerIsAdmin) {
      // A signed-in user may only notify themselves.
      body.userIds = [caller.id]
    } else if (audience !== 'custom' && !callerIsAdmin) {
      throw new Error('Administrator access is required.')
    }

    let recipients: NotificationRecipient[] = []

    if (audience === 'custom') {
      const ids = [...new Set((body.userIds ?? []).filter(Boolean))]
      if (!ids.length) return json({ success: false, error: 'At least one recipient is required.' }, 400)
      const { data, error } = await db.from('profiles').select(PROFILE_COLUMNS).in('id', ids)
      if (error) throw error
      recipients = (data ?? []) as NotificationRecipient[]
    } else {
      const [{ data: profiles, error: profileError }, { data: roles, error: roleError }] = await Promise.all([
        db.from('profiles').select(`${PROFILE_COLUMNS}, is_suspended`).eq('is_suspended', false),
        db.from('user_roles').select('user_id, role'),
      ])
      if (profileError) throw profileError
      if (roleError) throw roleError

      const roleMap = new Map<string, string[]>()
      for (const row of roles ?? []) {
        const current = roleMap.get(row.user_id) ?? []
        current.push(row.role)
        roleMap.set(row.user_id, current)
      }

      const targetRole = audience === 'customers' ? 'customer' : audience === 'operators' ? 'operator' : null
      recipients = (profiles ?? [])
        .filter((profile) => !targetRole || (roleMap.get(profile.id) ?? []).includes(targetRole))
        .map((profile) => ({
          id: profile.id,
          email: profile.email,
          phone: profile.phone,
          notification_preferences: profile.notification_preferences,
        }))
    }

    if (!recipients.length) return json({ success: true, recipients: 0, dispatched: 0 })

    if (inApp) {
      const rows = recipients.map((recipient) => ({
        user_id: recipient.id,
        title,
        message,
        type,
        link: body.link?.trim() || null,
      }))
      const chunkSize = 500
      for (let index = 0; index < rows.length; index += chunkSize) {
        const { error } = await db.from('notifications').insert(rows.slice(index, index + chunkSize))
        if (error) throw error
      }
    }

    let dispatched = 0
    if (channels.length) {
      const config = await loadNotificationConfig(db)
      const logRows: Record<string, unknown>[] = []

      for (const recipient of recipients) {
        const results = await deliverToRecipient(config, recipient, { title, message, channels, marketing })
        for (const result of results) {
          if (result.status === 'sent') dispatched += 1
          logRows.push({
            user_id: recipient.id,
            channel: result.channel,
            title,
            status: result.status,
            provider: result.provider,
            error: result.error,
          })
        }
      }

      const chunkSize = 500
      for (let index = 0; index < logRows.length; index += chunkSize) {
        const { error } = await db.from('notification_log').insert(logRows.slice(index, index + chunkSize))
        if (error) throw error
      }
    }

    return json({ success: true, recipients: recipients.length, dispatched })
  } catch (error) {
    console.error('send-notification', error)
    return json({ success: false, error: (error as Error).message }, 400)
  }
})
