import type { AppRole } from '@/types'

export function dashboardPath(roles: AppRole[]) {
  if (roles.includes('admin')) return '/admin'
  if (roles.includes('operator')) return '/operator'
  if (roles.includes('mechanic')) return '/mechanic'
  return '/app'
}

export function primaryRole(roles: AppRole[]): AppRole {
  if (roles.includes('admin')) return 'admin'
  if (roles.includes('operator')) return 'operator'
  if (roles.includes('mechanic')) return 'mechanic'
  return 'customer'
}
