import { json, methodNotAllowed, optionsResponse } from '../_shared/http.ts'
import { adminClient, requireAdmin } from '../_shared/supabase.ts'
import { paystackRequest } from '../_shared/paystack.ts'

interface PaystackRefundResponse {
  id?: number | string
  status?: string
  reference?: string
  transaction?: { reference?: string }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'POST') return methodNotAllowed()

  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({})) as { refundId?: string }
    if (!body.refundId) return json({ success: false, error: 'refundId is required.' }, 400)

    const db = adminClient()
    const { data: refund, error: refundError } = await db
      .from('refunds')
      .select('*, payment:payments(*)')
      .eq('id', body.refundId)
      .maybeSingle()

    if (refundError) throw refundError
    if (!refund) return json({ success: false, error: 'Refund not found.' }, 404)
    if (refund.status === 'completed') {
      return json({ success: true, message: 'Refund already completed.', refund })
    }
    if (refund.status === 'processing' && refund.paystack_refund_reference) {
      return json({ success: true, message: 'Refund is already with Paystack for processing.', refund })
    }

    const payment = (refund as { payment?: Record<string, unknown> | null }).payment
    if (!payment) return json({ success: false, error: 'Payment record not found.' }, 404)
    const transactionReference = String(payment.paystack_reference ?? payment.reference ?? '')
    if (!transactionReference) return json({ success: false, error: 'Payment has no Paystack reference.' }, 409)

    const paystackRefund = await paystackRequest<PaystackRefundResponse>('/refund', {
      method: 'POST',
      body: {
        transaction: transactionReference,
        amount: Math.round(Number(refund.amount) * 100),
        merchant_note: refund.reason,
      },
    })

    const refundReference =
      paystackRefund.reference ??
      paystackRefund.transaction?.reference ??
      (paystackRefund.id !== undefined ? String(paystackRefund.id) : null)

    const status = paystackRefund.status === 'processed' || paystackRefund.status === 'completed'
      ? 'completed'
      : paystackRefund.status === 'failed'
        ? 'failed'
        : 'processing'

    const { data: settled, error: settleError } = await db.rpc('settle_refund', {
      p_refund_id: refund.id,
      p_paystack_reference: refundReference,
      p_status: status,
    })
    if (settleError) throw settleError

    return json({
      success: true,
      message: status === 'completed' ? 'Refund completed.' : 'Refund sent to Paystack for processing.',
      refund: (settled as Record<string, unknown>).refund ?? settled,
    })
  } catch (error) {
    console.error('process-refund', error)
    return json({ success: false, error: (error as Error).message }, 400)
  }
})
