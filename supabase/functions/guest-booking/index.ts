import { json, methodNotAllowed, optionsResponse } from '../_shared/http.ts'
import { adminClient } from '../_shared/supabase.ts'
import { randomToken, sha256Hex } from '../_shared/crypto.ts'

/**
 * Server-side guest checkout.
 *
 * Provisions (or reuses) a guest profile, creates the booking through the
 * service-role RPC `create_guest_booking`, and returns a per-booking bearer
 * token. The browser never receives a session, so there is no way to take over
 * an existing guest account — each token only unlocks the booking it created.
 */

interface GuestBookingRequest {
  stationId?: string
  chargerId?: string
  vehicleId?: string | null
  startTime?: string
  durationMinutes?: number
  email?: string
  fullName?: string
  phone?: string
  /** Honeypot — real users never fill this in. */
  company?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_RE = /^(\+?234|0)[789][01]\d{8}$/

// A short, maintained list is enough to stop the cheapest abuse without
// blocking legitimate Nigerian consumer inboxes.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', 'temp-mail.org', 'guerrillamail.com',
  '10minutemail.com', 'yopmail.com', 'trashmail.com', 'sharklasers.com',
  'getnada.com', 'dispostable.com', 'maildrop.cc', 'throwawaymail.com',
])

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return req.headers.get('x-real-ip')?.trim() ?? ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'POST') return methodNotAllowed()

  const db = adminClient()

  const logAttempt = async (email: string | null, ipHash: string | null, outcome: string, detail?: string) => {
    await db.from('guest_checkout_attempts').insert({
      email: email ? email.toLowerCase() : null,
      ip_hash: ipHash,
      outcome,
      detail: detail ?? null,
    })
  }

  try {
    const body = await req.json().catch(() => ({})) as GuestBookingRequest

    // Honeypot: silently reject bots that fill the hidden field.
    if (body.company && body.company.trim().length > 0) {
      return json({ error: 'We could not start checkout. Please try again.' }, 400)
    }

    const email = (body.email ?? '').trim().toLowerCase()
    const fullName = (body.fullName ?? '').trim()
    const phone = (body.phone ?? '').trim()
    const durationMinutes = Number(body.durationMinutes)

    if (!body.stationId || !body.chargerId || !body.startTime) {
      return json({ error: 'A station, charger and start time are required.' }, 400)
    }
    if (!EMAIL_RE.test(email)) {
      return json({ error: 'Enter a valid email address so we can send your receipt.' }, 400)
    }
    const domain = email.split('@')[1] ?? ''
    if (DISPOSABLE_DOMAINS.has(domain)) {
      return json({ error: 'Please use a permanent email address so we can send your booking receipt.' }, 400)
    }
    if (fullName.length < 3) {
      return json({ error: 'Enter the name for this booking.' }, 400)
    }
    if (!PHONE_RE.test(phone.replace(/\s+/g, ''))) {
      return json({ error: 'Enter a valid Nigerian phone number, e.g. 0803 123 4567.' }, 400)
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 720) {
      return json({ error: 'Choose a session length between 15 minutes and 12 hours.' }, 400)
    }

    const ipHash = await sha256Hex(clientIp(req) || 'unknown')

    const { data: allowed, error: limitError } = await db.rpc('guest_rate_limit_ok', {
      p_email: email,
      p_ip_hash: ipHash,
    })
    if (limitError) throw limitError
    if (!allowed) {
      await logAttempt(email, ipHash, 'rate_limited')
      return json({
        error: 'Too many guest bookings from here. Please sign in to continue, or try again later.',
      }, 429)
    }

    // Reuse a guest profile, or stop and ask a real account holder to sign in.
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('id, is_guest, full_name, phone')
      .eq('email', email)
      .maybeSingle()
    if (profileError) throw profileError

    if (profile && !profile.is_guest) {
      await logAttempt(email, ipHash, 'requires_sign_in')
      return json({
        requiresSignIn: true,
        error: 'An EV Naija account already exists for this email. Sign in to book with saved details.',
      }, 409)
    }

    let customerId: string
    if (profile?.is_guest) {
      customerId = profile.id
      // Keep the freshest contact details without letting the guest clobber
      // anything else on the profile.
      await db
        .from('profiles')
        .update({ full_name: fullName, phone: phone.replace(/\s+/g, '') })
        .eq('id', customerId)
    } else {
      const password = `${randomToken(24)}${randomToken(12)}`
      const { data: created, error: createError } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          phone: phone.replace(/\s+/g, ''),
          account_type: 'customer',
          is_guest: true,
        },
      })
      if (createError || !created?.user) {
        throw createError ?? new Error('Could not create the guest profile.')
      }
      customerId = created.user.id
      // The on_auth_user_created trigger provisions the profile; mark it guest.
      await db.from('profiles').update({ is_guest: true }).eq('id', customerId)
    }

    const token = randomToken(32)
    const tokenHash = await sha256Hex(token)

    const { data: booking, error: bookingError } = await db.rpc('create_guest_booking', {
      p_customer_id: customerId,
      p_station_id: body.stationId,
      p_charger_id: body.chargerId,
      p_vehicle_id: body.vehicleId ?? null,
      p_start_time: body.startTime,
      p_duration_minutes: durationMinutes,
      p_guest_email: email,
      p_guest_token_hash: tokenHash,
      p_guest_ip_hash: ipHash,
    })
    if (bookingError) throw bookingError

    await logAttempt(email, ipHash, 'created', booking?.booking_reference ?? undefined)

    return json({
      bookingId: booking.id,
      bookingReference: booking.booking_reference,
      guestToken: token,
    })
  } catch (error) {
    console.error('guest-booking', error)
    return json({ error: (error as Error).message }, 400)
  }
})
