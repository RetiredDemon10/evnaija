import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Database,
  KeyRound,
  Map,
  Save,
  Settings,
  ShieldCheck,
  Wrench,
  XCircle,
} from 'lucide-react'
import { listPlatformSettings, savePlatformSetting, writeAuditLog } from '@/services/admin'
import { PageHeader, SectionCard } from '@/components/ui/Data'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Form'
import { InfoNote } from '@/components/dashboard/Kit'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { env, isMapsConfigured, isPaystackConfigured, isPreviewMode, isSupabaseConfigured } from '@/lib/env'

type FormShape = {
  booking_hold_minutes: string
  cancellation_window_hours: string
  max_active_bookings_per_user: string
  maintenance_mode: boolean
  maintenance_message: string
  review_moderation_required: boolean
  payout_auto_approval: boolean
  notify_on_new_booking: boolean
  notify_on_payout_request: boolean
}

const DEFAULTS: FormShape = {
  booking_hold_minutes: '15',
  cancellation_window_hours: '2',
  max_active_bookings_per_user: '3',
  maintenance_mode: false,
  maintenance_message: 'We are performing scheduled maintenance on bookings. Charging remains available at live stations.',
  review_moderation_required: false,
  payout_auto_approval: false,
  notify_on_new_booking: true,
  notify_on_payout_request: true,
}

const settingValue = <T,>(settings: { key: string; value: Record<string, unknown> }[], key: string, fallback: T): T => {
  const setting = settings.find((item) => item.key === key)
  return setting && setting.value.value !== undefined ? (setting.value.value as T) : fallback
}

export default function AdminSettingsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormShape>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  usePageTitle('System settings')

  const { data: settings = [], isLoading } = useQuery({ queryKey: ['admin-settings'], queryFn: listPlatformSettings })

  useEffect(() => {
    if (!settings.length) return
    setForm({
      booking_hold_minutes: String(settingValue(settings, 'booking_hold_minutes', DEFAULTS.booking_hold_minutes)),
      cancellation_window_hours: String(settingValue(settings, 'cancellation_window_hours', DEFAULTS.cancellation_window_hours)),
      max_active_bookings_per_user: String(
        settingValue(settings, 'max_active_bookings_per_user', DEFAULTS.max_active_bookings_per_user),
      ),
      maintenance_mode: Boolean(settingValue(settings, 'maintenance_mode', DEFAULTS.maintenance_mode)),
      maintenance_message: String(settingValue(settings, 'maintenance_message', DEFAULTS.maintenance_message)),
      review_moderation_required: Boolean(
        settingValue(settings, 'review_moderation_required', DEFAULTS.review_moderation_required),
      ),
      payout_auto_approval: Boolean(settingValue(settings, 'payout_auto_approval', DEFAULTS.payout_auto_approval)),
      notify_on_new_booking: Boolean(settingValue(settings, 'notify_on_new_booking', DEFAULTS.notify_on_new_booking)),
      notify_on_payout_request: Boolean(
        settingValue(settings, 'notify_on_payout_request', DEFAULTS.notify_on_payout_request),
      ),
    })
  }, [settings])

  const save = async () => {
    const hold = Number(form.booking_hold_minutes)
    const cancel = Number(form.cancellation_window_hours)
    const maxActive = Number(form.max_active_bookings_per_user)
    if (!Number.isFinite(hold) || hold < 5 || hold > 60) {
      toast.error('Invalid hold window', 'Booking hold must be between 5 and 60 minutes.')
      return
    }
    if (!Number.isFinite(cancel) || cancel < 0 || cancel > 48) {
      toast.error('Invalid cancellation window', 'Cancellation window must be between 0 and 48 hours.')
      return
    }
    if (!Number.isFinite(maxActive) || maxActive < 1 || maxActive > 20) {
      toast.error('Invalid booking limit', 'Active booking limit must be between 1 and 20.')
      return
    }
    if (form.maintenance_mode && form.maintenance_message.trim().length < 10) {
      toast.error('Add a maintenance message', 'Tell users what is happening and when it will end.')
      return
    }
    setSaving(true)
    try {
      const payload: [string, unknown][] = [
        ['booking_hold_minutes', hold],
        ['cancellation_window_hours', cancel],
        ['max_active_bookings_per_user', maxActive],
        ['maintenance_mode', form.maintenance_mode],
        ['maintenance_message', form.maintenance_message.trim()],
        ['review_moderation_required', form.review_moderation_required],
        ['payout_auto_approval', form.payout_auto_approval],
        ['notify_on_new_booking', form.notify_on_new_booking],
        ['notify_on_payout_request', form.notify_on_payout_request],
      ]
      await Promise.all(payload.map(([key, value]) => savePlatformSetting(key, { value }, 'Operational setting')))
      if (user) {
        await writeAuditLog(user.id, 'settings.operations_updated', 'platform_settings', null, {
          ...Object.fromEntries(payload),
        })
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
      toast.success('System settings saved', 'New bookings and operations use these values immediately.')
    } catch (error) {
      toast.error('Could not save settings', (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <PageLoader label="Loading system settings" />

  const status = [
    { label: 'Supabase', ok: isSupabaseConfigured, detail: isSupabaseConfigured ? 'Connected' : 'Missing environment keys', icon: Database },
    { label: 'Paystack', ok: isPaystackConfigured, detail: isPaystackConfigured ? 'Public key loaded' : 'Missing public key', icon: KeyRound },
    { label: 'Maps', ok: isMapsConfigured, detail: isMapsConfigured ? 'Premium style configured' : 'OpenStreetMap fallback', icon: Map },
    { label: 'Preview data', ok: !isPreviewMode, detail: isPreviewMode ? 'Sample fixtures active' : 'Live data only', icon: ShieldCheck },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuration"
        title="System settings"
        description="Operational rules for bookings, reviews, payouts and platform notifications. Financial credentials stay in server secrets."
        actions={
          <Button loading={saving} onClick={save}>
            <Save className="h-4 w-4" /> Save settings
          </Button>
        }
      />

      {form.maintenance_mode && (
        <div className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3.5">
          <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p className="text-[11px] leading-relaxed text-amber-800">
            Maintenance mode is ON. Customers see the maintenance message and cannot create new bookings. Existing sessions
            continue normally.
          </p>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <SectionCard title="Booking rules" description="Applied server-side by the create_booking function.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment hold (minutes)" required hint="How long a slot is reserved during checkout.">
              <Input
                type="number"
                min={5}
                max={60}
                value={form.booking_hold_minutes}
                onChange={(event) => setForm({ ...form, booking_hold_minutes: event.target.value })}
              />
            </Field>
            <Field label="Free cancellation window (hours)" required hint="Customers can cancel without a fee inside this window.">
              <Input
                type="number"
                min={0}
                max={48}
                value={form.cancellation_window_hours}
                onChange={(event) => setForm({ ...form, cancellation_window_hours: event.target.value })}
              />
            </Field>
            <Field label="Maximum active bookings per driver" required hint="Prevents slot hoarding.">
              <Input
                type="number"
                min={1}
                max={20}
                value={form.max_active_bookings_per_user}
                onChange={(event) => setForm({ ...form, max_active_bookings_per_user: event.target.value })}
              />
            </Field>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-mint-50 px-3 py-2.5">
            <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-midnight-700" />
            <p className="text-[9.5px] leading-relaxed text-charcoal-600">
              Hold windows shorter than 10 minutes increase failed payments on slow networks. Keep the cancellation window
              aligned with the customer promise on the booking page.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Environment" description="Read-only deployment status.">
          <div className="space-y-2.5">
            {status.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-midnight-900/[0.07] px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className={`grid h-8 w-8 place-items-center rounded-lg ${item.ok ? 'bg-lime/25 text-midnight-800' : 'bg-amber-50 text-amber-700'}`}>
                    <item.icon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold text-midnight-900">{item.label}</p>
                    <p className="text-[9px] text-muted">{item.detail}</p>
                  </div>
                </div>
                {item.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-amber-600" />}
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-charcoal-50 px-3 py-2.5">
            <p className="text-[9px] leading-relaxed text-charcoal-500">
              App URL: <span className="font-mono">{env.appUrl}</span>
            </p>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Maintenance mode" description="Use only for planned booking outages.">
          <label className="flex items-start gap-3 rounded-2xl border border-midnight-900/[0.07] p-3.5">
            <input
              type="checkbox"
              checked={form.maintenance_mode}
              onChange={(event) => setForm({ ...form, maintenance_mode: event.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-midnight-900/20 text-lime focus:ring-lime"
            />
            <div>
              <p className="text-[11.5px] font-semibold text-midnight-900">Pause new bookings</p>
              <p className="mt-0.5 text-[9.5px] leading-relaxed text-muted">
                Blocks booking creation across all stations. Does not stop charging sessions already in progress.
              </p>
            </div>
          </label>
          <Field label="Maintenance message" className="mt-3" hint="Shown to customers attempting to book.">
            <Textarea
              rows={3}
              value={form.maintenance_message}
              onChange={(event) => setForm({ ...form, maintenance_message: event.target.value })}
            />
          </Field>
        </SectionCard>

        <SectionCard title="Moderation & payouts" description="Controls that affect trust and money movement.">
          <div className="space-y-2.5">
            {[
              {
                key: 'review_moderation_required' as const,
                title: 'Review moderation required',
                description: 'New reviews stay hidden until an admin publishes them.',
                icon: ShieldCheck,
              },
              {
                key: 'payout_auto_approval' as const,
                title: 'Auto-approve payouts',
                description: 'Skip manual approval for verified operators under the limit. Transfers are still sent manually.',
                icon: KeyRound,
              },
              {
                key: 'notify_on_new_booking' as const,
                title: 'Admin booking alerts',
                description: 'Notify administrators when a new booking is paid.',
                icon: BellRing,
              },
              {
                key: 'notify_on_payout_request' as const,
                title: 'Admin payout alerts',
                description: 'Notify administrators when an operator requests a payout.',
                icon: BellRing,
              },
            ].map((toggle) => (
              <label key={toggle.key} className="flex items-start justify-between gap-3 rounded-2xl border border-midnight-900/[0.07] p-3.5">
                <div className="flex items-start gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-mint text-midnight-800">
                    <toggle.icon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-[11.5px] font-semibold text-midnight-900">{toggle.title}</p>
                    <p className="mt-0.5 text-[9.5px] leading-relaxed text-muted">{toggle.description}</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={form[toggle.key]}
                  onChange={(event) => setForm({ ...form, [toggle.key]: event.target.checked })}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-midnight-900/20 text-lime focus:ring-lime"
                />
              </label>
            ))}
          </div>
        </SectionCard>
      </div>

      <InfoNote title="Secrets are not editable here" tone="warning">
        Paystack secret keys, webhook secrets and service-role credentials live only in Supabase Edge Function secrets.
        Rotate them in the Supabase dashboard — never in the browser or this settings table.
      </InfoNote>

      <div className="flex justify-end">
        <Button loading={saving} onClick={save}>
          <Save className="h-4 w-4" /> Save settings
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-2xl border border-midnight-900/[0.07] bg-white px-4 py-3.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" />
        <p className="text-[10.5px] leading-relaxed text-charcoal-500">
          Operational changes are audited. Test booking and payout edge cases in staging before changing live rules.
        </p>
      </div>
    </div>
  )
}
