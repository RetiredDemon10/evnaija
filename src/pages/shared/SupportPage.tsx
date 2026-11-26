import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowUpRight, Clock, LifeBuoy, MessageSquare, Plus, Send, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { addTicketMessage, createTicket, listMyTickets } from '@/services/support'
import { useToast } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/Data'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { EmptyState, PageLoader } from '@/components/ui/Feedback'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, humanize, relativeTime, cn } from '@/lib/utils'
import type { SupportTicket } from '@/types'

const CATEGORIES = [
  { value: 'booking', label: 'Booking issue' },
  { value: 'payment', label: 'Payment or refund' },
  { value: 'station', label: 'Station or charger' },
  { value: 'account', label: 'Account access' },
  { value: 'other', label: 'Something else' },
]

export default function SupportPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [activeId, setActiveId] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({ subject: '', category: 'booking', priority: 'medium', message: '' })
  usePageTitle('Support centre')

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['support-tickets', user?.id],
    queryFn: () => listMyTickets(user!.id),
    enabled: Boolean(user?.id),
  })

  useEffect(() => {
    if (!activeId && tickets.length) setActiveId(tickets[0].id)
  }, [tickets, activeId])

  const active = tickets.find((ticket) => ticket.id === activeId)
  const messages = [...(active?.messages ?? [])].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const create = async () => {
    if (!user) return
    if (form.subject.trim().length < 4 || form.message.trim().length < 10) {
      toast.error('Add a little more detail', 'Include a subject and at least 10 characters describing the issue.')
      return
    }
    setSaving(true)
    try {
      const ticket = await createTicket({
        userId: user.id,
        subject: form.subject.trim(),
        category: form.category,
        priority: form.priority as SupportTicket['priority'],
        message: form.message.trim(),
      })
      await queryClient.invalidateQueries({ queryKey: ['support-tickets', user.id] })
      setActiveId(ticket.id)
      setOpen(false)
      setForm({ subject: '', category: 'booking', priority: 'medium', message: '' })
      toast.success('Support ticket opened', 'Our team responds within one business day.')
    } catch (error) {
      toast.error('Could not open ticket', (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const sendReply = async () => {
    if (!user || !active || reply.trim().length < 2) return
    setSending(true)
    try {
      await addTicketMessage({ ticketId: active.id, senderId: user.id, message: reply.trim(), isStaff: false })
      setReply('')
      await queryClient.invalidateQueries({ queryKey: ['support-tickets', user.id] })
      toast.success('Reply sent')
    } catch (error) {
      toast.error('Could not send reply', (error as Error).message)
    } finally {
      setSending(false)
    }
  }

  if (isLoading) return <PageLoader label="Loading support centre" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Help centre"
        title="Support"
        description="Open a ticket for booking, payment, station or account issues. We reply within one business day."
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New ticket</Button>}
      />

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-3">
          {tickets.length ? (
            tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => setActiveId(ticket.id)}
                className={cn(
                  'w-full rounded-2xl border p-4 text-left transition',
                  ticket.id === activeId ? 'border-lime-400/70 bg-white shadow-card' : 'border-midnight-900/[0.07] bg-white/60 hover:border-lime-300',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-[12px] font-semibold text-midnight-900">{ticket.subject}</p>
                  <Badge tone={ticket.status === 'open' ? 'warning' : ticket.status === 'resolved' ? 'success' : 'neutral'}>{ticket.status}</Badge>
                </div>
                <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">{ticket.category} · {ticket.priority}</p>
                <div className="mt-2 flex items-center justify-between text-[9.5px] text-muted">
                  <span className="flex items-center gap-1"><MessageSquare className="h-2.5 w-2.5" /> {ticket.messages?.length ?? 0} messages</span>
                  <span>{relativeTime(ticket.updated_at)}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-midnight-900/10 bg-white p-5 text-center">
              <LifeBuoy className="mx-auto h-6 w-6 text-muted" />
              <p className="mt-2 text-[12px] font-semibold text-midnight-900">No tickets yet</p>
              <p className="mt-1 text-[10.5px] text-muted">Open a ticket and we will take it from there.</p>
            </div>
          )}

          <div className="rounded-2xl bg-midnight-950 p-4 text-white">
            <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-lime">Emergency?</p>
            <p className="mt-1.5 text-[11px] font-semibold">If a charger is unsafe or smoking, stop and contact the operator immediately.</p>
            <p className="mt-1 text-[10px] leading-relaxed text-white/45">Do not touch damaged equipment. Mark the ticket urgent so we prioritise it.</p>
          </div>
        </aside>

        {active ? (
          <section className="overflow-hidden rounded-3xl border border-midnight-900/[0.07] bg-white shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-midnight-900/[0.06] px-5 py-4 sm:px-6">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">Ticket {active.id.slice(-6).toUpperCase()}</p>
                <h2 className="mt-1 font-display text-lg font-semibold text-midnight-900">{active.subject}</h2>
                <p className="mt-0.5 text-[10.5px] text-muted">Opened {formatDate(active.created_at, 'dd MMM yyyy · HH:mm')} · {humanize(active.category)}</p>
              </div>
              <Badge tone={active.status === 'open' ? 'warning' : active.status === 'resolved' ? 'success' : 'neutral'}>{active.status}</Badge>
            </div>

            <div className="space-y-4 px-5 py-5 sm:px-6">
              {messages.map((message) => {
                const mine = message.sender_id === user?.id
                return (
                  <div key={message.id} className={cn('flex gap-2.5', mine ? 'justify-end' : 'justify-start')}>
                    {!mine && <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-midnight-900 text-[9px] font-bold text-lime">EV</span>}
                    <div className={cn('max-w-[85%] rounded-2xl px-4 py-3', mine ? 'bg-midnight-900 text-white' : 'bg-mint-50 text-charcoal-700')}>
                      <div className="flex items-center gap-2">
                        <p className={cn('text-[10px] font-semibold', mine ? 'text-lime' : 'text-midnight-900')}>{mine ? 'You' : message.is_staff ? 'EV Naija support' : 'Support'}</p>
                        {message.is_staff && <ShieldCheck className={cn('h-3 w-3', mine ? 'text-lime' : 'text-emerald-600')} />}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed">{message.message}</p>
                      <p className={cn('mt-1.5 text-right font-mono text-[8.5px]', mine ? 'text-white/35' : 'text-muted')}>{relativeTime(message.created_at)}</p>
                    </div>
                  </div>
                )
              })}
              {!messages.length && <p className="py-8 text-center text-[12px] text-muted">No messages in this thread yet.</p>}
            </div>

            {active.status !== 'closed' && (
              <div className="border-t border-midnight-900/[0.06] px-5 py-4 sm:px-6">
                <div className="flex gap-2">
                  <Textarea
                    rows={2}
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="Write a reply…"
                    className="min-h-[44px] flex-1"
                  />
                  <Button loading={sending} onClick={sendReply} className="self-end"><Send className="h-4 w-4" /></Button>
                </div>
                <p className="mt-1.5 flex items-center gap-1 text-[9px] text-muted"><Clock className="h-2.5 w-2.5" /> Average first response: under one business day.</p>
              </div>
            )}
          </section>
        ) : (
          <EmptyState
            icon={<LifeBuoy className="h-6 w-6" />}
            title="Select a ticket"
            description="Choose a ticket from the list or open a new one if you need help."
            action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New ticket</Button>}
          />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { title: 'Booking help', text: 'Reschedule, cancel or report a check-in problem.' },
          { title: 'Payments', text: 'Receipts, failed checkout or refund eligibility.' },
          { title: 'Station issues', text: 'Faulty charger, wrong location or safety concern.' },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4">
            <ArrowUpRight className="h-4 w-4 text-lime-700" />
            <p className="mt-2 text-[12px] font-semibold text-midnight-900">{item.title}</p>
            <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{item.text}</p>
          </div>
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Open a support ticket"
        description="Give us enough detail to resolve it quickly. Do not include card numbers or passwords."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={create}>Open ticket</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Subject" required>
            <Input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Short summary of the issue" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" required>
              <Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                {CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
              </Select>
            </Field>
            <Field label="Priority" required>
              <Select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </Field>
          </div>
          <Field label="What happened?" required>
            <Textarea rows={5} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Include booking reference, station name, date and what you expected to happen." />
          </Field>
          {form.priority === 'urgent' && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10.5px] leading-relaxed text-red-700">
              Use urgent only for safety issues or an active session that cannot start. Misuse may delay response.
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
