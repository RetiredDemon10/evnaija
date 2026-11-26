import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Clock, Mail, MapPin, MessageSquare, Phone, Send, ShieldCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { createTicket } from '@/services/support'
import { BRAND } from '@/lib/constants'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Feedback'
import { Badge } from '@/components/ui/Badge'
import { SectionHeading } from '@/components/ui/Brand'
import { IMAGES } from '@/lib/images'
import { SmartImage } from '@/components/common/SmartImage'

const schema = z.object({
  name: z.string().min(2, 'Tell us your name'),
  email: z.string().email('Enter a valid email address'),
  topic: z.enum(['booking', 'payment', 'station', 'partnership', 'account', 'other']),
  subject: z.string().min(4, 'Add a short subject'),
  message: z.string().min(20, 'Please add a little more detail (20+ characters)'),
})
type FormValues = z.infer<typeof schema>

const TOPICS: { value: FormValues['topic']; label: string }[] = [
  { value: 'booking', label: 'Booking help' },
  { value: 'payment', label: 'Payment or refund' },
  { value: 'station', label: 'Station issue' },
  { value: 'partnership', label: 'Operator partnership' },
  { value: 'account', label: 'Account access' },
  { value: 'other', label: 'Something else' },
]

export default function ContactPage() {
  usePageTitle('Contact us')
  const { user } = useAuth()
  const toast = useToast()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: user?.profile.full_name ?? '', email: user?.email ?? '', topic: 'booking', subject: '', message: '' },
  })

  const onSubmit = async (values: FormValues) => {
    if (user) {
      try {
        await createTicket({
          userId: user.id,
          subject: values.subject,
          category: values.topic,
          priority: values.topic === 'payment' ? 'high' : 'medium',
          message: `${values.message}\n\nFrom: ${values.name} <${values.email}>`,
        })
        toast.success('Message received', 'Your support ticket is open. We respond within one business day.')
        reset({ ...values, subject: '', message: '' })
        return
      } catch (error) {
        toast.error('Could not open a ticket', (error as Error).message)
        return
      }
    }
    const body = `${values.message}\n\nName: ${values.name}\nEmail: ${values.email}\nTopic: ${values.topic}`
    window.location.href = `mailto:${BRAND.supportEmail}?subject=${encodeURIComponent(values.subject)}&body=${encodeURIComponent(body)}`
    toast.info('Opening your email app', `You can also write to ${BRAND.supportEmail}.`)
  }

  return (
    <div>
      <section className="relative overflow-hidden bg-midnight-950 pb-16 pt-32 lg:pt-36">
        <SmartImage src={IMAGES.evCloseup} alt="EV charging connector close-up" className="absolute inset-0 h-full w-full" imgClassName="object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-r from-midnight-950 via-midnight-950/92 to-midnight-950/40" />
        <div className="container-page relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-lime/25 bg-lime/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-lime">
            <MessageSquare className="h-3 w-3" /> Contact
          </span>
          <h1 className="mt-5 max-w-2xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl">
            Talk to a human who knows the network.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/55">
            Booking problems, payment questions, station partnerships or feedback — we read every message and respond
            within one business day.
          </p>
        </div>
      </section>

      <section className="bg-mint-50 py-16 lg:py-24">
        <div className="container-page grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-midnight-900/[0.07] bg-white p-6 shadow-card sm:p-8">
            <SectionHeading eyebrow="Send a message" title="How can we help?" />
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your name" error={errors.name?.message} required>
                  <Input placeholder="Adaeze Okafor" {...register('name')} />
                </Field>
                <Field label="Email address" error={errors.email?.message} required>
                  <Input type="email" placeholder="you@example.com" {...register('email')} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Topic" error={errors.topic?.message} required>
                  <Select {...register('topic')}>
                    {TOPICS.map((topic) => (
                      <option key={topic.value} value={topic.value}>{topic.label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Subject" error={errors.subject?.message} required>
                  <Input placeholder="Brief summary" {...register('subject')} />
                </Field>
              </div>
              <Field label="Message" error={errors.message?.message} required>
                <Textarea placeholder="Include your booking reference or station name if relevant." rows={6} {...register('message')} />
              </Field>
              {!user && (
                <p className="rounded-xl border border-lime-400/40 bg-lime/10 px-3 py-2 text-[11px] leading-relaxed text-charcoal-600">
                  You are not signed in, so this will open your email app. Sign in to open a tracked support ticket instead.
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-[10px] text-muted">
                  <ShieldCheck className="h-3.5 w-3.5 text-lime-600" /> We never share your contact details.
                </p>
                <Button type="submit" loading={isSubmitting}>
                  <Send className="h-4 w-4" /> Send message
                </Button>
              </div>
            </form>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-midnight-900/[0.07] bg-white p-6 shadow-card">
              <Badge tone="lime">Customer support</Badge>
              <h2 className="mt-3 font-display text-lg font-semibold text-midnight-900">Reach us directly</h2>
              <div className="mt-4 space-y-3">
                {[
                  { icon: Mail, label: 'Email', value: BRAND.supportEmail, href: `mailto:${BRAND.supportEmail}` },
                  { icon: Phone, label: 'Phone', value: BRAND.phone, href: `tel:${BRAND.phone.replace(/\s/g, '')}` },
                  { icon: MapPin, label: 'Office', value: BRAND.address },
                  { icon: Clock, label: 'Hours', value: BRAND.hours },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3 rounded-2xl bg-mint-50 p-3.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-midnight-800">
                      <item.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-muted">{item.label}</p>
                      {item.href ? (
                        <a href={item.href} className="mt-0.5 block truncate text-[12px] font-semibold text-midnight-900 hover:text-lime-700">
                          {item.value}
                        </a>
                      ) : (
                        <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-charcoal-600">{item.value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-midnight-950 p-6 text-white">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-lime">Already have an account?</p>
              <h2 className="mt-2 font-display text-lg font-semibold">Support inside your dashboard</h2>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/45">
                Signed-in customers and operators can open, track and reply to support tickets without leaving EV Naija.
              </p>
              <a href={user ? (user.roles.includes('operator') ? '/operator/support' : '/app/support') : '/login'} className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-lime hover:underline">
                Open support <ArrowRight className="h-3 w-3" />
              </a>
            </div>

            <div className="rounded-3xl border border-lime-400/40 bg-lime/15 p-6">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-midnight-700">For operators</p>
              <h2 className="mt-2 font-display text-lg font-semibold text-midnight-900">Thinking of listing?</h2>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-charcoal-600">
                We can walk you through verification, pricing and onboarding for your first station.
              </p>
              <a href="/for-operators" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-midnight-900 hover:underline">
                Partner information <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}
