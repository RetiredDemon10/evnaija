import type { ChargingSpeed, ConnectorType, Review, Station, StationFilters } from '@/types'
import { supabase } from '@/lib/supabase'
import { isPreviewMode } from '@/lib/env'
import { demoStore, getDemoReviewsForStation } from '@/data/demo'
import { LAUNCH_LOCATIONS } from '@/lib/constants'

const STATION_SELECT = `
  *,
  station_images(*),
  chargers(*, charger_connectors(*)),
  operator:operator_profiles(business_name, business_description, logo_url, business_address, status, created_at)
`

function sortStations(stations: Station[], sort: StationFilters['sort']) {
  const copy = [...stations]
  switch (sort) {
    case 'price_asc':
      return copy.sort((a, b) => cheapest(a) - cheapest(b))
    case 'price_desc':
      return copy.sort((a, b) => cheapest(b) - cheapest(a))
    case 'rating':
      return copy.sort((a, b) => b.rating_average - a.rating_average)
    case 'distance':
      return copy.sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0))
    default:
      return copy.sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || b.rating_average - a.rating_average)
  }
}

function cheapest(station: Station) {
  return Math.min(...station.chargers.filter((c) => c.is_active).map((c) => c.price_per_kwh), 999999)
}

export function filterStations(stations: Station[], filters: StationFilters) {
  const query = filters.search?.trim().toLowerCase()
  const filtered = stations.filter((station) => {
    if (query) {
      const haystack = `${station.name} ${station.address} ${station.city} ${station.state}`.toLowerCase()
      if (!haystack.includes(query)) return false
    }
    if (filters.city && filters.city !== 'all' && station.city !== filters.city) return false
    if (filters.state && filters.state !== 'all' && station.state !== filters.state) return false
    if (filters.availableOnly && station.available_chargers === 0) return false
    if (filters.minRating && station.rating_average < filters.minRating) return false
    if (filters.maxPrice) {
      const min = cheapest(station)
      if (min > filters.maxPrice) return false
    }
    if (filters.connector && filters.connector !== 'all') {
      if (!station.chargers.some((c) => c.connector_type === filters.connector && c.is_active)) return false
    }
    if (filters.speed && filters.speed !== 'all') {
      if (!station.chargers.some((c) => c.speed_category === filters.speed && c.is_active)) return false
    }
    return true
  })
  return sortStations(filtered, filters.sort)
}

export async function fetchStations(filters: StationFilters = {}): Promise<Station[]> {
  if (isPreviewMode || !supabase) {
    return filterStations(demoStore.stations.filter((s) => s.status === 'approved'), filters)
  }
  let query = supabase
    .from('stations')
    .select(STATION_SELECT)
    .eq('status', 'approved')
    .order('is_featured', { ascending: false })
    .order('rating_average', { ascending: false })

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,address.ilike.%${filters.search}%,city.ilike.%${filters.search}%`)
  }
  if (filters.city && filters.city !== 'all') query = query.eq('city', filters.city)
  if (filters.state && filters.state !== 'all') query = query.eq('state', filters.state)
  if (filters.availableOnly) query = query.gt('available_chargers', 0)
  if (filters.minRating) query = query.gte('rating_average', filters.minRating)

  const { data, error } = await query.range(0, 99)
  if (error) throw error
  const stations = (data ?? []) as unknown as Station[]
  return sortStations(stations, filters.sort)
}

export async function fetchFeaturedStations(limit = 6): Promise<Station[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.stations.filter((s) => s.is_featured && s.status === 'approved').slice(0, limit)
  }
  const { data, error } = await supabase
    .from('stations')
    .select(STATION_SELECT)
    .eq('status', 'approved')
    .eq('is_featured', true)
    .order('rating_average', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as Station[]
}

export async function fetchStation(idOrSlug: string): Promise<Station | null> {
  if (isPreviewMode || !supabase) {
    return (
      demoStore.stations.find((s) => s.id === idOrSlug || s.slug === idOrSlug) ?? null
    )
  }
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(idOrSlug)
  let query = supabase.from('stations').select(STATION_SELECT)
  query = isUuid ? query.eq('id', idOrSlug) : query.eq('slug', idOrSlug)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return (data as unknown as Station) ?? null
}

export async function fetchStationReviews(stationId: string) {
  if (isPreviewMode || !supabase) return getDemoReviewsForStation(stationId)
  // Reviews are exposed through a security-definer RPC so anonymous visitors
  // never receive reviewer contact details from the profiles table.
  const { data, error } = await supabase.rpc('get_station_reviews', { p_station_id: stationId })
  if (error) throw error
  return (data ?? []) as unknown as Review[]
}

export async function fetchCityCoverage() {
  if (isPreviewMode || !supabase) {
    return LAUNCH_LOCATIONS.map((location) => ({
      ...location,
      stationCount: demoStore.stations.filter((s) => s.city === location.city && s.status === 'approved').length,
      chargerCount: demoStore.stations
        .filter((s) => s.city === location.city)
        .reduce((acc, s) => acc + s.chargers.length, 0),
    }))
  }
  const { data, error } = await supabase
    .from('stations')
    .select('city, state, chargers(id)')
    .eq('status', 'approved')
  if (error) throw error
  return LAUNCH_LOCATIONS.map((location) => {
    const matches = (data ?? []).filter((row) => (row as { city: string }).city === location.city)
    return {
      ...location,
      stationCount: matches.length,
      chargerCount: matches.reduce(
        (acc, row) => acc + ((row as { chargers?: unknown[] }).chargers?.length ?? 0),
        0,
      ),
    }
  })
}

export interface Slot {
  start: string
  end: string
  available: boolean
  label: string
}

export async function fetchAvailableSlots(chargerId: string, date: string): Promise<Slot[]> {
  if (isPreviewMode || !supabase) {
    const charger = demoStore.stations.flatMap((s) => s.chargers).find((c) => c.id === chargerId)
    if (!charger) return []
    const station = demoStore.stations.find((s) => s.id === charger.station_id)
    const [hours] = (station?.operating_hours ?? '06:00 – 22:00').split('–')
    const openHour = Number((hours ?? '06:00').trim().split(':')[0]) || 6
    const closeHour = 22
    const dayStart = new Date(`${date}T00:00:00`)
    const slots: Slot[] = []
    const bookings = demoStore.bookings.filter(
      (b) =>
        b.charger_id === chargerId &&
        ['pending_payment', 'confirmed', 'checked_in', 'in_progress'].includes(b.status) &&
        new Date(b.start_time).toDateString() === dayStart.toDateString(),
    )
    for (let minutes = openHour * 60; minutes < closeHour * 60; minutes += 30) {
      const start = new Date(dayStart)
      start.setMinutes(minutes)
      const end = new Date(start.getTime() + 30 * 60_000)
      const overlaps = bookings.some(
        (b) => start < new Date(b.end_time) && end > new Date(b.start_time),
      )
      const inPast = start.getTime() < Date.now()
      slots.push({
        start: start.toISOString(),
        end: end.toISOString(),
        available: !overlaps && !inPast && charger.status !== 'maintenance' && charger.status !== 'offline',
        label: start.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: false }),
      })
    }
    return slots
  }
  const { data, error } = await supabase.rpc('get_charger_slots', {
    p_charger_id: chargerId,
    p_date: date,
  })
  if (error) throw error
  return ((data ?? []) as Array<{ slot_start: string; slot_end: string; is_available: boolean }>).map(
    (row) => ({
      start: row.slot_start,
      end: row.slot_end,
      available: row.is_available,
      label: new Date(row.slot_start).toLocaleTimeString('en-NG', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    }),
  )
}
