import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Camera, Check, KeyRound, Mail, MapPin, MessageCircle, Phone, ShieldCheck, User } from 'lucide-react'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { updateProfile, uploadAvatar } from '@/services/account'
import { listNotificationLog } from '@/services/notifications'
import { useToast } from '@/components/ui/Feedback'
import { PageHeader, SectionCard } from '@/components/ui/Data'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Form'
import { Avatar } from '@/components/ui/Brand'
import { InfoNote } from '@/components/dashboard/Kit'
import { DeviceNotificationsCard } from '@/components/pwa/DeviceNotificationsCard'
import { usePageTitle } from '@/hooks/usePageTitle'
import { NIGERIAN_STATES, LAUNCH_LOCATIONS } from '@/lib/constants'
import { readNotificationPreferences, type NotificationPreferenceState } from '@/lib/notifications'
import { cn, relativeTime } from '@/lib/utils'

const profileSchema = z.object({
  full_name: z.string().min(2, 'Enter your full name'),
  phone: z.string().min(7, 'Enter a valid phone number'),
  home_address: z.string().optional(),
  preferred_state: z.string().optional(),
  preferred_city: z.string().optional(),
})

export default function ProfilePage() {
  const { user, updatePassword, refreshProfile, isPreview } = useAuth()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    home_address: '',
    preferred_state: '',
    preferred_city: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [passwords, setPasswords] = useState({ next: '', confirm: '' })
  const [prefs, setPrefs] = useState<NotificationPreferenceState>({
    email_transactional: true,
    email_marketing: false,
    sms_transactional: true,
    whatsapp_transactional: false,
  })
  usePageTitle('My profile')

  const { data: deliveryLog = [] } = useQuery({
    queryKey: ['notification-log', user?.id],
    queryFn: () => listNotificationLog(user!.id),
    enabled: Boolean(user?.id),
  })

  useEffect(() => {
    if (!user) return
    setForm({
      full_name: user.profile.full_name,
      email: user.profile.email,
      phone: user.profile.phone ?? '',
      home_address: user.profile.home_address ?? '',
      preferred_state: user.profile.preferred_state ?? '',
      preferred_city: user.profile.preferred_city ?? '',
    })
    const stored = (user.profile.notification_preferences ?? {}) as Record<string, boolean>
    setPrefs(readNotificationPreferences(stored))
  }, [user])

  if (!user) return null

  const saveProfile = async () => {
    const parsed = profileSchema.safeParse(form)
    if (!parsed.success) {
      const next: Record<string, string> = {}
      parsed.error.issues.forEach((issue) => {
        next[String(issue.path[0])] = issue.message
      })
      setErrors(next)
      return
    }
    setErrors({})
    setSaving(true)
    try {
      await updateProfile(user.id, {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        home_address: form.home_address.trim() || null,
        preferred_state: form.preferred_state || null,
        preferred_city: form.preferred_city || null,
      })
      await refreshProfile()
      toast.success('Profile updated', 'Your account details are up to date.')
    } catch (error) {
      toast.error('Could not update profile', (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const savePreferences = async () => {
    setSaving(true)
    try {
      await updateProfile(user.id, { notification_preferences: prefs })
      await refreshProfile()
      toast.success('Notification preferences saved')
    } catch (error) {
      toast.error('Could not save preferences', (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleAvatar = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image too large', 'Choose an image smaller than 5 MB.')
      return
    }
    setUploading(true)
    try {
      await uploadAvatar(user.id, file)
      await refreshProfile()
      toast.success('Photo updated')
    } catch (error) {
      toast.error('Could not upload photo', (error as Error).message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const savePassword = async () => {
    if (passwords.next.length < 8) {
      toast.error('Password too short', 'Use at least 8 characters.')
      return
    }
    if (passwords.next !== passwords.confirm) {
      toast.error('Passwords do not match')
      return
    }
    setPasswordSaving(true)
    const { error } = await updatePassword(passwords.next)
    setPasswordSaving(false)
    if (error) {
      toast.error('Could not update password', error)
      return
    }
    toast.success('Password updated')
    setPasswords({ next: '', confirm: '' })
  }

  const cities = LAUNCH_LOCATIONS.filter((location) => !form.preferred_state || location.state === form.preferred_state)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="My profile"
        description="Your personal details, security and communication preferences."
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <div className="space-y-5">
          <SectionCard title="Profile photo" description="A clear photo builds trust with operators.">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <Avatar name={user.profile.full_name} src={user.profile.avatar_url} size={96} className="text-2xl" />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-midnight-900 text-lime shadow-card transition hover:bg-midnight-800"
                  aria-label="Change profile photo"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleAvatar(event.target.files?.[0])} />
              </div>
              <p className="mt-3 text-[13px] font-semibold text-midnight-900">{user.profile.full_name}</p>
              <p className="text-[11px] text-muted">{user.email}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {user.roles.map((role) => (
                  <span key={role} className="rounded-full bg-mint px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-midnight-800">{role}</span>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-4" loading={uploading} onClick={() => fileRef.current?.click()}>
                <Camera className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : 'Change photo'}
              </Button>
              <p className="mt-2 text-[9px] text-muted">JPG or PNG, up to 5 MB.</p>
            </div>
          </SectionCard>

          <SectionCard title="Account status" description="Verified and protected.">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-xl bg-mint-50 px-3 py-2.5">
                <span className="flex items-center gap-1.5 text-[11px] text-charcoal-600"><Mail className="h-3.5 w-3.5" /> Email</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700"><Check className="h-3 w-3" /> Verified</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-mint-50 px-3 py-2.5">
                <span className="flex items-center gap-1.5 text-[11px] text-charcoal-600"><ShieldCheck className="h-3.5 w-3.5" /> Account security</span>
                <span className="text-[10px] font-semibold text-midnight-900">Password set</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-mint-50 px-3 py-2.5">
                <span className="flex items-center gap-1.5 text-[11px] text-charcoal-600"><User className="h-3.5 w-3.5" /> Member since</span>
                <span className="font-mono text-[10px] text-midnight-900">{new Date(user.profile.created_at).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
          </SectionCard>

          <InfoNote title="Your data, your control">
            You can update your details at any time. To request an export or deletion of your account data, contact
            support from the in-app support centre.
          </InfoNote>
        </div>

        <div className="space-y-5">
          <SectionCard title="Personal details" description="Used on receipts and to reach you about bookings.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={errors.full_name} required>
                <Input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
              </Field>
              <Field label="Email address" hint="Contact support to change your sign-in email.">
                <Input value={form.email} disabled />
              </Field>
              <Field label="Phone number" error={errors.phone} required>
                <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+234 800 000 0000" />
              </Field>
              <Field label="Home address">
                <Input value={form.home_address} onChange={(event) => setForm({ ...form, home_address: event.target.value })} placeholder="Street, area, city" />
              </Field>
              <Field label="Preferred state">
                <Select value={form.preferred_state} onChange={(event) => setForm({ ...form, preferred_state: event.target.value, preferred_city: '' })}>
                  <option value="">Choose a state</option>
                  {NIGERIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                </Select>
              </Field>
              <Field label="Preferred city">
                <Select value={form.preferred_city} onChange={(event) => setForm({ ...form, preferred_city: event.target.value })}>
                  <option value="">Choose a city</option>
                  {(cities.length ? cities : LAUNCH_LOCATIONS).map((location) => (
                    <option key={location.city} value={location.city}>{location.city}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-5 flex justify-end">
              <Button loading={saving} onClick={saveProfile}>Save details</Button>
            </div>
          </SectionCard>

          <SectionCard title="Notification preferences" description="Choose how EV Naija reaches you. Booking and payment receipts are transactional and can be turned off per channel.">
            <div className="space-y-2.5">
              {[
                { key: 'email_transactional' as const, label: 'Booking & payment emails', description: 'Confirmations, receipts, reminders and cancellations.' },
                { key: 'sms_transactional' as const, label: 'Booking reminders by SMS', description: 'A short reminder before your session starts.' },
                { key: 'whatsapp_transactional' as const, label: 'WhatsApp updates', description: 'Booking updates and support replies on WhatsApp.' },
                { key: 'email_marketing' as const, label: 'Product news and offers', description: 'Occasional updates about new stations and features.' },
              ].map((item) => (
                <label key={item.key} className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-midnight-900/[0.07] px-4 py-3">
                  <span>
                    <span className="block text-[12px] font-semibold text-midnight-900">{item.label}</span>
                    <span className="mt-0.5 block text-[10.5px] text-muted">{item.description}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={prefs[item.key]}
                    onChange={(event) => setPrefs({ ...prefs, [item.key]: event.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-midnight-900/20 text-lime focus:ring-lime"
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" loading={saving} onClick={savePreferences}>Save preferences</Button>
            </div>
          </SectionCard>

          <SectionCard title="Delivery log" description="The last messages we attempted to send you.">
            {deliveryLog.length ? (
              <ul className="divide-y divide-midnight-900/[0.06]">
                {deliveryLog.slice(0, 8).map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-mint text-midnight-800">
                        {entry.channel === 'email' ? <Mail className="h-3.5 w-3.5" /> : entry.channel === 'sms' ? <Phone className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                      </span>
                      <div>
                        <p className="text-[12.5px] font-medium text-midnight-900">{entry.title}</p>
                        <p className="text-[10.5px] text-muted">
                          {entry.channel.toUpperCase()} · {entry.provider ?? 'no provider'} · {relativeTime(entry.created_at)}
                        </p>
                      </div>
                    </div>
                    <Badge tone={entry.status === 'sent' ? 'success' : entry.status === 'failed' ? 'danger' : 'neutral'}>
                      {entry.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-muted">No messages have been sent yet.</p>
            )}
          </SectionCard>

          <DeviceNotificationsCard />

          <SectionCard title="Password & security" description="Use a unique password you do not use elsewhere.">
            {isPreview && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[10.5px] leading-relaxed text-amber-800">
                Preview mode: password changes are disabled. Connect Supabase to manage real credentials.
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="New password">
                <Input type="password" value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} placeholder="At least 8 characters" disabled={isPreview} />
              </Field>
              <Field label="Confirm password">
                <Input type="password" value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} placeholder="Repeat password" disabled={isPreview} />
              </Field>
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="dark" loading={passwordSaving} onClick={savePassword} disabled={isPreview}>
                <KeyRound className="h-4 w-4" /> Update password
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
