import { json, methodNotAllowed, optionsResponse } from '../_shared/http.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'
import { sha256Hex } from '../_shared/crypto.ts'
import { verifyPaystackTransaction } from '../_shared/paystack.ts'
import { settlePaystackTransaction } from '../_shared/settlement.ts'

async function optionalUser(req: Request) {
  try {
    return await requireUser(req)
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'POST') return methodNotAllowed()

  try {
    const user = await optionalUser(req)
    const body = await req.json().catch(() => ({})) as { reference?: string; guestToken?: string }
    if (!body.reference) return json({ success: false, error: 'reference is required.' }, 400)

    const db = adminClient()
    const { data: payment, error: paymentError } = await db
      .from('payments')
      .select('*')
      .eq('reference', body.reference)
      .maybeSingle()

    if (paymentError) throw paymentError
    if (!payment) return json({ success: false, error: 'Payment not found.' }, 404)

    let authorised = Boolean(user && payment.customer_id === user.id)

    if (!authorised && user) {
      const { data: adminRole } = await db
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle()
      authorised = Boolean(adminRole)
    }

    // A guest can verify the payment for the booking their token unlocked.
    if (!authorised && body.guestToken) {
      const { data: booking } = await db
        .from('bookings')
        .select('is_guest, guest_token_hash')
        .eq('id', payment.booking_id)
        .maybeSingle()
      if (booking?.is_guest && booking.guest_token_hash) {
        authorised = (await sha256Hex(body.guestToken)) === booking.guest_token_hash
      }
    }

    if (!authorised) {
      return json({ success: false, error: 'You cannot verify this payment.' }, 403)
    }

    const transaction = await verifyPaystackTransaction(body.reference)
    if (transaction.status !== 'success') {
      return json({
        success: false,
        error: `Payment is ${transaction.status}. No charge has been confirmed.`,
      })
    }

    const settled = await settlePaystackTransaction(body.reference, transaction, 'verify')
    return json({
      success: true,
      message: settled.message,
      booking: settled.booking,
      payment: settled.payment,
      refund_requested: settled.refund_requested ?? false,
    })
  } catch (error) {
    console.error('verify-payment', error)
    return json({ success: false, error: (error as Error).message }, 400)
  }
})
