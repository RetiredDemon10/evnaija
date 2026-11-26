import type { MechanicServiceMode, MechanicServiceType, MechanicStatus, ServiceRequestStatus } from '@/types'

export const MECHANIC_SERVICE_TYPES: { value: MechanicServiceType; label: string }[] = [
  { value: 'battery_diagnostics', label: 'Battery diagnostics' },
  { value: 'battery_repair', label: 'Battery repair' },
  { value: 'battery_replacement', label: 'Battery replacement' },
  { value: 'motor_repair', label: 'Motor repair' },
  { value: 'inverter_repair', label: 'Inverter & controller' },
  { value: 'charging_port_repair', label: 'Charging port repair' },
  { value: 'wiring_electrical', label: 'HV wiring & electrical' },
  { value: 'software_diagnostics', label: 'Software diagnostics' },
  { value: 'brakes', label: 'Brakes & suspension' },
  { value: 'hvac', label: 'Air conditioning' },
  { value: 'tyre_service', label: 'Tyres & wheels' },
  { value: 'general_service', label: 'General servicing' },
  { value: 'towing', label: 'EV recovery / towing' },
]

export const MECHANIC_MODE_OPTIONS: { value: MechanicServiceMode; label: string }[] = [
  { value: 'mobile', label: 'Mobile / on-site' },
  { value: 'workshop', label: 'Workshop visit' },
  { value: 'both', label: 'Mobile & workshop' },
]

export const MECHANIC_BRANDS = [
  'Tesla', 'BYD', 'Nissan Leaf', 'Hyundai Ioniq', 'Kia EV', 'MG EV',
  'Toyota Prius', 'Honda e', 'Audi e-tron', 'BMW i', 'Chery EQ', 'GAC Aion',
]

export const serviceTypeLabel = (value: MechanicServiceType) =>
  MECHANIC_SERVICE_TYPES.find((item) => item.value === value)?.label ?? value

export const serviceModeLabel = (value: MechanicServiceMode) =>
  MECHANIC_MODE_OPTIONS.find((item) => item.value === value)?.label ?? value

export const MECHANIC_STATUS_TONE: Record<MechanicStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
  suspended: 'danger',
}

export const REQUEST_STATUS_TONE: Record<ServiceRequestStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  new: 'info',
  contacted: 'warning',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
}
