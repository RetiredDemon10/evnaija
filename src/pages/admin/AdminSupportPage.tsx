import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, CheckCircle2, Clock, LifeBuoy, MessageSquare, Search, Send, ShieldCheck } from 'lucide-react'
import { listSupportTickets, updateTicketStatus, writeAuditLog } from '@/services/admin'
import { addTicketMessage } from '@/services/support'
import type { SupportTicket } from '@/types'
import { PageHeader, DataTable, Tabs, type Column } from '@/components/ui/Data'
import { Avatar } from '@/components/ui/Brand'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ExportButton, SelectFilter, TableEmpty } from '@/components/dashboard/Kit'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cn, formatDateTime, humanize, relativeTime } from '@/lib/utils'

type Filter = 'all' | 'open' | 'pending' | 'resolved' | 'closed'

const PRIORITY_TONE: Record<SupportTicket['priority'], 'danger' | 'warning' | 'neutral' | 'success'> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'neutral',
  low: 'success',
}

const STATUS_TONE: Record<SupportTicket['status'], 'success' | 'warning' | 'neutral' | 'danger'> = {
  open: 'warning',
  pending: 'neutral',
  resolved: 'success',
  closed: 'danger',
}

export default function AdminSupportPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  const [priority, setPriority] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [updating, setUpdating] = useState(false)
  usePageTitle('Support tickets')

  const { data: tickets = [], isLoading } = useQuery({ queryKey: ['admin-tickets'], queryFn: listSupportTickets })
  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null

  useEffect(() => {
    if (!selectedId) return
    if (!tickets.some((ticket) => ticket.id === selectedId)) setSelectedId(null)
  }, [tickets, selectedId])

  const counts = useMemo(
    () => ({
      all: tickets.length,
      open: tickets.filter((ticket) => ticket.status === 'open').length,
      pending: tickets.filter((ticket) => ticket.status === 'pending').length,
      resolved: tickets.filter((ticket) => ticket.status === 'resolved').length,
      closed: tickets.filter((ticket) => ticket.status === 'closed').length,
    }),
    [tickets],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return tickets.filter((ticket) => {
      const matchesFilter = filter === 'all' || ticket.status === filter
      const matchesPriority = priority === 'all' || ticket.priority === priority
      const matchesSearch =
        !term ||
        ticket.subject.toLowerCase().includes(term) ||
        ticket.category.toLowerCase().includes(term) ||
        (ticket.user?.full_name ?? '').toLowerCase().includes(term) ||
        (ticket.user?.email ?? '').toLowerCase().includes(term)
      return matchesFilter && matchesPriority && matchesSearch
    })
  }, [tickets, filter, priority, search])

  const sendReply = async () => {
    if (!selected || !user) return
    if (reply.trim().length < 3) {
      toast.error('Write a reply', 'Add a message before sending.')
      return
    }
    setSending(true)
    try {
      await addTicketMessage({
        ticketId: selected.id,
        senderId: user.id,
        message: reply.trim(),
        isStaff: true,
      })
      await updateTicketStatus(selected.id, 'pending')
      await writeAuditLog(user.id, 'support.replied', 'support_ticket', selected.id, {
        subject: selected.subject,
        customer: selected.user?.full_name,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin-tickets'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
      setReply('')
      toast.success('Reply sent', 'The customer has been notified.')
    } catch (error) {
      toast.error('Could not send reply', (error as Error).message)
    } finally {
      setSending(false)
    }
  }

  const changeStatus = async (status: SupportTicket['status']) => {
    if (!selected || !user) return
    setUpdating(true)
    try {
      await updateTicketStatus(selected.id, status)
      await writeAuditLog(user.id, `support.${status}`, 'support_ticket', selected.id, { subject: selected.subject })
      await queryClient.invalidateQueries({ queryKey: ['admin-tickets'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
      toast.success('Ticket updated', `${selected.subject} is now ${status}.`)
    } catch (error) {
      toast.error('Could not update ticket', (error as Error).message)
    } finally {
      setUpdating(false)
    }
  }

  const columns: Column<SupportTicket>[] = [
    {
      key: 'subject',
      header: 'Ticket',
      render: (ticket) => (
        <div className="max-w-[280px]">
          <p className="truncate text-[12px] font-semibold text-midnight-900">{ticket.subject}</p>
          <p className="text-[9.5px] text-muted">
            {ticket.category} · updated {relativeTime(ticket.updated_at)}
          </p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (ticket) => (
        <div className="flex items-center gap-2">
          <Avatar name={ticket.user?.full_name ?? 'User'} src={ticket.user?.avatar_url} size={28} />
          <div>
            <p className="text-[10.5px] font-medium text-charcoal-700">{ticket.user?.full_name ?? 'Unknown'}</p>
            <p className="text-[9px] text-muted">{ticket.user?.email ?? ''}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (ticket) => <Badge tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (ticket) => <Badge tone={STATUS_TONE[ticket.status]}>{ticket.status}</Badge>,
    },
    {
      key: 'messages',
      header: 'Replies',
      render: (ticket) => (
        <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-charcoal-600">
          <MessageSquare className="h-3 w-3 text-muted" /> {ticket.messages?.length ?? 0}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (ticket) => (
        <button
          onClick={() => setSelectedId(ticket.id)}
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-midnight-900 px-2.5 text-[10px] font-semibold text-lime hover:bg-midnight-800"
        >
          Open <ArrowUpRight className="h-3 w-3" />
        </button>
      ),
    },
  ]

  if (isLoading) return <PageLoader label="Loading support tickets" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Support tickets"
        description="Respond to driver and operator issues, escalate priorities and close resolved conversations."
        actions={
          <ExportButton
            filename="ev-naija-support.csv"
            rows={filtered.map((ticket) => ({
              subject: ticket.subject,
              customer: ticket.user?.full_name ?? '',
              email: ticket.user?.email ?? '',
              category: ticket.category,
              priority: ticket.priority,
              status: ticket.status,
              created: ticket.created_at,
              updated: ticket.updated_at,
            }))}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Open', value: counts.open, icon: Clock, tone: 'text-amber-700', hint: 'Need a first response' },
          { label: 'Awaiting customer', value: counts.pending, icon: MessageSquare, tone: 'text-midnight-900', hint: 'Staff replied' },
          { label: 'Resolved', value: counts.resolved, icon: CheckCircle2, tone: 'text-emerald-700', hint: 'Closed successfully' },
          { label: 'Total tickets', value: counts.all, icon: LifeBuoy, tone: 'text-midnight-900', hint: 'All time' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{stat.label}</p>
              <stat.icon className={`h-4 w-4 ${stat.tone}`} />
            </div>
            <p className={`mt-2 font-mono text-xl font-medium ${stat.tone}`}>{stat.value}</p>
            <p className="mt-0.5 text-[9.5px] text-muted">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'open', label: 'Open', count: counts.open },
            { value: 'pending', label: 'Pending', count: counts.pending },
            { value: 'resolved', label: 'Resolved', count: counts.resolved },
            { value: 'closed', label: 'Closed', count: counts.closed },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search subject, customer or category"
              className="input-base h-9 pl-9 text-[11px]"
            />
          </div>
          <SelectFilter
            value={priority}
            onChange={setPriority}
            options={[
              { value: 'all', label: 'All priorities' },
              { value: 'urgent', label: 'Urgent' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        minWidth={860}
        empty={<TableEmpty title="No tickets in this view" description="Try clearing filters or wait for new customer requests." />}
        mobileRender={(ticket) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-midnight-900">{ticket.subject}</p>
                <p className="text-[9.5px] text-muted">{ticket.user?.full_name} · {ticket.category}</p>
              </div>
              <Badge tone={STATUS_TONE[ticket.status]}>{ticket.status}</Badge>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-midnight-900/[0.06] pt-2">
              <Badge tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Badge>
              <button onClick={() => setSelectedId(ticket.id)} className="text-[10.5px] font-semibold text-lime-700">
                Open thread
              </button>
            </div>
          </div>
        )}
      />

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected?.subject ?? 'Ticket'}
        description={selected ? `${selected.user?.full_name ?? 'Customer'} · ${selected.category}` : undefined}
        size="lg"
        footer={
          selected ? (
            <>
              <SelectFilter
                value={selected.status}
                onChange={(value) => void changeStatus(value as SupportTicket['status'])}
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'resolved', label: 'Resolved' },
                  { value: 'closed', label: 'Closed' },
                ]}
              />
              <Button loading={sending} onClick={sendReply} disabled={selected.status === 'closed'}>
                <Send className="h-4 w-4" /> Send reply
              </Button>
            </>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[selected.status]}>{selected.status}</Badge>
              <Badge tone={PRIORITY_TONE[selected.priority]}>{selected.priority} priority</Badge>
              <span className="text-[9.5px] text-muted">Opened {formatDateTime(selected.created_at)}</span>
            </div>

            <div className="max-h-[320px] space-y-3 overflow-y-auto rounded-2xl bg-charcoal-50 p-3">
              {(selected.messages?.length ?? 0) ? (
                selected.messages!.map((message) => {
                  const staff = message.is_staff
                  return (
                    <div key={message.id} className={cn('flex', staff ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[85%] rounded-2xl px-3.5 py-2.5',
                          staff ? 'bg-midnight-900 text-white' : 'bg-white text-charcoal-700',
                        )}
                      >
                        <p className={cn('text-[8.5px] font-semibold uppercase tracking-[0.1em]', staff ? 'text-lime' : 'text-muted')}>
                          {staff ? 'EV Naija support' : selected.user?.full_name ?? 'Customer'}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed">{message.message}</p>
                        <p className={cn('mt-1 font-mono text-[8px]', staff ? 'text-white/40' : 'text-muted')}>
                          {formatDateTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="py-6 text-center text-[10.5px] text-muted">No messages on this ticket yet.</p>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Reply as staff</p>
              <textarea
                rows={3}
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                placeholder="Write a helpful, specific response and set expectations."
                className="input-base w-full resize-none text-[11.5px]"
              />
              <div className="mt-1.5 flex items-start gap-1.5 text-[9px] text-muted">
                <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-lime-600" />
                Replies are recorded against your admin account and shared with the customer immediately.
              </div>
            </div>
          </div>
        )}
      </Modal>

      <div className="flex items-start gap-2 rounded-2xl border border-midnight-900/[0.07] bg-white px-4 py-3.5">
        <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" />
        <p className="text-[10.5px] leading-relaxed text-charcoal-500">
          Aim for a first response within 2 hours for urgent safety or payment issues. Use the ledger and booking details
          before promising refunds. All status changes are captured in the audit log.
        </p>
      </div>
    </div>
  )
}
