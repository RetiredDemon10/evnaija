import { json, optionsResponse } from '../_shared/http.ts'
import { adminClient } from '../_shared/supabase.ts'
import { verifyPaystackSignature, type PaystackTransaction } from '../_shared/paystack.ts'
import { settlePaystackTransaction } from '../_shared/settlement.ts'

interface PaystackEvent {
  event?: string
  data?: Record<string, unknown>
}

function eventKey(event: string, data: Record<string, unknown>) {
  const identifier = data.id ?? data.reference ?? data.transfer_code ?? crypto.randomUUID()
  return `${event}:${String(identifier)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const rawBody = await req.text()
  const signature = req.headers.get('x-paystack-signature')

  try {
    if (!(await verifyPaystackSignature(rawBody, signature))) {
      return json({ error: 'Invalid Paystack signature.' }, 401)
    }

    const event = JSON.parse(rawBody) as PaystackEvent
    const eventType = String(event.event ?? '')
    const data = event.data ?? {}
    if (!eventType) return json({ error: 'Missing event type.' }, 400)

    const db = adminClient()
    const eventId = eventKey(eventType, data)
    const { data: inserted, error: insertError } = await db
      .from('payment_webhook_events')
      .insert({
        event_id: eventId,
        event_type: eventType,
        payload: event as unknown as Record<string, unknown>,
      })
      .select('id, processed')
      .single()

    let row: { id: string; processed: boolean } | null = inserted as
      | { id: string; processed: boolean }
      | null

    if (insertError) {
      if (insertError.code !== '23505') throw insertError
      // Paystack retries webhooks. Replay only events that have not completed
      // successfully; a failed first attempt must be processed again.
      const { data: existing, error: existingError } = await db
        .from('payment_webhook_events')
        .select('id, processed')
        .eq('event_id', eventId)
        .single()
      if (existingError) throw existingError
      row = existing as { id: string; processed: boolean }
    }

    if (!row) throw new Error('Could not record webhook event.')
    if (row.processed) return json({ received: true, duplicate: true })

    let result: Record<string, unknown> = { received: true }

    try {
      if (eventType === 'charge.success') {
        const reference = String(data.reference ?? '')
        if (!reference) throw new Error('charge.success is missing data.reference.')
        const transaction: PaystackTransaction = {
          id: Number(data.id ?? 0),
          status: String(data.status ?? 'success'),
          reference,
          amount: Number(data.amount ?? 0),
          currency: String(data.currency ?? 'NGN'),
          channel: data.channel ? String(data.channel) : undefined,
          gateway_response: data.gateway_response ? String(data.gateway_response) : undefined,
          paid_at: data.paid_at ? String(data.paid_at) : undefined,
        }
        result = await settlePaystackTransaction(reference, transaction, 'webhook')
      } else if (eventType === 'refund.processed' || eventType === 'refund.failed' || eventType === 'refund.pending') {
        const refundReference = String(data.reference ?? data.transaction_reference ?? '')
        const transactionReference = String(data.transaction_reference ?? data.reference ?? '')

        let refund: { id: string } | null = null

        if (refundReference) {
          const { data: byReference } = await db
            .from('refunds')
            .select('id')
            .eq('paystack_refund_reference', refundReference)
            .maybeSingle()
          refund = byReference
        }

        if (!refund && transactionReference) {
          const { data: payment } = await db
            .from('payments')
            .select('id')
            .eq('reference', transactionReference)
            .maybeSingle()
          if (payment) {
            const { data: byPayment } = await db
              .from('refunds')
              .select('id')
              .eq('payment_id', payment.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            refund = byPayment
          }
        }

        if (refund) {
          const status = eventType === 'refund.processed'
            ? 'completed'
            : eventType === 'refund.failed'
              ? 'failed'
              : 'processing'
          const { data: settled, error: refundError } = await db.rpc('settle_refund', {
            p_refund_id: refund.id,
            p_paystack_reference: refundReference || null,
            p_status: status,
          })
          if (refundError) throw refundError
          result = settled as Record<string, unknown>
        }
      } else if (eventType === 'transfer.success' || eventType === 'transfer.failed') {
        const transferReference = String(data.reference ?? '')
        let payoutId: string | null = null

        if (transferReference) {
          const { data: payout } = await db
            .from('payout_requests')
            .select('id')
            .eq('paystack_transfer_reference', transferReference)
            .maybeSingle()
          if (payout) payoutId = payout.id

          if (!payoutId) {
            const match = /^PO-([0-9a-f-]{36})/i.exec(transferReference)
            if (match) payoutId = match[1]
          }
        }

        if (payoutId) {
          const { data: settled, error: payoutError } = await db.rpc('settle_payout', {
            p_payout_id: payoutId,
            p_reference: transferReference || null,
            p_status: eventType === 'transfer.success' ? 'paid' : 'rejected',
          })
          if (payoutError) throw payoutError
          result = settled as Record<string, unknown>
        }
      }

      await db
        .from('payment_webhook_events')
        .update({ processed: true, processed_at: new Date().toISOString(), error: null })
        .eq('id', row.id)

      return json({ received: true, result })
    } catch (processingError) {
      const message = (processingError as Error).message
      await db
        .from('payment_webhook_events')
        .update({ error: message })
        .eq('id', row.id)
      console.error('paystack-webhook processing', processingError)
      return json({ received: false, error: message }, 500)
    }
  } catch (error) {
    console.error('paystack-webhook', error)
    return json({ received: false, error: (error as Error).message }, 400)
  }
})
