import type {
  Mechanic,
  MechanicFilters,
  MechanicServiceMode,
  MechanicServiceRequest,
  MechanicServiceType,
  ServiceRequestStatus,
} from '@/types'
import { supabase } from '@/lib/supabase'
import { isPreviewMode } from '@/lib/env'
import { demoStore } from '@/data/demo'

const MECHANIC_SELECT = '*'

export function filterMechanics(mechanics: Mechanic[], filters: MechanicFilters): Mechanic[] {
  const query = filters.search?.trim().toLowerCase()
  const filtered = mechanics.filter((mechanic) => {
    if (query) {
      const haystack = `${mechanic.business_name} ${mechanic.owner_name} ${mechanic.city} ${mechanic.state} ${mechanic.address} ${mechanic.service_types.join(' ')} ${mechanic.brands_supported.join(' ')}`.toLowerCase()
      if (!haystack.includes(query)) return false
    }
    if (filters.state && filters.state !== 'all' && mechanic.state !== filters.state) return false
    if (filters.city && filters.city !== 'all' && mechanic.city !== filters.city) return false
    if (filters.serviceType && filters.serviceType !== 'all' && !mechanic.service_types.includes(filters.serviceType)) return false
    if (filters.mode && filters.mode !== 'all' && !mechanic.service_modes.includes(filters.mode) && !mechanic.service_modes.includes('both')) return false
    if (filters.minRating && mechanic.rating_average < filters.minRating) return false
    if (filters.emergencyOnly && !mechanic.emergency_available) return false
    return true
  })

  const sort = filters.sort ?? 'recommended'
  return filtered.sort((a, b) => {
    switch (sort) {
      case 'rating': return b.rating_average - a.rating_average || b.rating_count - a.rating_count
      case 'experience': return b.years_experience - a.years_experience
      case 'rate': return (a.hourly_rate ?? Infinity) - (b.hourly_rate ?? Infinity)
      default: return Number(b.is_featured) - Number(a.is_featured) || Number(b.is_verified) - Number(a.is_verified) || b.rating_average - a.rating_average
    }
  })
}

export async function fetchMechanics(filters: MechanicFilters = {}): Promise<Mechanic[]> {
  if (isPreviewMode || !supabase) {
    return filterMechanics(demoStore.mechanics.filter((m) => m.status === 'approved'), filters)
  }
  let query = supabase
    .from('mechanic_profiles')
    .select(MECHANIC_SELECT)
    .eq('status', 'approved')
    .order('is_featured', { ascending: false })
    .order('rating_average', { ascending: false })

  if (filters.search) {
    query = query.or(`business_name.ilike.%${filters.search}%,city.ilike.%${filters.search}%,state.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
  }
  if (filters.state && filters.state !== 'all') query = query.eq('state', filters.state)
  if (filters.city && filters.city !== 'all') query = query.eq('city', filters.city)
  if (filters.serviceType && filters.serviceType !== 'all') query = query.contains('service_types', [filters.serviceType])
  if (filters.minRating) query = query.gte('rating_average', filters.minRating)
  if (filters.emergencyOnly) query = query.eq('emergency_available', true)

  const { data, error } = await query.range(0, 99)
  if (error) throw error
  return filterMechanics((data ?? []) as unknown as Mechanic[], filters)
}

export async function fetchFeaturedMechanics(limit = 3): Promise<Mechanic[]> {
  if (isPreviewMode || !supabase) {
    return demoStore.mechanics.filter((m) => m.status === 'approved' && m.is_featured).slice(0, limit)
  }
  const { data, error } = await supabase
    .from('mechanic_profiles')
    .select(MECHANIC_SELECT)
    .eq('status', 'approved')
    .eq('is_featured', true)
    .order('rating_average', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as Mechanic[]
}

export async function fetchMechanic(idOrSlug: string): Promise<Mechanic | null> {
  if (isPreviewMode || !supabase) {
    return demoStore.mechanics.find((m) => m.id === idOrSlug || m.business_name === idOrSlug) ?? null
  }
  const { data, error } = await supabase
    .from('mechanic_profiles')
    .select(MECHANIC_SELECT)
    .eq('id', idOrSlug)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as Mechanic) ?? null
}

export interface MechanicRegistrationInput {
  businessName: string
  ownerName: string
  email: string
  phone: string
  whatsapp: string
  state: string
  city: string
  address: string
  latitude: number
  longitude: number
  serviceModes: MechanicServiceMode[]
  serviceTypes: MechanicServiceType[]
  brandsSupported: string[]
  yearsExperience: number
  certifications: string[]
  description: string
  emergencyAvailable: boolean
  hourlyRate: number | null
  calloutFee: number | null
  operatingHours: string
  logoUrl: string
}

export async function registerMechanic(input: MechanicRegistrationInput): Promise<Mechanic> {
  if (isPreviewMode || !supabase) {
    // Preview users sign in as the demo mechanic, so attach new listings to that
    // identity to keep registration → portal → public page coherent locally.
    const existing = demoStore.mechanics.find((m) => m.user_id === 'mech-user-1')
    const mechanic: Mechanic = {
      id: existing?.id ?? `mech-${Date.now()}`,
      user_id: 'mech-user-1',
      business_name: input.businessName,
      owner_name: input.ownerName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      whatsapp: input.whatsapp || null,
      state: input.state,
      city: input.city,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      service_modes: input.serviceModes,
      service_types: input.serviceTypes,
      brands_supported: input.brandsSupported,
      years_experience: input.yearsExperience,
      certifications: input.certifications,
      description: input.description || null,
      emergency_available: input.emergencyAvailable,
      hourly_rate: input.hourlyRate,
      callout_fee: input.calloutFee,
      operating_hours: input.operatingHours,
      logo_url: input.logoUrl || null,
      status: 'pending',
      is_verified: false,
      is_featured: false,
      rating_average: 0,
      rating_count: 0,
      rejection_reason: null,
      reviewed_at: null,
      created_at: existing?.created_at ?? new Date().toISOString(),
    }
    if (existing) Object.assign(existing, mechanic)
    else demoStore.mechanics.unshift(mechanic)
    return mechanic
  }

  const { data, error } = await supabase.rpc('register_mechanic', {
    p_business_name: input.businessName,
    p_owner_name: input.ownerName,
    p_email: input.email,
    p_phone: input.phone,
    p_whatsapp: input.whatsapp,
    p_state: input.state,
    p_city: input.city,
    p_address: input.address,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_service_modes: input.serviceModes,
    p_service_types: input.serviceTypes,
    p_brands_supported: input.brandsSupported,
    p_years_experience: input.yearsExperience,
    p_certifications: input.certifications,
    p_description: input.description,
    p_emergency_available: input.emergencyAvailable,
    p_hourly_rate: input.hourlyRate,
    p_callout_fee: input.calloutFee,
    p_operating_hours: input.operatingHours,
    p_logo_url: input.logoUrl,
  })
  if (error) throw new Error(error.message)
  return data as Mechanic
}

export async function getMyMechanicProfile(userId?: string): Promise<Mechanic | null> {
  if (!userId) return null
  if (isPreviewMode || !supabase) {
    return demoStore.mechanics.find((m) => m.user_id === userId) ?? null
  }
  const { data, error } = await supabase
    .from('mechanic_profiles')
    .select(MECHANIC_SELECT)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as Mechanic) ?? null
}

export async function listAllMechanics(): Promise<Mechanic[]> {
  if (isPreviewMode || !supabase) return demoStore.mechanics
  const { data, error } = await supabase
    .from('mechanic_profiles')
    .select(MECHANIC_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Mechanic[]
}

export async function setMechanicStatusAdmin(
  mechanicId: string,
  status: Mechanic['status'],
  featured?: boolean,
  verified?: boolean,
  reason?: string,
): Promise<void> {
  if (isPreviewMode || !supabase) {
    const mechanic = demoStore.mechanics.find((m) => m.id === mechanicId)
    if (mechanic) {
      mechanic.status = status
      if (featured !== undefined) mechanic.is_featured = featured
      if (verified !== undefined) mechanic.is_verified = verified
      mechanic.rejection_reason = status === 'rejected' ? reason ?? null : null
    }
    return
  }
  const { error } = await supabase.rpc('admin_set_mechanic_status', {
    p_mechanic_id: mechanicId,
    p_status: status,
    p_featured: featured ?? null,
    p_verified: verified ?? null,
    p_reason: reason ?? null,
  })
  if (error) throw new Error(error.message)
}

export interface MechanicRequestInput {
  mechanicId: string
  name: string
  email: string
  phone: string
  vehicleMake: string
  vehicleModel: string
  issueDescription: string
  preferredDate: string | null
  serviceMode: MechanicServiceMode
}

export async function createMechanicRequest(input: MechanicRequestInput): Promise<string> {
  if (isPreviewMode || !supabase) {
    const reference = `MRN-${Math.random().toString(16).slice(2, 10).toUpperCase()}`
    demoStore.mechanicRequests.unshift({
      id: `mr-${Date.now()}`,
      reference,
      mechanic_id: input.mechanicId,
      customer_id: null,
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      vehicle_make: input.vehicleMake,
      vehicle_model: input.vehicleModel,
      issue_description: input.issueDescription,
      preferred_date: input.preferredDate,
      service_mode: input.serviceMode,
      status: 'new',
      mechanic_notes: null,
      created_at: new Date().toISOString(),
    })
    return reference
  }
  const { data, error } = await supabase.rpc('create_mechanic_service_request', {
    p_mechanic_id: input.mechanicId,
    p_name: input.name,
    p_email: input.email,
    p_phone: input.phone,
    p_vehicle_make: input.vehicleMake,
    p_vehicle_model: input.vehicleModel,
    p_issue_description: input.issueDescription,
    p_preferred_date: input.preferredDate,
    p_service_mode: input.serviceMode,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function listMechanicRequests(mechanicId?: string): Promise<MechanicServiceRequest[]> {
  if (isPreviewMode || !supabase) {
    return mechanicId
      ? demoStore.mechanicRequests.filter((request) => request.mechanic_id === mechanicId)
      : demoStore.mechanicRequests
  }
  let query = supabase
    .from('mechanic_service_requests')
    .select('*, mechanic:mechanic_profiles(business_name, city, state, owner_name)')
    .order('created_at', { ascending: false })
  if (mechanicId) query = query.eq('mechanic_id', mechanicId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as MechanicServiceRequest[]
}

export async function updateMechanicRequestStatus(
  requestId: string,
  status: ServiceRequestStatus,
  notes?: string,
): Promise<void> {
  if (isPreviewMode || !supabase) {
    const request = demoStore.mechanicRequests.find((item) => item.id === requestId)
    if (request) {
      request.status = status
      if (notes !== undefined) request.mechanic_notes = notes
    }
    return
  }
  const { error } = await supabase.rpc('update_mechanic_request_status', {
    p_request_id: requestId,
    p_status: status,
    p_notes: notes ?? null,
  })
  if (error) throw new Error(error.message)
}
