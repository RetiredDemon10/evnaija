import type { SupportMessage, SupportTicket } from '@/types'
import { supabase } from '@/lib/supabase'
import { isPreviewMode } from '@/lib/env'
import { demoStore } from '@/data/demo'

export async function listMyTickets(userId: string): Promise<SupportTicket[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.supportTickets
      .filter((t) => t.user_id === userId)
      .map((t) => ({ ...t, messages: t.messages ?? [] }))
  }
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*, messages:support_messages(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as SupportTicket[]
}

export async function createTicket(input: {
  userId: string
  subject: string
  category: string
  priority: SupportTicket['priority']
  message: string
}): Promise<SupportTicket> {
  if (isPreviewMode || !supabase) {
    const id = `tick-${Date.now()}`
    const message: SupportMessage = {
      id: `msg-${Date.now()}`,
      ticket_id: id,
      sender_id: input.userId,
      message: input.message,
      is_staff: false,
      created_at: new Date().toISOString(),
    }
    const ticket: SupportTicket = {
      id,
      user_id: input.userId,
      subject: input.subject,
      category: input.category,
      priority: input.priority,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [message],
    }
    demoStore.supportTickets.unshift(ticket)
    return ticket
  }
  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: input.userId,
      subject: input.subject,
      category: input.category,
      priority: input.priority,
      status: 'open',
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  const { error: messageError } = await supabase.from('support_messages').insert({
    ticket_id: data.id,
    sender_id: input.userId,
    message: input.message,
    is_staff: false,
  })
  if (messageError) throw new Error(messageError.message)
  return data as SupportTicket
}

export async function addTicketMessage(input: {
  ticketId: string
  senderId: string
  message: string
  isStaff: boolean
}): Promise<SupportMessage> {
  if (isPreviewMode || !supabase) {
    const message: SupportMessage = {
      id: `msg-${Date.now()}`,
      ticket_id: input.ticketId,
      sender_id: input.senderId,
      message: input.message,
      is_staff: input.isStaff,
      created_at: new Date().toISOString(),
    }
    const ticket = demoStore.supportTickets.find((t) => t.id === input.ticketId)
    if (ticket) {
      ticket.messages = [...(ticket.messages ?? []), message]
      ticket.status = input.isStaff ? 'pending' : 'open'
      ticket.updated_at = new Date().toISOString()
    }
    return message
  }
  const { data, error } = await supabase
    .from('support_messages')
    .insert({
      ticket_id: input.ticketId,
      sender_id: input.senderId,
      message: input.message,
      is_staff: input.isStaff,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as SupportMessage
}

export async function getTicket(id: string): Promise<SupportTicket | null> {
  if (isPreviewMode || !supabase) {
    const ticket = demoStore.supportTickets.find((t) => t.id === id)
    return ticket ? { ...ticket, messages: ticket.messages ?? [] } : null
  }
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*, messages:support_messages(*)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as SupportTicket) ?? null
}
