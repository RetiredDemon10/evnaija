import type { PriceAlert, PriceAlertKind } from '@/types'
import { supabase } from '@/lib/supabase'
import { isPreviewMode } from '@/lib/env'
import { demoStore } from '@/data/demo'

const ALERT_SELECT = `
  *,
  station:stations(*, station_images(*), chargers(*)),
  charger:chargers(*)
`

function attachPreview(alert: PriceAlert): PriceAlert {
  const station = demoStore.stations.find((s) => s.id === alert.station_id)
  const charger = alert.charger_id
    ? demoStore.stations.flatMap((s) => s.chargers).find((c) => c.id === alert.charger_id) ?? null
    : null
  return { ...alert, station, charger }
}

export async function listPriceAlerts(userId: string): Promise<PriceAlert[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.priceAlerts
      .filter((alert) => alert.user_id === userId)
      .map(attachPreview)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }
  const { data, error } = await supabase
    .from('price_alerts')
    .select(ALERT_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as PriceAlert[]
}

export interface CreatePriceAlertInput {
  stationId: string
  chargerId?: string | null
  kind: PriceAlertKind
  targetPrice?: number | null
}

export async function createPriceAlert(userId: string, input: CreatePriceAlertInput): Promise<PriceAlert> {
  const payload = {
    user_id: userId,
    station_id: input.stationId,
    charger_id: input.chargerId ?? null,
    kind: input.kind,
    target_price: input.kind === 'price_drop' ? input.targetPrice ?? null : null,
    status: 'active' as const,
  }
  if (isPreviewMode || !supabase) {
    const existing = demoStore.priceAlerts.find(
      (alert) =>
        alert.user_id === userId &&
        alert.station_id === input.stationId &&
        (alert.charger_id ?? null) === (input.chargerId ?? null) &&
        alert.kind === input.kind &&
        alert.status === 'active',
    )
    if (existing) {
      existing.target_price = payload.target_price
      return attachPreview(existing)
    }
    const created: PriceAlert = {
      id: `pal-${Date.now()}`,
      ...payload,
      last_notified_at: null,
      created_at: new Date().toISOString(),
    }
    demoStore.priceAlerts.unshift(created)
    return attachPreview(created)
  }
  const existingQuery = supabase
    .from('price_alerts')
    .select('id')
    .eq('user_id', userId)
    .eq('station_id', input.stationId)
    .eq('kind', input.kind)
    .eq('status', 'active')
    .limit(1)
  const { data: existingRow } = input.chargerId
    ? await existingQuery.eq('charger_id', input.chargerId).maybeSingle()
    : await existingQuery.is('charger_id', null).maybeSingle()

  if (existingRow?.id) {
    const { data, error } = await supabase
      .from('price_alerts')
      .update({ target_price: payload.target_price, status: 'active' })
      .eq('id', existingRow.id)
      .select(ALERT_SELECT)
      .single()
    if (error) throw new Error(error.message)
    return data as unknown as PriceAlert
  }

  const { data, error } = await supabase
    .from('price_alerts')
    .insert(payload)
    .select(ALERT_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return data as unknown as PriceAlert
}

export async function cancelPriceAlert(id: string): Promise<void> {
  if (isPreviewMode || !supabase) {
    const alert = demoStore.priceAlerts.find((item) => item.id === id)
    if (alert) alert.status = 'cancelled'
    return
  }
  const { error } = await supabase.from('price_alerts').update({ status: 'cancelled' }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deletePriceAlert(id: string): Promise<void> {
  if (isPreviewMode || !supabase) {
    const index = demoStore.priceAlerts.findIndex((item) => item.id === id)
    if (index >= 0) demoStore.priceAlerts.splice(index, 1)
    return
  }
  const { error } = await supabase.from('price_alerts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Does an active alert already exist for this station/charger/kind? */
export function findActiveAlert(
  alerts: PriceAlert[],
  stationId: string,
  chargerId: string | null,
  kind: PriceAlertKind,
) {
  return alerts.find(
    (alert) =>
      alert.status === 'active' &&
      alert.station_id === stationId &&
      (alert.charger_id ?? null) === chargerId &&
      alert.kind === kind,
  )
}
