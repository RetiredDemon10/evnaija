import type {
  Booking,
  BookingStatus,
  Charger,
  ChargerAvailability,
  FinancialLedgerEntry,
  OperatorDocument,
  OperatorProfile,
  PayoutAccount,
  PayoutRequest,
  Review,
  Station,
  StationStatus,
} from '@/types'
import { supabase } from '@/lib/supabase'
import { isPreviewMode } from '@/lib/env'
import { demoStore, getDemoOperatorStats } from '@/data/demo'
import { compressImage } from '@/lib/utils'

const STATION_SELECT = `*, station_images(*), chargers(*, charger_connectors(*))`

export async function getOperatorProfile(userId: string): Promise<OperatorProfile | null> {
  if (isPreviewMode || !supabase) return demoStore.operatorProfile
  const { data, error } = await supabase
    .from('operator_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as OperatorProfile) ?? null
}

export async function updateOperatorProfile(
  id: string,
  patch: Partial<OperatorProfile>,
): Promise<OperatorProfile> {
  if (isPreviewMode || !supabase) {
    Object.assign(demoStore.operatorProfile, patch)
    return demoStore.operatorProfile
  }
  const { data, error } = await supabase
    .from('operator_profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as OperatorProfile
}

export async function getOperatorStats(operatorId: string) {
  if (isPreviewMode || !supabase) return getDemoOperatorStats()

  const { data: stations, error: stationError } = await supabase
    .from('stations')
    .select('id, chargers(id, status, connector_count)')
    .eq('operator_id', operatorId)
  if (stationError) throw stationError
  const stationIds = (stations ?? []).map((s) => s.id)
  const chargerRows = (stations ?? []).flatMap(
    (s) => (s as { chargers?: { status: string; connector_count: number }[] }).chargers ?? [],
  )
  const [{ data: bookings }, { data: payouts }] = await Promise.all([
    stationIds.length
      ? supabase.from('bookings').select('*').in('station_id', stationIds)
      : Promise.resolve({ data: [] }),
    supabase.from('payout_requests').select('*').eq('operator_id', operatorId),
  ])
  const rows = (bookings ?? []) as Booking[]
  const paid = rows.filter((b) => b.payment_status === 'success')
  const today = new Date().toDateString()
  return {
    totalStations: stationIds.length,
    totalChargingPoints: chargerRows.reduce((acc, c) => acc + (c.connector_count ?? 1), 0),
    availableChargers: chargerRows.filter((c) => c.status === 'available').length,
    activeBookings: rows.filter((b) => ['confirmed', 'checked_in', 'in_progress'].includes(b.status)).length,
    todayBookings: rows.filter((b) => new Date(b.start_time).toDateString() === today).length,
    completedSessions: rows.filter((b) => b.status === 'completed').length,
    totalRevenue: paid.reduce((acc, b) => acc + b.operator_earning, 0),
    pendingPayouts: ((payouts ?? []) as PayoutRequest[])
      .filter((p) => ['pending', 'approved', 'processing'].includes(p.status))
      .reduce((acc, p) => acc + p.amount, 0),
    grossRevenue: paid.reduce((acc, b) => acc + b.total_amount, 0),
    commission: paid.reduce((acc, b) => acc + b.platform_commission, 0),
    netEarnings: paid.reduce((acc, b) => acc + b.operator_earning, 0),
  }
}

export async function listOperatorStations(operatorId: string): Promise<Station[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.stations.filter((s) => s.operator_id === operatorId)
  }
  const { data, error } = await supabase
    .from('stations')
    .select(STATION_SELECT)
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Station[]
}

export interface StationInput {
  name: string
  description: string
  state: string
  city: string
  address: string
  latitude: number
  longitude: number
  contact_phone: string
  contact_email: string
  operating_hours: string
  amenities: string[]
  google_maps_url?: string
}

export async function createStation(
  operatorId: string,
  input: StationInput,
  coverImage?: File | null,
): Promise<Station> {
  if (isPreviewMode || !supabase) {
    const station: Station = {
      id: `stn-${Date.now()}`,
      operator_id: operatorId,
      name: input.name,
      slug: input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      description: input.description,
      state: input.state,
      city: input.city,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      google_maps_url:
        input.google_maps_url ??
        `https://www.google.com/maps/dir/?api=1&destination=${input.latitude},${input.longitude}`,
      contact_phone: input.contact_phone,
      contact_email: input.contact_email,
      operating_hours: input.operating_hours,
      amenities: input.amenities,
      status: 'pending',
      is_featured: false,
      rating_average: 0,
      rating_count: 0,
      total_chargers: 0,
      available_chargers: 0,
      images: coverImage
        ? [
            {
              id: `img-${Date.now()}`,
              station_id: `stn-${Date.now()}`,
              image_url: URL.createObjectURL(coverImage),
              alt_text: input.name,
              is_cover: true,
              sort_order: 0,
            },
          ]
        : [],
      chargers: [],
      created_at: new Date().toISOString(),
    }
    demoStore.stations.push(station)
    return station
  }
  const slug = `${input.name}-${Math.random().toString(36).slice(2, 6)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
  const { data, error } = await supabase
    .from('stations')
    .insert({
      operator_id: operatorId,
      name: input.name,
      slug,
      description: input.description,
      state: input.state,
      city: input.city,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      google_maps_url: input.google_maps_url ?? null,
      contact_phone: input.contact_phone,
      contact_email: input.contact_email,
      operating_hours: input.operating_hours,
      amenities: input.amenities,
      status: 'pending',
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (coverImage) {
    const url = await uploadStationImage(data.id, coverImage, true)
    return { ...(data as Station), images: [] , coverUrl: url } as Station
  }
  return data as Station
}

export async function updateStation(id: string, patch: Partial<Station>): Promise<Station> {
  if (isPreviewMode || !supabase) {
    const station = demoStore.stations.find((s) => s.id === id)
    if (!station) throw new Error('Station not found.')
    Object.assign(station, patch)
    return station
  }
  const { data, error } = await supabase
    .from('stations')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Station
}

export async function setStationStatus(id: string, status: StationStatus) {
  return updateStation(id, { status })
}

export async function uploadStationImage(
  stationId: string,
  file: File,
  isCover = false,
): Promise<string> {
  if (isPreviewMode || !supabase) return URL.createObjectURL(file)
  const compressed = await compressImage(file)
  const path = `${stationId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]+/g, '-')}`
  const { error } = await supabase.storage.from('station-images').upload(path, compressed)
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from('station-images').getPublicUrl(path)
  const { error: insertError } = await supabase.from('station_images').insert({
    station_id: stationId,
    image_url: data.publicUrl,
    alt_text: file.name,
    is_cover: isCover,
  })
  if (insertError) throw new Error(insertError.message)
  if (isCover) {
    await supabase
      .from('stations')
      .update({ cover_image_url: data.publicUrl })
      .eq('id', stationId)
  }
  return data.publicUrl
}

export async function deleteStationImage(imageId: string) {
  if (isPreviewMode || !supabase) return
  const { error } = await supabase.from('station_images').delete().eq('id', imageId)
  if (error) throw new Error(error.message)
}

export interface ChargerInput {
  station_id: string
  name: string
  charger_code: string
  connector_type: Charger['connector_type']
  capacity_kw: number
  speed_category: Charger['speed_category']
  connector_count: number
  price_per_kwh: number
  booking_fee: number
  status: Charger['status']
  is_active: boolean
}

export async function saveCharger(input: ChargerInput & { id?: string }): Promise<Charger> {
  if (isPreviewMode || !supabase) {
    const station = demoStore.stations.find((s) => s.id === input.station_id)
    if (!station) throw new Error('Station not found.')
    if (input.id) {
      const existing = station.chargers.find((c) => c.id === input.id)
      if (!existing) throw new Error('Charger not found.')
      Object.assign(existing, input)
      return existing
    }
    const charger: Charger = {
      ...input,
      id: `chg-${Date.now()}`,
      created_at: new Date().toISOString(),
      connectors: Array.from({ length: input.connector_count }).map((_, index) => ({
        id: `chg-${Date.now()}-c${index}`,
        charger_id: `chg-${Date.now()}`,
        connector_number: index + 1,
        connector_type: input.connector_type,
        status: input.status,
      })),
    }
    station.chargers.push(charger)
    station.total_chargers = station.chargers.length
    station.available_chargers = station.chargers.filter((c) => c.status === 'available').length
    return charger
  }
  const { id, ...payload } = input
  const { data, error } = id
    ? await supabase.from('chargers').update(payload).eq('id', id).select().single()
    : await supabase.from('chargers').insert(payload).select().single()
  if (error) throw new Error(error.message)
  return data as Charger
}

export async function deleteCharger(id: string) {
  if (isPreviewMode || !supabase) {
    demoStore.stations.forEach((s) => {
      s.chargers = s.chargers.filter((c) => c.id !== id)
    })
    return
  }
  const { error } = await supabase.from('chargers').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listAvailability(chargerId: string): Promise<ChargerAvailability[]> {
  if (isPreviewMode || !supabase) {
    return Array.from({ length: 7 }).map((_, day) => ({
      id: `${chargerId}-${day}`,
      charger_id: chargerId,
      day_of_week: day,
      opens_at: '06:00',
      closes_at: '22:00',
      is_closed: false,
    }))
  }
  const { data, error } = await supabase
    .from('charger_availability')
    .select('*')
    .eq('charger_id', chargerId)
    .order('day_of_week')
  if (error) throw error
  return (data ?? []) as ChargerAvailability[]
}

export async function saveAvailability(rows: ChargerAvailability[]) {
  if (isPreviewMode || !supabase) return
  const { error } = await supabase
    .from('charger_availability')
    .upsert(rows, { onConflict: 'charger_id,day_of_week' })
  if (error) throw new Error(error.message)
}

export async function listOperatorBookings(stationIds: string[]): Promise<Booking[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.bookings
      .filter((b) => stationIds.includes(b.station_id))
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
      .map((b) => ({
        ...b,
        station: demoStore.stations.find((s) => s.id === b.station_id),
        charger: demoStore.stations.flatMap((s) => s.chargers).find((c) => c.id === b.charger_id),
        vehicle: demoStore.vehicles.find((v) => v.id === b.vehicle_id) ?? undefined,
        customer: demoStore.customers.find((c) => c.id === b.customer_id),
      }))
  }
  if (!stationIds.length) return []
  const { data, error } = await supabase
    .from('bookings')
    .select('*, station:stations(name, city, address), charger:chargers(*), vehicle:vehicles(*), customer:profiles(*)')
    .in('station_id', stationIds)
    .order('start_time', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Booking[]
}

export async function listOperatorCustomers(stationIds: string[]) {
  if (isPreviewMode || !supabase) {
    const ids = new Set(
      demoStore.bookings.filter((b) => stationIds.includes(b.station_id)).map((b) => b.customer_id),
    )
    return demoStore.customers
      .filter((c) => ids.has(c.id))
      .map((c) => ({
        ...c,
        bookings: demoStore.bookings.filter(
          (b) => b.customer_id === c.id && stationIds.includes(b.station_id),
        ).length,
        totalSpent: demoStore.bookings
          .filter((b) => b.customer_id === c.id && stationIds.includes(b.station_id) && b.payment_status === 'success')
          .reduce((acc, b) => acc + b.total_amount, 0),
      }))
  }
  if (!stationIds.length) return []
  const { data, error } = await supabase
    .from('bookings')
    .select('customer_id, total_amount, payment_status, customer:profiles(*)')
    .in('station_id', stationIds)
  if (error) throw error
  const map = new Map<string, { profile: unknown; bookings: number; totalSpent: number }>()
  for (const row of data ?? []) {
    const r = row as { customer_id: string; total_amount: number; payment_status: string; customer: unknown }
    const current = map.get(r.customer_id) ?? { profile: r.customer, bookings: 0, totalSpent: 0 }
    current.bookings += 1
    if (r.payment_status === 'success') current.totalSpent += r.total_amount
    map.set(r.customer_id, current)
  }
  return Array.from(map.entries()).map(([id, value]) => ({
    ...(value.profile as Record<string, unknown>),
    id,
    bookings: value.bookings,
    totalSpent: value.totalSpent,
  }))
}

export async function listOperatorTransactions(operatorId: string): Promise<FinancialLedgerEntry[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.ledger
      .filter((l) => l.operator_id === operatorId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }
  const { data, error } = await supabase
    .from('financial_ledger')
    .select('*')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as FinancialLedgerEntry[]
}

export async function listPayoutAccounts(operatorId: string): Promise<PayoutAccount[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.payoutAccounts.filter((p) => p.operator_id === operatorId)
  }
  const { data, error } = await supabase
    .from('payout_accounts')
    .select('*')
    .eq('operator_id', operatorId)
  if (error) throw error
  return (data ?? []) as PayoutAccount[]
}

export async function savePayoutAccount(
  operatorId: string,
  input: Omit<PayoutAccount, 'id' | 'operator_id' | 'created_at' | 'recipient_code'> & { id?: string },
) {
  if (isPreviewMode || !supabase) {
    if (input.is_default) demoStore.payoutAccounts.forEach((a) => (a.is_default = false))
    const account: PayoutAccount = {
      ...input,
      id: input.id ?? `pa-${Date.now()}`,
      operator_id: operatorId,
      recipient_code: null,
      created_at: new Date().toISOString(),
    }
    const index = demoStore.payoutAccounts.findIndex((a) => a.id === account.id)
    if (index >= 0) demoStore.payoutAccounts[index] = account
    else demoStore.payoutAccounts.push(account)
    return account
  }
  const { id, ...payload } = input
  if (payload.is_default) {
    await supabase.from('payout_accounts').update({ is_default: false }).eq('operator_id', operatorId)
  }
  const { data, error } = id
    ? await supabase.from('payout_accounts').update(payload).eq('id', id).select().single()
    : await supabase.from('payout_accounts').insert({ ...payload, operator_id: operatorId }).select().single()
  if (error) throw new Error(error.message)
  return data as PayoutAccount
}

export async function listPayoutRequests(operatorId: string): Promise<PayoutRequest[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.payouts
      .filter((p) => p.operator_id === operatorId)
      .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime())
  }
  const { data, error } = await supabase
    .from('payout_requests')
    .select('*, account:payout_accounts(*)')
    .eq('operator_id', operatorId)
    .order('requested_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as PayoutRequest[]
}

export async function requestPayout(operatorId: string, amount: number, payoutAccountId: string) {
  if (isPreviewMode || !supabase) {
    const payout: PayoutRequest = {
      id: `po-${Date.now()}`,
      operator_id: operatorId,
      payout_account_id: payoutAccountId,
      amount,
      status: 'pending',
      notes: null,
      admin_notes: null,
      paystack_transfer_reference: null,
      requested_at: new Date().toISOString(),
      processed_at: null,
    }
    demoStore.payouts.unshift(payout)
    return payout
  }
  const { data, error } = await supabase.rpc('request_payout', {
    p_amount: amount,
    p_payout_account_id: payoutAccountId,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function listOperatorReviews(stationIds: string[]): Promise<Review[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.reviews
      .filter((r) => stationIds.includes(r.station_id))
      .map((r) => ({
        ...r,
        station: demoStore.stations.find((s) => s.id === r.station_id),
        customer: demoStore.customers.find((c) => c.id === r.customer_id),
        response: demoStore.reviewResponses.find((rr) => rr.review_id === r.id) ?? null,
      }))
  }
  if (!stationIds.length) return []
  const { data, error } = await supabase
    .from('reviews')
    .select('*, station:stations(name), customer:profiles(*), response:review_responses(*)')
    .in('station_id', stationIds)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Review[]
}

export async function listOperatorDocuments(operatorId: string): Promise<OperatorDocument[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.operatorDocuments.filter((d) => d.operator_id === operatorId)
  }
  const { data, error } = await supabase
    .from('operator_documents')
    .select('*')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as OperatorDocument[]
}

export async function uploadOperatorDocument(
  operatorId: string,
  file: File,
  documentType: OperatorDocument['document_type'],
): Promise<OperatorDocument> {
  if (isPreviewMode || !supabase) {
    const doc: OperatorDocument = {
      id: `doc-${Date.now()}`,
      operator_id: operatorId,
      document_type: documentType,
      file_url: URL.createObjectURL(file),
      file_name: file.name,
      status: 'pending',
      notes: null,
      created_at: new Date().toISOString(),
    }
    demoStore.operatorDocuments.push(doc)
    return doc
  }
  const path = `${operatorId}/${documentType}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]+/g, '-')}`
  const { error: uploadError } = await supabase.storage.from('operator-documents').upload(path, file)
  if (uploadError) throw new Error(uploadError.message)
  const { data: signed } = await supabase.storage
    .from('operator-documents')
    .createSignedUrl(path, 60 * 60 * 24 * 365)
  const { data, error } = await supabase
    .from('operator_documents')
    .insert({
      operator_id: operatorId,
      document_type: documentType,
      file_url: signed?.signedUrl ?? path,
      file_name: file.name,
      status: 'pending',
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as OperatorDocument
}

export function revenueSeries(bookings: Booking[], range: 'daily' | 'weekly' | 'monthly' | 'yearly') {
  const buckets = new Map<string, { label: string; revenue: number; bookings: number }>()
  const paid = bookings.filter((b) => b.payment_status === 'success')
  for (const booking of paid) {
    const date = new Date(booking.start_time)
    let key: string
    let label: string
    if (range === 'daily') {
      key = date.toISOString().slice(0, 10)
      label = date.toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })
    } else if (range === 'weekly') {
      const start = new Date(date)
      start.setDate(date.getDate() - date.getDay())
      key = start.toISOString().slice(0, 10)
      label = `Wk ${start.toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })}`
    } else if (range === 'monthly') {
      key = date.toISOString().slice(0, 7)
      label = date.toLocaleDateString('en-NG', { month: 'short' })
    } else {
      key = String(date.getFullYear())
      label = String(date.getFullYear())
    }
    const bucket = buckets.get(key) ?? { label, revenue: 0, bookings: 0 }
    bucket.revenue += booking.operator_earning
    bucket.bookings += 1
    buckets.set(key, bucket)
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([, value]) => value)
}

export async function updateBookingStatusOperator(
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
