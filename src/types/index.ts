export type AppRole = 'customer' | 'operator' | 'admin' | 'mechanic'
export type OperatorStatus = 'pending' | 'approved' | 'rejected' | 'suspended'
export type MechanicStatus = 'pending' | 'approved' | 'rejected' | 'suspended'
export type MechanicServiceMode = 'mobile' | 'workshop' | 'both'
export type MechanicServiceType =
  | 'battery_diagnostics'
  | 'battery_repair'
  | 'battery_replacement'
  | 'motor_repair'
  | 'inverter_repair'
  | 'charging_port_repair'
  | 'wiring_electrical'
  | 'software_diagnostics'
  | 'brakes'
  | 'hvac'
  | 'tyre_service'
  | 'general_service'
  | 'towing'
export type ServiceRequestStatus = 'new' | 'contacted' | 'in_progress' | 'completed' | 'cancelled'
export type StationStatus = 'pending' | 'approved' | 'rejected' | 'suspended'
export type ChargerStatus = 'available' | 'reserved' | 'charging' | 'offline' | 'maintenance'
export type ConnectorType = 'type2' | 'ccs2' | 'chademo' | 'gbt'
export type ChargingSpeed = 'slow' | 'fast' | 'rapid' | 'ultra'
export type BookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'refunded'
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'abandoned' | 'reversed'
export type PaymentChannel = 'card' | 'bank_transfer' | 'ussd' | 'mobile_money' | 'wallet' | 'paystack'
export type PayoutStatus = 'pending' | 'approved' | 'processing' | 'paid' | 'rejected'
export type DocumentType =
  | 'business_registration'
  | 'identification'
  | 'proof_of_ownership'
  | 'station_photo'
export type ReviewStatus = 'published' | 'reported' | 'hidden'
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed'
export type SubscriptionTier = 'starter' | 'professional' | 'enterprise'
export type WaitlistStatus = 'pending' | 'notified' | 'converted' | 'cancelled'
export type BookingFrequency = 'weekly' | 'biweekly' | 'monthly'
export type BookingSeriesStatus = 'active' | 'paused' | 'completed' | 'cancelled'
export type LoyaltyTier = 'bronze' | 'silver' | 'gold'
export type LoyaltyEntryType = 'earn' | 'redeem' | 'bonus' | 'referral'
export type ReferralStatus = 'invited' | 'joined' | 'rewarded' | 'expired'
export type PriceAlertKind = 'price_drop' | 'availability'
export type PriceAlertStatus = 'active' | 'triggered' | 'cancelled'
export type NotificationChannel = 'email' | 'sms' | 'whatsapp'
export type NotificationDeliveryStatus = 'sent' | 'skipped' | 'failed'

export interface Profile {
  id: string
  full_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  home_address: string | null
  preferred_city: string | null
  preferred_state: string | null
  is_suspended: boolean
  suspended_reason?: string | null
  notification_preferences?: Record<string, boolean> | null
  referral_code?: string | null
  referred_by?: string | null
  is_guest?: boolean
  claimed_at?: string | null
  created_at: string
  updated_at?: string
}

export interface UserRole {
  id: string
  user_id: string
  role: AppRole
  created_at: string
}

export interface Vehicle {
  id: string
  user_id: string
  manufacturer: string
  model: string
  year: number
  registration_number: string | null
  battery_capacity_kwh: number
  connector_type: ConnectorType
  is_primary: boolean
  created_at: string
}

export interface OperatorProfile {
  id: string
  user_id: string
  business_name: string
  owner_name: string
  email: string
  phone: string
  business_address: string
  business_registration_number: string | null
  business_description: string | null
  logo_url: string | null
  status: OperatorStatus
  rejection_reason: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface OperatorDocument {
  id: string
  operator_id: string
  document_type: DocumentType
  file_url: string
  file_name: string
  status: 'pending' | 'verified' | 'rejected'
  notes: string | null
  created_at: string
}

export interface StationImage {
  id: string
  station_id: string
  image_url: string
  alt_text: string | null
  is_cover: boolean
  sort_order: number
}

export interface Charger {
  id: string
  station_id: string
  name: string
  charger_code: string
  connector_type: ConnectorType
  capacity_kw: number
  speed_category: ChargingSpeed
  connector_count: number
  price_per_kwh: number
  booking_fee: number
  status: ChargerStatus
  is_active: boolean
  created_at: string
  updated_at?: string
  connectors?: ChargerConnector[]
}

export interface ChargerConnector {
  id: string
  charger_id: string
  connector_number: number
  connector_type: ConnectorType
  status: ChargerStatus
}

export interface ChargerAvailability {
  id: string
  charger_id: string
  day_of_week: number
  opens_at: string
  closes_at: string
  is_closed: boolean
}

export interface Station {
  id: string
  operator_id: string
  name: string
  slug: string
  description: string | null
  state: string
  city: string
  address: string
  latitude: number
  longitude: number
  google_maps_url: string | null
  contact_phone: string | null
  contact_email: string | null
  operating_hours: string
  amenities: string[]
  status: StationStatus
  is_featured: boolean
  rating_average: number
  rating_count: number
  total_chargers: number
  available_chargers: number
  images: StationImage[]
  chargers: Charger[]
  operator?: OperatorProfile
  distance_km?: number
  created_at: string
  updated_at?: string
}

export interface Mechanic {
  id: string
  user_id: string
  business_name: string
  owner_name: string
  email: string
  phone: string
  whatsapp: string | null
  state: string
  city: string
  address: string
  latitude: number
  longitude: number
  service_modes: MechanicServiceMode[]
  service_types: MechanicServiceType[]
  brands_supported: string[]
  years_experience: number
  certifications: string[]
  description: string | null
  emergency_available: boolean
  hourly_rate: number | null
  callout_fee: number | null
  operating_hours: string
  logo_url: string | null
  status: MechanicStatus
  is_verified: boolean
  is_featured: boolean
  rating_average: number
  rating_count: number
  rejection_reason: string | null
  reviewed_at: string | null
  created_at: string
  updated_at?: string
}

export interface MechanicFilters {
  search?: string
  state?: string
  city?: string
  serviceType?: MechanicServiceType | 'all'
  mode?: MechanicServiceMode | 'all'
  minRating?: number
  emergencyOnly?: boolean
  sort?: 'recommended' | 'rating' | 'experience' | 'rate'
}

export interface MechanicServiceRequest {
  id: string
  reference: string
  mechanic_id: string
  customer_id: string | null
  name: string
  email: string
  phone: string
  vehicle_make: string
  vehicle_model: string
  issue_description: string
  preferred_date: string | null
  service_mode: MechanicServiceMode
  status: ServiceRequestStatus
  mechanic_notes: string | null
  created_at: string
  updated_at?: string
  mechanic?: Mechanic
}

export interface WaitlistEntry {
  id: string
  user_id: string
  station_id: string
  charger_id: string | null
  desired_date: string
  preferred_start: string | null
  status: WaitlistStatus
  notified_at: string | null
  created_at: string
  updated_at?: string
  station?: Station
  charger?: Charger | null
}

export interface BookingSeries {
  id: string
  customer_id: string
  station_id: string
  charger_id: string
  vehicle_id: string | null
  frequency: BookingFrequency
  duration_minutes: number
  start_time: string
  next_start_time: string
  occurrences: number
  bookings_created: number
  status: BookingSeriesStatus
  created_at: string
  updated_at?: string
  station?: Station
  charger?: Charger
  vehicle?: Vehicle | null
}

export interface Booking {
  id: string
  booking_reference: string
  customer_id: string
  station_id: string
  charger_id: string
  vehicle_id: string | null
  series_id?: string | null
  start_time: string
  end_time: string
  duration_minutes: number
  energy_kwh: number
  charging_fee: number
  booking_fee: number
  service_fee: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  platform_commission: number
  operator_earning: number
  status: BookingStatus
  payment_status: PaymentStatus
  qr_code: string
  hold_expires_at: string | null
  is_guest?: boolean
  guest_email?: string | null
  cancellation_reason: string | null
  cancelled_at: string | null
  checked_in_at: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  station?: Station
  charger?: Charger
  vehicle?: Vehicle
  customer?: Profile
  payment?: Payment
  series?: BookingSeries | null
  review?: Review | null
}

export interface BookingStatusHistory {
  id: string
  booking_id: string
  status: BookingStatus
  notes: string | null
  changed_by: string | null
  created_at: string
}

export interface Payment {
  id: string
  booking_id: string
  customer_id: string
  reference: string
  paystack_reference: string | null
  amount: number
  currency: string
  status: PaymentStatus
  channel: PaymentChannel | null
  gateway_response: string | null
  paid_at: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  booking?: Booking
  customer?: Profile
}

export interface PaymentWebhookEvent {
  id: string
  event_id: string
  event_type: string
  payload: Record<string, unknown>
  processed: boolean
  processed_at: string | null
  created_at: string
}

export interface Refund {
  id: string
  payment_id: string
  booking_id: string
  amount: number
  reason: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  paystack_refund_reference: string | null
  requested_by: string
  processed_by: string | null
  created_at: string
  processed_at: string | null
  booking?: Booking
  payment?: Payment
}

export interface Review {
  id: string
  booking_id: string
  station_id: string
  customer_id: string
  overall_rating: number
  charging_experience: number
  equipment_condition: number
  customer_service: number
  location_accessibility: number
  comment: string | null
  photos: string[]
  status: ReviewStatus
  is_verified: boolean
  report_reason: string | null
  created_at: string
  customer?: Profile
  response?: ReviewResponse | null
  station?: Station
}

export interface ReviewResponse {
  id: string
  review_id: string
  operator_id: string
  response: string
  created_at: string
}

export interface Favorite {
  id: string
  user_id: string
  station_id: string
  created_at: string
  station?: Station
}

export interface AppNotification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'booking' | 'payment' | 'account' | 'system' | 'review' | 'payout'
  is_read: boolean
  link: string | null
  created_at: string
}

export interface PayoutAccount {
  id: string
  operator_id: string
  bank_name: string
  account_name: string
  account_number: string
  recipient_code: string | null
  is_default: boolean
  created_at: string
}

export interface PayoutRequest {
  id: string
  operator_id: string
  payout_account_id: string
  amount: number
  status: PayoutStatus
  notes: string | null
  admin_notes: string | null
  paystack_transfer_reference: string | null
  requested_at: string
  processed_at: string | null
  operator?: OperatorProfile
  account?: PayoutAccount
}

export interface FinancialLedgerEntry {
  id: string
  booking_id: string | null
  payout_id: string | null
  operator_id: string | null
  entry_type:
    | 'booking_payment'
    | 'platform_commission'
    | 'operator_earning'
    | 'service_fee'
    | 'tax'
    | 'refund'
    | 'payout'
    | 'subscription'
    | 'promotion'
  amount: number
  direction: 'credit' | 'debit'
  description: string
  created_at: string
}

export interface CommissionSettings {
  id: string
  global_commission_percent: number
  service_fee_amount: number
  vat_percent: number
  minimum_payout_amount: number
  updated_at: string
  updated_by: string | null
}

export interface SubscriptionPlan {
  id: string
  tier: SubscriptionTier
  name: string
  price_monthly: number
  max_stations: number
  features: string[]
  is_active: boolean
}

export interface OperatorSubscription {
  id: string
  operator_id: string
  plan_id: string
  status: 'active' | 'cancelled' | 'expired'
  starts_at: string
  ends_at: string
  plan?: SubscriptionPlan
}

export interface PromotionalListing {
  id: string
  station_id: string
  operator_id: string
  amount: number
  starts_at: string
  ends_at: string
  status: 'pending' | 'active' | 'expired' | 'rejected'
  placement: 'homepage' | 'search' | 'both'
  created_at: string
  station?: Station
}

export interface SupportTicket {
  id: string
  user_id: string
  subject: string
  category: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: TicketStatus
  created_at: string
  updated_at: string
  messages?: SupportMessage[]
  user?: Profile
}

export interface SupportMessage {
  id: string
  ticket_id: string
  sender_id: string
  message: string
  is_staff: boolean
  created_at: string
}

export interface Location {
  id: string
  state: string
  city: string
  slug: string
  latitude: number
  longitude: number
  is_active: boolean
  hero_image_url: string | null
}

export interface AdminTeamMember extends Profile {
  role: AppRole
}

export interface AdminAuditLog {
  id: string
  admin_id: string
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, unknown> | null
  created_at: string
  admin?: Profile
}

export interface PlatformSetting {
  key: string
  value: Record<string, unknown>
  description: string | null
  updated_at: string
}

export interface DashboardStats {
  totalBookings: number
  upcomingBookings: number
  completedSessions: number
  totalSpent: number
  savedStations?: number
  vehicles?: number
}

export interface OperatorStats {
  totalStations: number
  totalChargingPoints: number
  availableChargers: number
  activeBookings: number
  todayBookings: number
  completedSessions: number
  totalRevenue: number
  pendingPayouts: number
  grossRevenue: number
  commission: number
  netEarnings: number
}

export interface AdminStats {
  totalCustomers: number
  totalOperators: number
  totalStations: number
  totalChargingPoints: number
  activeBookings: number
  completedBookings: number
  totalRevenue: number
  totalCommission: number
  pendingOperators: number
  pendingPayouts: number
  revenueSeries: { label: string; revenue: number; bookings: number }[]
}

export interface StationFilters {
  search?: string
  city?: string
  state?: string
  connector?: ConnectorType | 'all'
  speed?: ChargingSpeed | 'all'
  availableOnly?: boolean
  minRating?: number
  maxPrice?: number
  sort?: 'recommended' | 'price_asc' | 'price_desc' | 'rating' | 'distance'
}

export interface LoyaltyAccount {
  id: string
  user_id: string
  points: number
  lifetime_points: number
  tier: LoyaltyTier
  credit_balance: number
  created_at: string
  updated_at: string
}

export interface LoyaltyTransaction {
  id: string
  user_id: string
  points: number
  type: LoyaltyEntryType
  description: string
  booking_id: string | null
  created_at: string
}

export interface Referral {
  id: string
  referrer_id: string
  referee_id: string | null
  code: string
  status: ReferralStatus
  referrer_points: number
  referee_points: number
  created_at: string
  converted_at: string | null
  referee?: Profile | null
}

export interface PriceAlert {
  id: string
  user_id: string
  station_id: string
  charger_id: string | null
  kind: PriceAlertKind
  target_price: number | null
  status: PriceAlertStatus
  last_notified_at: string | null
  created_at: string
  updated_at?: string
  station?: Station
  charger?: Charger | null
}

export interface NotificationLogEntry {
  id: string
  user_id: string
  channel: NotificationChannel
  title: string
  status: NotificationDeliveryStatus
  provider: string | null
  error: string | null
  created_at: string
}
