import { appUrl, json, methodNotAllowed, optionsResponse } from '../_shared/http.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'
import { sha256Hex } from '../_shared/crypto.ts'
import { PaystackError, paystackRequest } from '../_shared/paystack.ts'

interface InitializeResponse {
  authorization_url: string
  access_code: string
  reference: string
}

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
    const body = await req.json().catch(() => ({})) as { bookingId?: string; guestToken?: string }
    if (!body.bookingId) return json({ error: 'bookingId is required.' }, 400)

    const db = adminClient()
    const { data: booking, error: bookingError } = await db
      .from('bookings')
      .select('*')
      .eq('id', body.bookingId)
      .maybeSingle()

    if (bookingError) throw bookingError
    if (!booking) return json({ error: 'Booking not found.' }, 404)

    // Authorise either the signed-in customer or the holder of this booking's
    // guest token. The token is scoped to a single booking, so it cannot be
    // used to read or pay for anything else.
    const isOwner = Boolean(user && booking.customer_id === user.id)
    let isGuestOwner = false
    if (!isOwner && body.guestToken && booking.is_guest && booking.guest_token_hash) {
      isGuestOwner = (await sha256Hex(body.guestToken)) === booking.guest_token_hash
    }
    if (!isOwner && !isGuestOwner) {
      return json({ error: 'This booking belongs to another customer.' }, 403)
    }

    if (booking.status !== 'pending_payment') {
      return json({ error: `This booking is ${String(booking.status).replace('_', ' ')} and cannot be paid.` }, 409)
    }
    if (booking.hold_expires_at && new Date(booking.hold_expires_at).getTime() < Date.now()) {
      return json({ error: 'The payment hold has expired. Choose a new booking slot.' }, 409)
    }

    const { data: payment, error: paymentError } = await db
      .from('payments')
      .select('*')
      .eq('booking_id', booking.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (paymentError) throw paymentError
    if (!payment) return json({ error: 'No payment record exists for this booking.' }, 404)
    if (payment.status === 'success') return json({ error: 'This booking is already paid.' }, 409)

    // Guests are charged against the email captured at checkout; signed-in
    // customers use their account email.
    const email = user?.email ?? booking.guest_email
    if (!email) return json({ error: 'A receipt email is required to start payment.' }, 400)

    let reference = payment.reference
    let initialized: InitializeResponse

    const initialize = (paymentReference: string) =>
      paystackRequest<InitializeResponse>('/transaction/initialize', {
        method: 'POST',
        body: {
          email,
          amount: Math.round(Number(payment.amount) * 100),
          currency: payment.currency || 'NGN',
          reference: paymentReference,
          callback_url: `${appUrl()}/payment/callback`,
          metadata: {
            booking_id: booking.id,
            booking_reference: booking.booking_reference,
            customer_id: booking.customer_id,
            charger_id: booking.charger_id,
            station_id: booking.station_id,
            is_guest: Boolean(booking.is_guest),
          },
        },
      })

    try {
      initialized = await initialize(reference)
    } catch (error) {
      if (
        error instanceof PaystackError &&
        /duplicate/i.test(error.message)
      ) {
        reference = `${payment.reference}-${Date.now()}`
        initialized = await initialize(reference)
        const { error: updateError } = await db
          .from('payments')
          .update({ reference })
          .eq('id', payment.id)
        if (updateError) throw updateError
      } else {
        throw error
      }
    }

    const { error: metadataError } = await db
      .from('payments')
      .update({
        metadata: {
          ...(payment.metadata ?? {}),
          authorization_url: initialized.authorization_url,
          access_code: initialized.access_code,
          paystack_reference: initialized.reference,
        },
      })
      .eq('id', payment.id)

    if (metadataError) throw metadataError

    return json({
      authorization_url: initialized.authorization_url,
      access_code: initialized.access_code,
      reference: initialized.reference,
    })
  } catch (error) {
    console.error('initialize-payment', error)
    return json({ error: (error as Error).message }, 400)
  }
})
