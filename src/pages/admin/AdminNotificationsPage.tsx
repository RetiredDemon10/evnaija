import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCircle2, Info, Mail, Megaphone, MessageSquare, Phone, Send, Sparkles, Users } from 'lucide-react'
import { broadcastNotification, listAuditLogs, listPlatformSettings, writeAuditLog } from '@/services/admin'
import type { AppNotification } from '@/types'
import { PageHeader, SectionCard } from '@/components/ui/Data'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Form'
import { TableEmpty } from '@/components/dashboard/Kit'
import { useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDateTime } from '@/lib/utils'

const AUDIENCES: { value: 'all' | 'customers' | 'operators'; label: string; description: string }[] = [
  { value: 'all', label: 'Everyone', description: 'Drivers, operators and admins' },
  { value: 'customers', label: 'Drivers only', description: 'Customer accounts' },
  { value: 'operators', label: 'Operators only', description: 'Business accounts' },
]

const TYPES: { value: AppNotification['type']; label: string }[] = [
  { value: 'system', label: 'System update' },
  { value: 'account', label: 'Account notice' },
  { value: 'booking', label: 'Booking update' },
  { value: 'payment', label: 'Payment notice' },
]

export default function AdminNotificationsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [audience, setAudience] = useState<'all' | 'customers' | 'operators'>('all')
  const [type, setType] = useState<AppNotification['type']>('system')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [link, setLink] = useState('')
  const [sending, setSending] = useState(false)
  const [lastCount, setLastCount] = useState<number | null>(null)
  usePageTitle('Notifications')

  const auditQuery = useQuery({ queryKey: ['admin-audit'], queryFn: listAuditLogs })
  const settingsQuery = useQuery({ queryKey: ['admin-settings'], queryFn: listPlatformSettings })
  const broadcasts = useMemo(
    () => (auditQuery.data ?? []).filter((log) => log.action === 'notification.broadcast').slice(0, 8),
    [auditQuery.data],
  )
  const channels = useMemo(() => {
    const rows = settingsQuery.data ?? []
    const read = (key: string): unknown => (rows.find((row) => row.key === key)?.value as { value?: unknown } | undefined)?.value
    return [
      {
        key: 'email',
        label: 'Email',
        icon: Mail,
        enabled: read('notification_email_enabled') !== false,
        detail: String(read('notification_email_from_address') || 'notifications@evnaija.ng'),
        secret: 'RESEND_API_KEY',
      },
      {
        key: 'sms',
        label: 'SMS',
        icon: MessageSquare,
        enabled: read('notification_sms_enabled') !== false,
        detail: `Sender ID: ${String(read('notification_sms_sender_id') || 'EVNaija')}`,
        secret: 'TERMII_API_KEY',
      },
      {
        key: 'whatsapp',
        label: 'WhatsApp',
        icon: Phone,
        enabled: read('notification_whatsapp_enabled') === true,
        detail: String(read('notification_whatsapp_sender') || 'Phone number ID not set'),
        secret: 'WHATSAPP_TOKEN',
      },
    ]
  }, [settingsQuery.data])

  const reset = () => {
    setTitle('')
    setMessage('')
    setLink('')
    setLastCount(null)
  }

  const send = async () => {
    if (title.trim().length < 3) {
      toast.error('Add a subject', 'Notification titles need at least 3 characters.')
      return
    }
    if (message.trim().length < 10) {
      toast.error('Add a message', 'Write a clear message of at least 10 characters.')
      return
    }
    setSending(true)
    try {
      const result = await broadcastNotification({
        audience,
        title: title.trim(),
        message: message.trim(),
        type,
        link: link.trim() || undefined,
      })
      if (user) {
        await writeAuditLog(user.id, 'notification.broadcast', 'notification', null, {
          audience,
          type,
          title: title.trim(),
          link: link.trim() || null,
          recipients: result.recipients,
        })
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setLastCount(result.recipients)
      toast.success('Notification sent', `Delivered to ${result.recipients} account${result.recipients === 1 ? '' : 's'}.`)
    } catch (error) {
      toast.error('Could not send notification', (error as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Platform notifications"
        description="Send in-app announcements to drivers or operators. Messages appear in the notification bell and are stored per account."
      />

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <SectionCard title="Compose announcement" description="Keep it short, specific and actionable.">
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Audience</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {AUDIENCES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setAudience(item.value)}
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      audience === item.value
                        ? 'border-lime-500 bg-lime/15'
                        : 'border-midnight-900/[0.07] bg-white hover:bg-mint-50'
                    }`}
                  >
                    <p className="text-[11.5px] font-semibold text-midnight-900">{item.label}</p>
                    <p className="mt-0.5 text-[9px] text-muted">{item.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <Field label="Category">
              <div className="flex flex-wrap gap-2">
                {TYPES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setType(item.value)}
                    className={`rounded-full px-3 py-1.5 text-[10.5px] font-semibold transition ${
                      type === item.value ? 'bg-midnight-900 text-lime' : 'bg-charcoal-50 text-charcoal-600 hover:bg-mint-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Title" required hint="Shown in bold in the notification list.">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Scheduled maintenance this weekend" maxLength={80} />
            </Field>

            <Field label="Message" required hint={`${message.length}/280 characters`}>
              <Textarea
                rows={4}
                value={message}
                onChange={(event) => setMessage(event.target.value.slice(0, 280))}
                placeholder="Some Lagos stations will be briefly unavailable on Saturday from 08:00 while we upgrade chargers."
              />
            </Field>

            <Field label="Deep link (optional)" hint="Where tapping the notification should take the user.">
              <Input value={link} onChange={(event) => setLink(event.target.value)} placeholder="/app/stations" />
            </Field>

            {lastCount !== null && (
              <div className="flex items-center gap-2 rounded-xl bg-lime/15 px-3 py-2.5 text-[10.5px] text-charcoal-600">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Sent to {lastCount} accounts. You can send another announcement.
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-midnight-900/[0.06] pt-4">
              <button onClick={reset} className="text-[10.5px] font-semibold text-muted hover:text-charcoal-600">
                Clear form
              </button>
              <Button loading={sending} onClick={send}>
                <Send className="h-4 w-4" /> Send notification
              </Button>
            </div>
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="Live preview" description="How it will look in the notification bell.">
            <div className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-lime/25 text-midnight-800">
                  <Bell className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[12px] font-semibold text-midnight-900">{title.trim() || 'Notification title'}</p>
                    {lastCount === null && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-lime-500" />}
                  </div>
                  <p className="mt-0.5 line-clamp-3 text-[10.5px] leading-relaxed text-muted">
                    {message.trim() || 'Your message will appear here. Drivers and operators see this in their notifications list.'}
                  </p>
                  <p className="mt-1.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted">
                    {type} · just now
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-mint-50 px-3 py-2.5">
              <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-midnight-700" />
              <p className="text-[9.5px] leading-relaxed text-charcoal-600">
                {AUDIENCES.find((item) => item.value === audience)?.description}. Delivery is in-app only; email and SMS are sent
                through the backend notification worker.
              </p>
            </div>
          </SectionCard>

          <SectionCard title="Delivery channels" description="Transactional email, SMS and WhatsApp. Each channel stays off until its provider secret is configured.">
            <ul className="space-y-3">
              {channels.map((channel) => {
                const Icon = channel.icon
                return (
                  <li key={channel.key} className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-mint text-midnight-800">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11.5px] font-semibold text-midnight-900">{channel.label}</p>
                        <p className="truncate text-[9.5px] text-muted">{channel.detail}</p>
                        <p className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted">{channel.secret}</p>
                      </div>
                    </div>
                    <Badge tone={channel.enabled ? 'success' : 'neutral'}>{channel.enabled ? 'on' : 'off'}</Badge>
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-mint-50 px-3 py-2.5">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-midnight-700" />
              <p className="text-[9.5px] leading-relaxed text-charcoal-600">
                Messages are only marked <span className="font-semibold">sent</span> when the provider accepts them. Without a
                provider secret a channel is logged as <span className="font-semibold">skipped</span> — never as delivered.
              </p>
            </div>
          </SectionCard>

          <SectionCard title="Guidelines" description="Protect trust and avoid notification fatigue.">
            <ul className="space-y-2">
              {[
                'Only send announcements that affect the recipient.',
                'Never include passwords, card details or private customer data.',
                'Use deep links so drivers can act immediately.',
                'Coordinate maintenance notices with affected operators first.',
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2 text-[10.5px] leading-relaxed text-charcoal-600">
                  <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-lime-600" /> {tip}
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Recent broadcasts" description="Last 8 announcements sent from this console.">
        {broadcasts.length ? (
          <div className="divide-y divide-midnight-900/[0.06]">
            {broadcasts.map((log) => {
              const details = (log.details ?? {}) as Record<string, unknown>
              return (
                <div key={log.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-mint text-midnight-800">
                      <Megaphone className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <p className="text-[11.5px] font-semibold text-midnight-900">{String(details.title ?? 'Announcement')}</p>
                      <p className="text-[9.5px] text-muted">
                        {String(details.audience ?? 'all')} · {String(details.recipients ?? 0)} recipients · {formatDateTime(log.created_at)}
                      </p>
                    </div>
                  </div>
                  <Badge tone="neutral">{log.admin?.full_name ?? 'Admin'}</Badge>
                </div>
              )
            })}
          </div>
        ) : (
          <TableEmpty
            title="No broadcasts yet"
            description="Announcements you send from this console will be listed here for accountability."
          />
        )}
        {auditQuery.isLoading && <div className="h-16 animate-pulse rounded-2xl bg-charcoal-50" />}
      </SectionCard>

      <div className="flex items-start gap-2 rounded-2xl border border-midnight-900/[0.07] bg-white px-4 py-3.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" />
        <p className="text-[10.5px] leading-relaxed text-charcoal-500">
          Production delivery runs through the <code className="font-mono text-[9.5px]">send-notification</code> edge function,
          which writes to the notifications table with service-role credentials. Users control channel preferences in their
          profile settings.
        </p>
      </div>
    </div>
  )
}
