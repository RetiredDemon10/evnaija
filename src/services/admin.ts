import type {
  AdminAuditLog,
  AdminStats,
  AdminTeamMember,
  AppNotification,
  Booking,
  Charger,
  CommissionSettings,
  FinancialLedgerEntry,
  Location,
  OperatorProfile,
  Payment,
  PayoutRequest,
  PlatformSetting,
  Profile,
  PromotionalListing,
  Refund,
  Review,
  Station,
  SubscriptionPlan,
  SupportTicket,
} from '@/types'
import { supabase } from '@/lib/supabase'
import { isPreviewMode } from '@/lib/env'
import { demoStore, getDemoAdminStats } from '@/data/demo'

export async function getAdminStats(): Promise<AdminStats> {
  if (isPreviewMode || !supabase) return getDemoAdminStats()
  const client = supabase
  const count = async (table: string, filter?: (q: ReturnType<typeof client.from>) => unknown) => {
    let query = client.from(table).select('*', { count: 'exact', head: true }) as never
    if (filter) query = filter(query) as never
    const { count: total } = await query
    return total ?? 0
  }
  const [customers, operators, stations, chargerRows, bookings, payouts] = await Promise.all([
    client.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
    count('operator_profiles'),
    count('stations'),
    client.from('chargers').select('id, connector_count'),
    client.from('bookings').select('*'),
    client.from('payout_requests').select('*').eq('status', 'pending'),
  ])
  const bookingRows = (bookings.data ?? []) as Booking[]
  const paid = bookingRows.filter((b) => b.payment_status === 'success')
  const months = new Map<string, { label: string; revenue: number; bookings: number }>()
  for (const booking of paid) {
    const date = new Date(booking.created_at)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    const label = date.toLocaleDateString('en-NG', { month: 'short' })
    const bucket = months.get(key) ?? { label, revenue: 0, bookings: 0 }
    bucket.revenue += booking.total_amount
    bucket.bookings += 1
    months.set(key, bucket)
  }
  return {
    totalCustomers: customers.count ?? 0,
    totalOperators: operators,
    totalStations: stations,
    totalChargingPoints: (chargerRows.data ?? []).reduce(
      (acc, c) => acc + ((c as { connector_count?: number }).connector_count ?? 1),
      0,
    ),
    activeBookings: bookingRows.filter((b) => ['confirmed', 'checked_in', 'in_progress'].includes(b.status)).length,
    completedBookings: bookingRows.filter((b) => b.status === 'completed').length,
    totalRevenue: paid.reduce((acc, b) => acc + b.total_amount, 0),
    totalCommission: paid.reduce((acc, b) => acc + b.platform_commission, 0),
    pendingOperators: (await client.from('operator_profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending')).count ?? 0,
    pendingPayouts: payouts.data?.length ?? 0,
    revenueSeries: Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([, value]) => value),
  }
}

export async function listCustomers(): Promise<Profile[]> {
  if (isPreviewMode || !supabase) return demoStore.customers
  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'customer')
  if (rolesError) throw rolesError
  const customerIds = (roles ?? []).map((row) => row.user_id)
  if (!customerIds.length) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('id', customerIds)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Profile[]
}

export async function setCustomerSuspended(userId: string, suspended: boolean, reason?: string) {
  if (isPreviewMode || !supabase) {
    const customer = demoStore.customers.find((c) => c.id === userId)
    if (customer) {
      customer.is_suspended = suspended
      customer.suspended_reason = reason ?? null
    }
    return
  }
  const { error } = await supabase.rpc('admin_set_user_suspended', {
    p_user_id: userId,
    p_suspended: suspended,
    p_reason: reason ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function listOperators(): Promise<OperatorProfile[]> {
  if (isPreviewMode || !supabase) return demoStore.operators
  const { data, error } = await supabase
    .from('operator_profiles')
    .select('*, stations(id)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as OperatorProfile[]
}

export async function setOperatorStatus(
  operatorId: string,
  status: OperatorProfile['status'],
  reason?: string,
) {
  if (isPreviewMode || !supabase) {
    const operator = demoStore.operators.find((o) => o.id === operatorId)
    if (operator) {
      operator.status = status
      operator.rejection_reason = reason ?? null
      operator.reviewed_at = new Date().toISOString()
    }
    return
  }
  const { error } = await supabase.rpc('admin_set_operator_status', {
    p_operator_id: operatorId,
    p_status: status,
    p_reason: reason ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function listAllStations(): Promise<Station[]> {
  if (isPreviewMode || !supabase) return demoStore.stations
  const { data, error } = await supabase
    .from('stations')
    .select('*, station_images(*), chargers(*, charger_connectors(*)), operator:operator_profiles(business_name, status, user_id)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Station[]
}

export async function setStationStatusAdmin(
  stationId: string,
  status: Station['status'],
  featured?: boolean,
) {
  if (isPreviewMode || !supabase) {
    const station = demoStore.stations.find((s) => s.id === stationId)
    if (station) {
      station.status = status
      if (featured !== undefined) station.is_featured = featured
    }
    return
  }
  const { error } = await supabase.rpc('admin_set_station_status', {
    p_station_id: stationId,
    p_status: status,
    p_featured: featured ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function setChargerStatusAdmin(chargerId: string, status: Charger['status']) {
  if (isPreviewMode || !supabase) {
    for (const station of demoStore.stations) {
      const charger = station.chargers.find((item) => item.id === chargerId)
      if (charger) charger.status = status
    }
    return
  }
  const { error } = await supabase.from('chargers').update({ status }).eq('id', chargerId)
  if (error) throw new Error(error.message)
}

export async function listAllBookings(): Promise<Booking[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.bookings.map((b) => ({
      ...b,
      station: demoStore.stations.find((s) => s.id === b.station_id),
      charger: demoStore.stations.flatMap((s) => s.chargers).find((c) => c.id === b.charger_id),
      customer: demoStore.customers.find((c) => c.id === b.customer_id),
    }))
  }
  const { data, error } = await supabase
    .from('bookings')
    .select('*, station:stations(name, city, address), charger:chargers(name), customer:profiles(full_name, email)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Booking[]
}

export async function listAllPayments(): Promise<Payment[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.payments.map((p) => ({
      ...p,
      booking: demoStore.bookings.find((b) => b.id === p.booking_id),
      customer: demoStore.customers.find((c) => c.id === p.customer_id),
    }))
  }
  const { data, error } = await supabase
    .from('payments')
    .select('*, booking:bookings(booking_reference, station:stations(name)), customer:profiles(full_name, email)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Payment[]
}

export async function listRefunds(): Promise<Refund[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.refunds.map((r) => ({
      ...r,
      booking: demoStore.bookings.find((b) => b.id === r.booking_id),
      payment: demoStore.payments.find((p) => p.id === r.payment_id),
    }))
  }
  const { data, error } = await supabase
    .from('refunds')
    .select('*, booking:bookings(booking_reference), payment:payments(reference, amount)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Refund[]
}

export async function listPayouts(): Promise<PayoutRequest[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.payouts.map((p) => ({
      ...p,
      operator: demoStore.operators.find((o) => o.id === p.operator_id),
      account: demoStore.payoutAccounts.find((a) => a.id === p.payout_account_id),
    }))
  }
  const { data, error } = await supabase
    .from('payout_requests')
    .select('*, operator:operator_profiles(*), account:payout_accounts(*)')
    .order('requested_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as PayoutRequest[]
}

export async function setPayoutStatus(
  payoutId: string,
  status: PayoutRequest['status'],
  notes?: string,
) {
  if (isPreviewMode || !supabase) {
    const payout = demoStore.payouts.find((p) => p.id === payoutId)
    if (payout) {
      payout.status = status
      payout.admin_notes = notes ?? null
      if (['paid', 'rejected'].includes(status)) payout.processed_at = new Date().toISOString()
    }
    return
  }
  const { error } = await supabase.rpc('admin_set_payout_status', {
    p_payout_id: payoutId,
    p_status: status,
    p_notes: notes ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function processPayoutRemote(payoutId: string) {
  if (isPreviewMode || !supabase) {
    const payout = demoStore.payouts.find((p) => p.id === payoutId)
    if (payout) {
      payout.status = 'paid'
      payout.processed_at = new Date().toISOString()
      payout.paystack_transfer_reference = `demo-transfer-${Date.now()}`
    }
    return
  }
  const { data, error } = await supabase.functions.invoke('operator-payout', {
    body: { payoutId },
  })
  if (error) throw new Error(error.message)
  if (!data?.success) throw new Error(data?.error ?? 'Payout transfer failed.')
  return data
}

export async function processRefundRemote(refundId: string) {
  if (isPreviewMode || !supabase) {
    const refund = demoStore.refunds.find((r) => r.id === refundId)
    if (refund) {
      refund.status = 'completed'
      refund.processed_at = new Date().toISOString()
    }
    return
  }
  const { data, error } = await supabase.functions.invoke('process-refund', {
    body: { refundId },
  })
  if (error) throw new Error(error.message)
  if (!data?.success) throw new Error(data?.error ?? 'Refund failed.')
  return data
}

export async function listCommissionSettings(): Promise<CommissionSettings> {
  if (isPreviewMode || !supabase) return demoStore.commissionSettings
  const { data, error } = await supabase.from('commission_settings').select('*').limit(1).single()
  if (error) throw error
  return data as CommissionSettings
}

export async function updateCommissionSettings(
  id: string,
  patch: Partial<CommissionSettings>,
): Promise<CommissionSettings> {
  if (isPreviewMode || !supabase) {
    Object.assign(demoStore.commissionSettings, patch, { updated_at: new Date().toISOString() })
    return demoStore.commissionSettings
  }
  const { data, error } = await supabase
    .from('commission_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as CommissionSettings
}

export async function listPlans(): Promise<SubscriptionPlan[]> {
  if (isPreviewMode || !supabase) return demoStore.subscriptionPlans
  const { data, error } = await supabase.from('subscription_plans').select('*').order('price_monthly')
  if (error) throw error
  return (data ?? []) as SubscriptionPlan[]
}

export async function updatePlan(id: string, patch: Partial<SubscriptionPlan>) {
  if (isPreviewMode || !supabase) {
    const plan = demoStore.subscriptionPlans.find((p) => p.id === id)
    if (plan) Object.assign(plan, patch)
    return
  }
  const { error } = await supabase.from('subscription_plans').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listPromotions(): Promise<PromotionalListing[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.promotionalListings.map((p) => ({
      ...p,
      station: demoStore.stations.find((s) => s.id === p.station_id),
    }))
  }
  const { data, error } = await supabase
    .from('promotional_listings')
    .select('*, station:stations(name, city)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as PromotionalListing[]
}

export async function setPromotionStatus(id: string, status: PromotionalListing['status']) {
  if (isPreviewMode || !supabase) {
    const promo = demoStore.promotionalListings.find((p) => p.id === id)
    if (promo) promo.status = status
    return
  }
  const { error } = await supabase.from('promotional_listings').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listAllReviewsAdmin(): Promise<Review[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.reviews.map((r) => ({
      ...r,
      station: demoStore.stations.find((s) => s.id === r.station_id),
      customer: demoStore.customers.find((c) => c.id === r.customer_id),
    }))
  }
  const { data, error } = await supabase
    .from('reviews')
    .select('*, station:stations(name, city), customer:profiles(full_name, email)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Review[]
}

export async function listSupportTickets(): Promise<SupportTicket[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.supportTickets.map((t) => ({
      ...t,
      user: demoStore.customers.find((c) => c.id === t.user_id),
    }))
  }
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*, user:profiles(full_name, email), messages:support_messages(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as SupportTicket[]
}

export async function updateTicketStatus(id: string, status: SupportTicket['status']) {
  if (isPreviewMode || !supabase) {
    const ticket = demoStore.supportTickets.find((t) => t.id === id)
    if (ticket) ticket.status = status
    return
  }
  const { error } = await supabase.from('support_tickets').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listLocations(): Promise<Location[]> {
  if (isPreviewMode || !supabase) return demoStore.locations
  const { data, error } = await supabase.from('locations').select('*').order('state')
  if (error) throw error
  return (data ?? []) as Location[]
}

export async function saveLocation(location: Partial<Location> & { id?: string }) {
  if (isPreviewMode || !supabase) {
    if (location.id) {
      const existing = demoStore.locations.find((l) => l.id === location.id)
      if (existing) Object.assign(existing, location)
      return
    }
    demoStore.locations.push({
      id: `loc-${Date.now()}`,
      state: location.state ?? '',
      city: location.city ?? '',
      slug: location.slug ?? '',
      latitude: location.latitude ?? 0,
      longitude: location.longitude ?? 0,
      is_active: location.is_active ?? true,
      hero_image_url: location.hero_image_url ?? null,
    })
    return
  }
  const { id, ...payload } = location
  const { error } = id
    ? await supabase.from('locations').update(payload).eq('id', id)
    : await supabase.from('locations').insert(payload)
  if (error) throw new Error(error.message)
}

export async function listPlatformSettings(): Promise<PlatformSetting[]> {
  if (isPreviewMode || !supabase) return demoStore.platformSettings
  const { data, error } = await supabase.from('platform_settings').select('*').order('key')
  if (error) throw error
  return (data ?? []) as PlatformSetting[]
}

export async function savePlatformSetting(key: string, value: Record<string, unknown>, description?: string) {
  if (isPreviewMode || !supabase) {
    const setting = demoStore.platformSettings.find((s) => s.key === key)
    if (setting) {
      setting.value = value
      setting.updated_at = new Date().toISOString()
    } else {
      demoStore.platformSettings.push({
        key,
        value,
        description: description ?? null,
        updated_at: new Date().toISOString(),
      })
    }
    return
  }
  const { error } = await supabase
    .from('platform_settings')
    .upsert(
      { key, value, description: description ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )
  if (error) throw new Error(error.message)
}

export async function listAdminUsers(): Promise<AdminTeamMember[]> {
  if (isPreviewMode || !supabase) {
    return [
      ...demoStore.admins.map((profile) => ({ ...profile, role: 'admin' as const })),
      ...demoStore.operators.map((operator) => ({
        id: operator.user_id,
        full_name: operator.owner_name,
        email: operator.email,
        phone: operator.phone,
        avatar_url: operator.logo_url,
        home_address: null,
        preferred_city: null,
        preferred_state: null,
        is_suspended: operator.status === 'suspended',
        created_at: operator.created_at,
        role: 'operator' as const,
      })),
    ]
  }
  const { data, error } = await supabase
    .from('user_roles')
    .select('role, user:profiles(*)')
    .in('role', ['admin', 'operator'])
  if (error) throw error
  return (data ?? []).map((row) => {
    const record = row as unknown as { role: AdminTeamMember['role']; user: Profile }
    return { ...record.user, role: record.role }
  })
}

export async function listAuditLogs(): Promise<AdminAuditLog[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.auditLogs.map((l) => ({
      ...l,
      admin: demoStore.admins.find((a) => a.id === l.admin_id),
    }))
  }
  const { data, error } = await supabase
    .from('admin_audit_logs')
    .select('*, admin:profiles(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as unknown as AdminAuditLog[]
}

export async function broadcastNotification(input: {
  audience: 'all' | 'customers' | 'operators'
  title: string
  message: string
  link?: string
  type?: AppNotification['type']
}): Promise<{ recipients: number }> {
  if (isPreviewMode || !supabase) {
    const recipients: string[] =
      input.audience === 'customers'
        ? demoStore.customers.map((profile) => profile.id)
        : input.audience === 'operators'
          ? demoStore.operators.map((profile) => profile.user_id)
          : [
              ...demoStore.customers.map((profile) => profile.id),
              ...demoStore.operators.map((profile) => profile.user_id),
              ...demoStore.admins.map((profile) => profile.id),
            ]
    for (const userId of recipients) {
      demoStore.notifications.unshift({
        id: `ntf-${Date.now()}-${userId}`,
        user_id: userId,
        title: input.title,
        message: input.message,
        type: input.type ?? 'system',
        is_read: false,
        link: input.link ?? null,
        created_at: new Date().toISOString(),
      })
    }
    return { recipients: recipients.length }
  }
  const { data, error } = await supabase.functions.invoke('send-notification', {
    body: input,
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return { recipients: data?.recipients ?? 0 }
}

export async function listLedger(): Promise<FinancialLedgerEntry[]> {
  if (isPreviewMode || !supabase) {
    return [...demoStore.ledger].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  }
  const { data, error } = await supabase
    .from('financial_ledger')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error
  return (data ?? []) as FinancialLedgerEntry[]
}

export async function writeAuditLog(
  adminId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  if (isPreviewMode || !supabase) {
    demoStore.auditLogs.unshift({
      id: `log-${Date.now()}`,
      admin_id: adminId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      created_at: new Date().toISOString(),
    })
    return
  }
  await supabase.from('admin_audit_logs').insert({
    admin_id: adminId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  })
}
