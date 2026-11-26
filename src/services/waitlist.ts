import type { WaitlistEntry } from '@/types'
import { supabase } from '@/lib/supabase'
import { isPreviewMode } from '@/lib/env'
import { demoStore } from '@/data/demo'

const WAITLIST_SELECT = `
  *,
  station:stations(*, station_images(*), chargers(*)),
  charger:chargers(*)
`

function attachPreview(entry: WaitlistEntry): WaitlistEntry {
  return {
    ...entry,
    station: demoStore.stations.find((station) => station.id === entry.station_id),
    charger: entry.charger_id
      ? demoStore.stations.flatMap((station) => station.chargers).find((charger) => charger.id === entry.charger_id) ?? null
      : null,
  }
}

export interface JoinWaitlistInput {
  stationId: string
  chargerId: string | null
  desiredDate: string
  preferredStart?: string | null
}

export async function listWaitlist(userId?: string): Promise<WaitlistEntry[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.waitlistEntries
      .filter((entry) => !userId || entry.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(attachPreview)
  }
  let query = supabase
    .from('waitlist_entries')
    .select(WAITLIST_SELECT)
    .order('created_at', { ascending: false })
  if (userId) query = query.eq('user_id', userId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as WaitlistEntry[]
}

export async function joinWaitlist(
  input: JoinWaitlistInput,
  userId?: string,
): Promise<WaitlistEntry> {
  if (isPreviewMode || !supabase) {
    const uid = userId ?? 'cust-1'
    const station = demoStore.stations.find((item) => item.id === input.stationId)
    if (!station) throw new Error('Station not found.')
    if (input.chargerId && !station.chargers.some((charger) => charger.id === input.chargerId)) {
      throw new Error('That charger does not belong to this station.')
    }
    const existing = demoStore.waitlistEntries.find(
      (entry) =>
        entry.user_id === uid &&
        entry.station_id === input.stationId &&
        entry.charger_id === (input.chargerId || null) &&
        entry.desired_date === input.desiredDate &&
        (entry.status === 'pending' || entry.status === 'notified'),
    )
    if (existing) return attachPreview(existing)

    const entry: WaitlistEntry = {
      id: `wl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user_id: uid,
      station_id: input.stationId,
      charger_id: input.chargerId || null,
      desired_date: input.desiredDate,
      preferred_start: input.preferredStart || null,
      status: 'pending',
      notified_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    demoStore.waitlistEntries.unshift(entry)
    demoStore.notifications.unshift({
      id: `ntf-wl-${Date.now()}`,
      user_id: uid,
      title: 'You are on the waitlist',
      message: `We will notify you if a charger opens at ${station.name} on ${input.desiredDate}.`,
      type: 'booking',
      is_read: false,
      link: `/app/bookings/new/${station.id}?charger=${input.chargerId ?? ''}&date=${input.desiredDate}`,
      created_at: new Date().toISOString(),
    })
    return attachPreview(entry)
  }

  const { data, error } = await supabase.rpc('join_waitlist', {
    p_station_id: input.stationId,
    p_charger_id: input.chargerId,
    p_desired_date: input.desiredDate,
    p_preferred_start: input.preferredStart ?? null,
  })
  if (error) throw new Error(error.message)
  return data as unknown as WaitlistEntry
}

export async function cancelWaitlist(entryId: string): Promise<WaitlistEntry | null> {
  if (isPreviewMode || !supabase) {
    const entry = demoStore.waitlistEntries.find((item) => item.id === entryId)
    if (!entry) throw new Error('Waitlist entry not found.')
    entry.status = 'cancelled'
    entry.updated_at = new Date().toISOString()
    return attachPreview(entry)
  }
  const { data, error } = await supabase.rpc('leave_waitlist', { p_waitlist_id: entryId })
  if (error) throw new Error(error.message)
  return (data as unknown as WaitlistEntry) ?? null
}
