import type {
  Booking,
  BookingFrequency,
  BookingSeries,
  BookingStatus,
  Payment,
  PaymentStatus,
  Vehicle,
} from '@/types'
import { supabase } from '@/lib/supabase'
import { isPreviewMode } from '@/lib/env'
import { demoStore } from '@/data/demo'
import { SITE_FEES } from '@/lib/fees'
import { nextOccurrence } from '@/lib/recurrence'

const BOOKING_SELECT = `
  *,
  station:stations(*, station_images(*), chargers(*)),
  charger:chargers(*),
  vehicle:vehicles(*),
  customer:profiles(*),
  payment:payments(*),
  series:booking_series(*)
`

function attachPreview(booking: Booking): Booking {
  const station = demoStore.stations.find((s) => s.id === booking.station_id)
  const charger = demoStore.stations.flatMap((s) => s.chargers).find((c) => c.id === booking.charger_id)
  const vehicle = demoStore.vehicles.find((v) => v.id === booking.vehicle_id) ?? null
  const customer = demoStore.customers.find((c) => c.id === booking.customer_id)
  const payment = demoStore.payments.find((p) => p.booking_id === booking.id)
  const series = booking.series_id
    ? demoStore.bookingSeries.find((item) => item.id === booking.series_id) ?? null
    : null
  return { ...booking, station, charger, vehicle: vehicle ?? undefined, customer, payment, series }
}

function attachSeriesPreview(series: BookingSeries): BookingSeries {
  const station = demoStore.stations.find((item) => item.id === series.station_id)
  return {
    ...series,
    station,
    charger: station?.chargers.find((charger) => charger.id === series.charger_id),
    vehicle: demoStore.vehicles.find((vehicle) => vehicle.id === series.vehicle_id) ?? null,
  }
}

export async function listCustomerBookings(customerId?: string): Promise<Booking[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.bookings
      .filter((b) => !customerId || b.customer_id === customerId)
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
      .map(attachPreview)
  }
  let query = supabase.from('bookings').select(BOOKING_SELECT).order('start_time', { ascending: false })
  if (customerId) query = query.eq('customer_id', customerId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as Booking[]
}

export async function getBooking(id: string): Promise<Booking | null> {
  if (isPreviewMode || !supabase) {
    const booking = demoStore.bookings.find((b) => b.id === id || b.booking_reference === id)
    return booking ? attachPreview(booking) : null
  }
  const { data, error } = await supabase
    .from('bookings')
    .select(`${BOOKING_SELECT}, review:reviews(*, response:review_responses(*))`)
    .or(`id.eq.${id},booking_reference.eq.${id}`)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as Booking) ?? null
}

export interface CreateBookingInput {
  stationId: string
  chargerId: string
  vehicleId: string | null
  startTime: string
  durationMinutes: number
}

export interface CreateGuestBookingInput extends CreateBookingInput {
  email: string
  fullName: string
  phone: string
  /** Honeypot field — must stay empty. */
  company?: string
}

export interface GuestBookingResult {
  booking: Booking
  guestToken: string
}

const GUEST_TOKEN_PREFIX = 'evn.guest.token.'

/** Remember a guest token for a payment reference so the callback page can verify it. */
export function rememberGuestToken(reference: string, token: string) {
  try {
    sessionStorage.setItem(`${GUEST_TOKEN_PREFIX}${reference}`, token)
  } catch {
    /* sessionStorage can be unavailable in private modes */
  }
}

export function recallGuestToken(reference: string): string | null {
  try {
    return sessionStorage.getItem(`${GUEST_TOKEN_PREFIX}${reference}`)
  } catch {
    return null
  }
}

/**
 * Server-side guest checkout. The edge function provisions a guest profile and
 * returns a per-booking bearer token; the browser stays signed out.
 */
export async function createGuestBooking(input: CreateGuestBookingInput): Promise<GuestBookingResult> {
  if (isPreviewMode || !supabase) {
    // Preview never contacts a payment provider. The demo booking is held only,
    // so no charge is implied and no success is faked.
    const booking = await createBooking(input)
    booking.is_guest = true
    booking.guest_email = input.email
    const stored = demoStore.bookings.find((item) => item.id === booking.id)
    if (stored) {
      stored.is_guest = true
      stored.guest_email = input.email
    }
    return { booking: attachPreview(booking), guestToken: `preview-guest-${booking.id}` }
  }
  const { data, error } = await supabase.functions.invoke('guest-booking', {
    body: {
      stationId: input.stationId,
      chargerId: input.chargerId,
      vehicleId: input.vehicleId,
      startTime: input.startTime,
      durationMinutes: input.durationMinutes,
      email: input.email,
      fullName: input.fullName,
      phone: input.phone,
      company: input.company ?? '',
    },
  })
  if (error) {
    // Edge functions return structured errors in the body; surface the message.
    const context = (error as { context?: { body?: { error?: string } } }).context
    throw new Error(context?.body?.error ?? error.message)
  }
  if (!data?.bookingId || !data?.guestToken) {
    throw new Error(data?.error ?? 'We could not start guest checkout. Please try again.')
  }
  const booking = await getGuestBooking(data.bookingId as string, data.guestToken as string)
  if (!booking) throw new Error('Booking created but could not be loaded. Contact support with your reference.')
  return { booking, guestToken: data.guestToken as string }
}

/** Read a guest booking using its bearer token (RLS blocks direct reads). */
export async function getGuestBooking(bookingId: string, token: string): Promise<Booking | null> {
  if (isPreviewMode || !supabase) {
    const booking = demoStore.bookings.find((b) => b.id === bookingId || b.booking_reference === bookingId)
    return booking ? attachPreview(booking) : null
  }
  const { data, error } = await supabase.rpc('get_guest_booking', {
    p_booking_id: bookingId,
    p_token: token,
  })
  if (error) throw new Error(error.message)
  return (data as unknown as Booking) ?? null
}

/** Turn a guest profile into a full account once the guest sets a password. */
export async function markGuestClaimed() {
  if (isPreviewMode || !supabase) return
  const { error } = await supabase.rpc('mark_guest_claimed')
  if (error) throw new Error(error.message)
}

/** Statuses that mean the customer has paid and can use station directions. */
export const PAID_BOOKING_STATUSES: BookingStatus[] = ['confirmed', 'checked_in', 'in_progress', 'completed']

export function bookingIsConfirmed(booking: Booking): boolean {
  return PAID_BOOKING_STATUSES.includes(booking.status) && booking.payment_status === 'success'
}

/** Guest tokens are scoped to a booking reference and kept in this tab only. */
export function listRememberedGuestTokens(): { reference: string; token: string }[] {
  try {
    const tokens: { reference: string; token: string }[] = []
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index)
      if (!key?.startsWith(GUEST_TOKEN_PREFIX)) continue
      const token = sessionStorage.getItem(key)
      if (token) tokens.push({ reference: key.slice(GUEST_TOKEN_PREFIX.length), token })
    }
    return tokens
  } catch {
    return []
  }
}

/**
 * Look up a booking by number for the public Manage Booking page. The secret is
 * either the guest token (or its secure link) or the email on the booking.
 */
export async function lookupBooking(reference: string, secret: string): Promise<Booking | null> {
  const ref = reference.trim()
  const sec = secret.trim()
  if (!ref || !sec) return null

  if (isPreviewMode || !supabase) {
    const booking = demoStore.bookings.find(
      (item) => item.booking_reference.toUpperCase() === ref.toUpperCase(),
    )
    if (!booking) return null
    const tokenFromLink = sec.match(/[?&]token=([^&]+)/i)?.[1]
    const candidate = (tokenFromLink ?? sec).toLowerCase()
    const customer = demoStore.customers.find((item) => item.id === booking.customer_id)
    const accepted = [
      booking.guest_email ?? '',
      customer?.email ?? '',
      `preview-guest-${booking.id}`,
    ]
      .map((value) => value.toLowerCase())
      .filter(Boolean)
    return accepted.includes(candidate) ? attachPreview(booking) : null
  }

  const { data, error } = await supabase.functions.invoke('lookup-booking', {
    body: { reference: ref, secret: sec },
  })
  if (error) {
    const context = (error as { context?: { body?: { error?: string } } }).context
    const message = context?.body?.error ?? error.message
    // A missing match is an expected outcome of a search, not a failure.
    if (/no booking matched/i.test(message)) return null
    throw new Error(message)
  }
  return (data?.booking as unknown as Booking) ?? null
}

/**
 * Station maps and directions are revealed only after a paid booking at that
 * station. Signed-in customers are checked via RLS; guests via their stored
 * per-booking tokens.
 */
export async function canViewStationMap(stationId: string, customerId?: string): Promise<boolean> {
  if (!stationId) return false

  if (customerId) {
    const bookings = await listCustomerBookings(customerId)
    if (bookings.some((booking) => booking.station_id === stationId && bookingIsConfirmed(booking))) {
      return true
    }
  }

  for (const { reference, token } of listRememberedGuestTokens()) {
    try {
      const booking = await lookupBooking(reference, token)
      if (booking?.station_id === stationId && bookingIsConfirmed(booking)) return true
    } catch {
      // A stale token should simply not unlock the map.
    }
  }
  return false
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  if (isPreviewMode || !supabase) {
    const station = demoStore.stations.find((s) => s.id === input.stationId)
    const charger = station?.chargers.find((c) => c.id === input.chargerId)
    if (!station || !charger) throw new Error('Charger not found.')
    if (charger.status === 'maintenance' || charger.status === 'offline') {
      throw new Error('This charger is currently unavailable.')
    }
    const start = new Date(input.startTime)
    const end = new Date(start.getTime() + input.durationMinutes * 60_000)
    const conflict = demoStore.bookings.some(
      (b) =>
        b.charger_id === charger.id &&
        ['pending_payment', 'confirmed', 'checked_in', 'in_progress'].includes(b.status) &&
        start < new Date(b.end_time) &&
        end > new Date(b.start_time),
    )
    if (conflict) throw new Error('That slot was just taken. Please choose another time.')
    if (start.getTime() < Date.now() - 60_000) throw new Error('Choose a future time slot.')
    const vehicle = demoStore.vehicles.find((v) => v.id === input.vehicleId)
    const round2 = (value: number) => Math.round(value * 100) / 100
    const energyKwh = round2(
      Math.min(
        (charger.capacity_kw * input.durationMinutes) / 60,
        vehicle?.battery_capacity_kwh ?? charger.capacity_kw,
      ),
    )
    const chargingFee = round2(energyKwh * charger.price_per_kwh)
    const bookingFee = charger.booking_fee
    const serviceFee = SITE_FEES.serviceFee
    const tax = round2(serviceFee * (SITE_FEES.vatPercent / 100))
    const total = round2(chargingFee + bookingFee + serviceFee + tax)
    const commission = round2(chargingFee * (SITE_FEES.commissionPercent / 100))
    const reference = `EVN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    const booking: Booking = {
      id: `bk-${Math.random().toString(36).slice(2, 8)}`,
      booking_reference: reference,
      customer_id: 'cust-1',
      station_id: station.id,
      charger_id: charger.id,
      vehicle_id: input.vehicleId,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      duration_minutes: input.durationMinutes,
      energy_kwh: energyKwh,
      charging_fee: chargingFee,
      booking_fee: bookingFee,
      service_fee: serviceFee,
      tax_amount: tax,
      discount_amount: 0,
      total_amount: total,
      platform_commission: commission,
      operator_earning: round2(chargingFee - commission + bookingFee),
      status: 'pending_payment',
      payment_status: 'pending',
      qr_code: `EVN|${reference}|${start.toISOString()}`,
      hold_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      cancellation_reason: null,
      cancelled_at: null,
      checked_in_at: null,
      started_at: null,
      completed_at: null,
      created_at: new Date().toISOString(),
    }
    demoStore.bookings.unshift(booking)
    demoStore.payments.unshift({
      id: `pay-${booking.id}`,
      booking_id: booking.id,
      customer_id: 'cust-1',
      reference: `PAY-${reference}`,
      paystack_reference: null,
      amount: total,
      currency: 'NGN',
      status: 'pending',
      channel: null,
      gateway_response: 'Awaiting payment',
      paid_at: null,
      metadata: null,
      created_at: new Date().toISOString(),
    })
    demoStore.notifications.unshift({
      id: `ntf-${Date.now()}`,
      user_id: 'cust-1',
      title: 'Booking held',
      message: `We are holding ${charger.name} at ${station.name} for 15 minutes while you complete payment.`,
      type: 'booking',
      is_read: false,
      link: `/app/bookings/${booking.id}`,
      created_at: new Date().toISOString(),
    })
    return attachPreview(booking)
  }
  const { data, error } = await supabase.rpc('create_booking', {
    p_station_id: input.stationId,
    p_charger_id: input.chargerId,
    p_vehicle_id: input.vehicleId,
    p_start_time: input.startTime,
    p_duration_minutes: input.durationMinutes,
  })
  if (error) throw new Error(error.message)
  return data as unknown as Booking
}

export interface CreateBookingSeriesInput extends CreateBookingInput {
  frequency: BookingFrequency
  occurrences: number
}

export async function createBookingSeries(input: CreateBookingSeriesInput): Promise<Booking> {
  if (input.occurrences < 2 || input.occurrences > 12) {
    throw new Error('A recurring plan must include between 2 and 12 sessions.')
  }

  if (isPreviewMode || !supabase) {
    const booking = await createBooking(input)
    const series: BookingSeries = {
      id: `ser-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customer_id: booking.customer_id,
      station_id: booking.station_id,
      charger_id: booking.charger_id,
      vehicle_id: booking.vehicle_id,
      frequency: input.frequency,
      duration_minutes: input.durationMinutes,
      start_time: booking.start_time,
      next_start_time: nextOccurrence(booking.start_time, input.frequency, 1).toISOString(),
      occurrences: input.occurrences,
      bookings_created: 1,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    demoStore.bookingSeries.unshift(series)
    booking.series_id = series.id
    const storedBooking = demoStore.bookings.find((item) => item.id === booking.id)
    if (storedBooking) storedBooking.series_id = series.id
    demoStore.notifications.unshift({
      id: `ntf-series-${Date.now()}`,
      user_id: booking.customer_id,
      title: 'Recurring plan created',
      message: `Your ${input.frequency} plan for ${booking.station?.name ?? 'your station'} is ready. We created the first booking; reserve each next session from My bookings.`,
      type: 'booking',
      is_read: false,
      link: '/app/bookings',
      created_at: new Date().toISOString(),
    })
    return attachPreview(booking)
  }

  const { data, error } = await supabase.rpc('create_booking_series', {
    p_station_id: input.stationId,
    p_charger_id: input.chargerId,
    p_vehicle_id: input.vehicleId,
    p_start_time: input.startTime,
    p_duration_minutes: input.durationMinutes,
    p_frequency: input.frequency,
    p_occurrences: input.occurrences,
  })
  if (error) throw new Error(error.message)
  return data as unknown as Booking
}

export async function listBookingSeries(customerId?: string): Promise<BookingSeries[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.bookingSeries
      .filter((series) => !customerId || series.customer_id === customerId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(attachSeriesPreview)
  }
  let query = supabase
    .from('booking_series')
    .select('*, station:stations(*), charger:chargers(*), vehicle:vehicles(*)')
    .order('created_at', { ascending: false })
  if (customerId) query = query.eq('customer_id', customerId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as BookingSeries[]
}

export async function bookNextSeriesOccurrence(seriesId: string): Promise<Booking> {
  if (isPreviewMode || !supabase) {
    const series = demoStore.bookingSeries.find((item) => item.id === seriesId)
    if (!series) throw new Error('Recurring plan not found.')
    if (series.status !== 'active') throw new Error('This recurring plan is not active.')
    if (series.bookings_created >= series.occurrences) {
      series.status = 'completed'
      throw new Error('All sessions in this recurring plan have been created.')
    }
    const booking = await createBooking({
      stationId: series.station_id,
      chargerId: series.charger_id,
      vehicleId: series.vehicle_id,
      startTime: series.next_start_time,
      durationMinutes: series.duration_minutes,
    })
    booking.series_id = series.id
    const storedBooking = demoStore.bookings.find((item) => item.id === booking.id)
    if (storedBooking) storedBooking.series_id = series.id
    series.bookings_created += 1
    series.next_start_time = nextOccurrence(
      series.start_time,
      series.frequency,
      series.bookings_created,
    ).toISOString()
    if (series.bookings_created >= series.occurrences) series.status = 'completed'
    series.updated_at = new Date().toISOString()
    demoStore.notifications.unshift({
      id: `ntf-series-next-${Date.now()}`,
      user_id: series.customer_id,
      title: 'Next recurring session booked',
      message: `We created your next session at ${booking.station?.name ?? 'your station'}. Complete payment to confirm it.`,
      type: 'booking',
      is_read: false,
      link: `/app/bookings/${booking.id}`,
      created_at: new Date().toISOString(),
    })
    return attachPreview(booking)
  }
  const { data, error } = await supabase.rpc('book_next_series_occurrence', {
    p_series_id: seriesId,
  })
  if (error) throw new Error(error.message)
  return data as unknown as Booking
}

export async function cancelBookingSeries(seriesId: string): Promise<BookingSeries> {
  if (isPreviewMode || !supabase) {
    const series = demoStore.bookingSeries.find((item) => item.id === seriesId)
    if (!series) throw new Error('Recurring plan not found.')
    series.status = 'cancelled'
    series.updated_at = new Date().toISOString()
    return attachSeriesPreview(series)
  }
  const { data, error } = await supabase.rpc('cancel_booking_series', {
    p_series_id: seriesId,
  })
  if (error) throw new Error(error.message)
  return data as unknown as BookingSeries
}

export async function cancelBooking(bookingId: string, reason: string) {
  if (isPreviewMode || !supabase) {
    const booking = demoStore.bookings.find((b) => b.id === bookingId)
    if (!booking) throw new Error('Booking not found.')
    if (!['pending_payment', 'confirmed'].includes(booking.status)) {
      throw new Error('This booking can no longer be cancelled.')
    }
    booking.status = 'cancelled'
    booking.cancellation_reason = reason
    booking.cancelled_at = new Date().toISOString()
    demoStore.notifications.unshift({
      id: `ntf-${Date.now()}`,
      user_id: booking.customer_id,
      title: 'Booking cancelled',
      message: `Booking ${booking.booking_reference} has been cancelled. Any eligible refund will appear in your payment history.`,
      type: 'booking',
      is_read: false,
      link: `/app/bookings/${booking.id}`,
      created_at: new Date().toISOString(),
    })
    return booking
  }
  const { data, error } = await supabase.rpc('cancel_booking', {
    p_booking_id: bookingId,
    p_reason: reason,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function listPayments(customerId?: string): Promise<Payment[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.payments
      .filter((p) => !customerId || p.customer_id === customerId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((p) => ({
        ...p,
        booking: demoStore.bookings.find((b) => b.id === p.booking_id),
      }))
  }
  let query = supabase
    .from('payments')
    .select('*, booking:bookings(*, station:stations(name, city, address))')
    .order('created_at', { ascending: false })
  if (customerId) query = query.eq('customer_id', customerId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as Payment[]
}

export async function initializePayment(bookingId: string, guestToken?: string) {
  if (isPreviewMode || !supabase) {
    throw new Error(
      'Preview mode: live Paystack checkout is disabled. Configure Supabase and Paystack credentials to complete a real test payment.',
    )
  }
  const { data, error } = await supabase.functions.invoke('initialize-payment', {
    body: guestToken ? { bookingId, guestToken } : { bookingId },
  })
  if (error) {
    const context = (error as { context?: { body?: { error?: string } } }).context
    throw new Error(context?.body?.error ?? error.message)
  }
  if (!data?.authorization_url) throw new Error(data?.error ?? 'Could not initialise payment.')
  return data as { authorization_url: string; reference: string; access_code: string }
}

export async function verifyPayment(reference: string, guestToken?: string) {
  if (isPreviewMode || !supabase) {
    throw new Error('Preview mode: payment verification requires a configured backend.')
  }
  const { data, error } = await supabase.functions.invoke('verify-payment', {
    body: guestToken ? { reference, guestToken } : { reference },
  })
  if (error) {
    const context = (error as { context?: { body?: { error?: string } } }).context
    throw new Error(context?.body?.error ?? error.message)
  }
  if (!data?.success) throw new Error(data?.error ?? 'Payment could not be verified.')
  return data as { success: boolean; booking?: Booking; payment?: Payment; message?: string }
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
  notes?: string,
) {
  if (isPreviewMode || !supabase) {
    const booking = demoStore.bookings.find((b) => b.id === bookingId)
    if (!booking) throw new Error('Booking not found.')
    booking.status = status
    if (status === 'checked_in') booking.checked_in_at = new Date().toISOString()
    if (status === 'in_progress') booking.started_at = new Date().toISOString()
    if (status === 'completed') {
      booking.completed_at = new Date().toISOString()
    }
    return booking
  }
  const { data, error } = await supabase.rpc('update_booking_status', {
    p_booking_id: bookingId,
    p_status: status,
    p_notes: notes ?? null,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function validateBookingQr(qrCode: string) {
  if (isPreviewMode || !supabase) {
    const reference = qrCode.split('|')[1] ?? qrCode
    const booking = demoStore.bookings.find(
      (b) => b.booking_reference === reference || b.qr_code === qrCode,
    )
    if (!booking) throw new Error('Invalid QR code — no booking found.')
    if (booking.status !== 'confirmed') {
      throw new Error(`This booking is ${booking.status.replace('_', ' ')} and cannot be checked in.`)
    }
    booking.status = 'checked_in'
    booking.checked_in_at = new Date().toISOString()
    return attachPreview(booking)
  }
  const { data, error } = await supabase.rpc('validate_booking_qr', { p_qr_code: qrCode })
  if (error) throw new Error(error.message)
  return data as unknown as Booking
}

export async function listVehicles(userId?: string): Promise<Vehicle[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.vehicles.filter((v) => !userId || v.user_id === userId)
  }
  let query = supabase.from('vehicles').select('*').order('created_at', { ascending: false })
  if (userId) query = query.eq('user_id', userId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Vehicle[]
}

export async function saveVehicle(
  vehicle: Omit<Vehicle, 'id' | 'created_at' | 'user_id'> & { id?: string },
  userId?: string,
): Promise<Vehicle> {
  if (isPreviewMode || !supabase) {
    const existingIndex = vehicle.id ? demoStore.vehicles.findIndex((v) => v.id === vehicle.id) : -1
    if (vehicle.is_primary) demoStore.vehicles.forEach((v) => (v.is_primary = false))
    const next: Vehicle = {
      ...vehicle,
      id: vehicle.id ?? `veh-${Date.now()}`,
      user_id: userId ?? 'cust-1',
      created_at: vehicle.id
        ? demoStore.vehicles.find((v) => v.id === vehicle.id)?.created_at ?? new Date().toISOString()
        : new Date().toISOString(),
    }
    if (existingIndex >= 0) demoStore.vehicles[existingIndex] = next
    else demoStore.vehicles.push(next)
    return next
  }
  const uid = userId ?? (await supabase.auth.getUser()).data.user?.id
  if (!uid) throw new Error('Not signed in.')
  if (vehicle.is_primary) {
    await supabase.from('vehicles').update({ is_primary: false }).eq('user_id', uid)
  }
  const payload = { ...vehicle, user_id: uid, id: undefined, created_at: undefined }
  const { data, error } = vehicle.id
    ? await supabase.from('vehicles').update(payload).eq('id', vehicle.id).select().single()
    : await supabase.from('vehicles').insert(payload).select().single()
  if (error) throw new Error(error.message)
  return data as Vehicle
}

export async function deleteVehicle(id: string) {
  if (isPreviewMode || !supabase) {
    const index = demoStore.vehicles.findIndex((v) => v.id === id)
    if (index >= 0) demoStore.vehicles.splice(index, 1)
    return
  }
  const { error } = await supabase.from('vehicles').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export function paymentStatusLabel(status: PaymentStatus) {
  return status === 'success' ? 'Paid' : status.charAt(0).toUpperCase() + status.slice(1)
}
