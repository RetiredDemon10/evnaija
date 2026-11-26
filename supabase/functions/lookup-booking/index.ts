import { json, methodNotAllowed, optionsResponse } from '../_shared/http.ts'
import { adminClient } from '../_shared/supabase.ts'
import { sha256Hex } from '../_shared/crypto.ts'

/**
 * Public booking lookup for the Manage Booking page.
 *
 * Gateway JWT verification is off: a visitor who booked as a guest has no
 * account. The service-role RPC `lookup_booking` requires the booking reference
 * plus the guest token or the email on the booking, and returns only a tracking
 * subset. Requests are rate-limited by IP before the lookup runs.
 */

interface LookupRequest {
  reference?: string
  secret?: string
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return req.headers.get('x-real-ip')?.trim() ?? 'unknown'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'POST') return methodNotAllowed()

  try {
    const body = await req.json().catch(() => ({})) as LookupRequest
    const reference = (body.reference ?? '').trim()
    const secret = (body.secret ?? '').trim()

    if (!reference || !secret) {
      return json({ error: 'Enter your booking number and your email or secure link.' }, 400)
    }
    if (reference.length > 40 || secret.length > 500) {
      return json({ error: 'Those details look too long. Please check and try again.' }, 400)
    }

    const db = adminClient()
    const ipHash = await sha256Hex(clientIp(req))

    const { data: allowed, error: limitError } = await db.rpc('booking_lookup_rate_limit_ok', {
      p_ip_hash: ipHash,
    })
    if (limitError) throw limitError
    if (!allowed) {
      return json({ error: 'Too many lookups from this connection. Please try again later.' }, 429)
    }

    const { data: booking, error } = await db.rpc('lookup_booking', {
      p_reference: reference,
      p_secret: secret,
    })
    if (error) throw error

    await db.from('booking_lookup_attempts').insert({
      ip_hash: ipHash,
      reference: reference.slice(0, 40),
      outcome: booking ? 'found' : 'not_found',
    })

    if (!booking) {
      return json(
        { error: 'No booking matched those details. Check the number and email, or use the secure link from your confirmation.' },
        404,
      )
    }

    return json({ booking })
  } catch (error) {
    console.error('lookup-booking', error)
    return json({ error: (error as Error).message }, 400)
  }
})
