import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Globe2, Instagram, Linkedin, Mail, Megaphone, Phone, Save, Sparkles, Twitter } from 'lucide-react'
import { listPlatformSettings, savePlatformSetting, writeAuditLog } from '@/services/admin'
import { PageHeader, SectionCard } from '@/components/ui/Data'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Form'
import { InfoNote } from '@/components/dashboard/Kit'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'

const CONTENT_KEYS = {
  hero_headline: 'Your journey. Fully charged.',
  hero_subheadline:
    'Discover verified EV charging stations across Nigeria. Reserve a charger, pay securely and get back on the road with confidence.',
  homepage_announcement: '',
  footer_tagline: 'Powering Nigeria’s electric future, one charge at a time.',
  support_email: 'support@evnaija.ng',
  support_phone: '+234 800 EV NAIJA',
  social_instagram: '',
  social_x: '',
  social_linkedin: '',
}

type ContentKey = keyof typeof CONTENT_KEYS
type ContentForm = Record<ContentKey, string>

const toForm = (values: Record<ContentKey, string>) => ({ ...values })

export default function AdminContentPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ContentForm>(toForm(CONTENT_KEYS))
  const [saving, setSaving] = useState(false)
  usePageTitle('Website content')

  const { data: settings = [], isLoading } = useQuery({ queryKey: ['admin-settings'], queryFn: listPlatformSettings })

  useEffect(() => {
    if (!settings.length) return
    const next = { ...CONTENT_KEYS }
    for (const key of Object.keys(CONTENT_KEYS) as ContentKey[]) {
      const setting = settings.find((item) => item.key === key)
      if (setting && typeof setting.value.value === 'string') next[key] = setting.value.value as string
    }
    setForm(next)
  }, [settings])

  const set = (key: ContentKey, value: string) => setForm((current) => ({ ...current, [key]: value }))

  const save = async () => {
    if (form.hero_headline.trim().length < 6) {
      toast.error('Headline too short', 'Write a clear homepage headline.')
      return
    }
    if (form.hero_subheadline.trim().length < 20) {
      toast.error('Subheadline too short', 'Explain the value in at least 20 characters.')
      return
    }
    if (form.support_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.support_email)) {
      toast.error('Invalid support email', 'Enter a valid email address.')
      return
    }
    setSaving(true)
    try {
      const entries = Object.entries(form) as [ContentKey, string][]
      await Promise.all(entries.map(([key, value]) => savePlatformSetting(key, { value: value.trim() }, 'Website content')))
      if (user) {
        await writeAuditLog(user.id, 'content.updated', 'platform_settings', null, {
          keys: entries.map(([key]) => key),
        })
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      await queryClient.invalidateQueries({ queryKey: ['platform-content'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
      toast.success('Website content saved', 'The public site reads these values on its next load.')
    } catch (error) {
      toast.error('Could not save content', (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <PageLoader label="Loading website content" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuration"
        title="Website content"
        description="Marketing copy and public contact details. Changes are stored in platform_settings and read by the public site."
        actions={
          <Button loading={saving} onClick={save}>
            <Save className="h-4 w-4" /> Publish changes
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <SectionCard title="Homepage hero" description="The first message drivers see.">
          <div className="space-y-4">
            <Field label="Headline" required hint="Short, confident and specific.">
              <Input value={form.hero_headline} onChange={(event) => set('hero_headline', event.target.value)} maxLength={90} />
            </Field>
            <Field label="Subheadline" required hint={`${form.hero_subheadline.length}/180 characters`}>
              <Textarea
                rows={3}
                value={form.hero_subheadline}
                onChange={(event) => set('hero_subheadline', event.target.value.slice(0, 180))}
              />
            </Field>
            <Field label="Sitewide announcement" hint="Optional. Leave blank to hide the announcement bar.">
              <Input
                value={form.homepage_announcement}
                onChange={(event) => set('homepage_announcement', event.target.value)}
                placeholder="New stations now live in Port Harcourt"
                maxLength={120}
              />
            </Field>
            <Field label="Footer tagline">
              <Input value={form.footer_tagline} onChange={(event) => set('footer_tagline', event.target.value)} maxLength={120} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Hero preview" description="Approximate desktop rendering.">
          <div className="overflow-hidden rounded-2xl bg-midnight-950 p-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lime px-2 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-midnight-900">
              <Globe2 className="h-2.5 w-2.5" /> Live network
            </span>
            <p className="mt-3 font-display text-xl font-semibold leading-tight text-white">
              {form.hero_headline || 'Your journey. Fully charged.'}
            </p>
            <p className="mt-2 line-clamp-3 text-[10.5px] leading-relaxed text-white/55">
              {form.hero_subheadline || 'Add a subheadline to preview it here.'}
            </p>
            <div className="mt-4 flex gap-2">
              <span className="rounded-lg bg-lime px-3 py-1.5 text-[9px] font-semibold text-midnight-900">Find a station</span>
              <span className="rounded-lg border border-white/20 px-3 py-1.5 text-[9px] font-semibold text-white">Become a partner</span>
            </div>
          </div>
          {form.homepage_announcement && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-lime/15 px-3 py-2.5">
              <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-midnight-800" />
              <p className="text-[10px] text-charcoal-600">{form.homepage_announcement}</p>
            </div>
          )}
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-mint-50 px-3 py-2.5">
            <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-midnight-700" />
            <p className="text-[9.5px] leading-relaxed text-charcoal-600">
              Keep claims accurate. Do not promise charging speeds or availability that stations cannot deliver.
            </p>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Contact details" description="Shown in the footer, contact page and support emails.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Support email" hint="Monitored by the support team.">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <Input value={form.support_email} onChange={(event) => set('support_email', event.target.value)} className="pl-9" />
              </div>
            </Field>
            <Field label="Support phone">
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <Input value={form.support_phone} onChange={(event) => set('support_phone', event.target.value)} className="pl-9" />
              </div>
            </Field>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-mint-50 px-3 py-2.5">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-600" />
            <p className="text-[9.5px] leading-relaxed text-charcoal-600">
              Bookings, receipts and verification emails are sent from the backend email provider. Update those secrets in
              Supabase, not here.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Social profiles" description="Leave blank to hide an icon in the footer.">
          <div className="space-y-4">
            {[
              { key: 'social_instagram' as const, label: 'Instagram URL', icon: Instagram, placeholder: 'https://instagram.com/evnaija' },
              { key: 'social_x' as const, label: 'X (Twitter) URL', icon: Twitter, placeholder: 'https://x.com/evnaija' },
              { key: 'social_linkedin' as const, label: 'LinkedIn URL', icon: Linkedin, placeholder: 'https://linkedin.com/company/evnaija' },
            ].map((field) => (
              <Field key={field.key} label={field.label}>
                <div className="relative">
                  <field.icon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                  <Input
                    value={form[field.key]}
                    onChange={(event) => set(field.key, event.target.value)}
                    placeholder={field.placeholder}
                    className="pl-9"
                  />
                </div>
              </Field>
            ))}
          </div>
        </SectionCard>
      </div>

      <InfoNote title="Content governance" tone="info">
        Every publish writes an audit entry. Draft large copy changes with marketing and legal first — especially pricing
        claims, city availability and partnership terms.
      </InfoNote>

      <div className="flex justify-end">
        <Button loading={saving} onClick={save}>
          <Save className="h-4 w-4" /> Publish changes
        </Button>
      </div>
    </div>
  )
}
