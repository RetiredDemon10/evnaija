import { describe, expect, it } from 'vitest'
import { dashboardPath, primaryRole } from '@/lib/roles'

describe('role routing', () => {
  it('sends customers to the customer portal', () => {
    expect(dashboardPath(['customer'])).toBe('/app')
    expect(primaryRole(['customer'])).toBe('customer')
  })

  it('sends operators to the operator workspace', () => {
    expect(dashboardPath(['operator'])).toBe('/operator')
    expect(primaryRole(['operator'])).toBe('operator')
  })

  it('sends mechanics to the workshop portal', () => {
    expect(dashboardPath(['mechanic'])).toBe('/mechanic')
    expect(primaryRole(['mechanic'])).toBe('mechanic')
  })

  it('gives administrators the highest-priority dashboard', () => {
    expect(dashboardPath(['customer', 'admin'])).toBe('/admin')
    expect(dashboardPath(['operator', 'admin'])).toBe('/admin')
    expect(primaryRole(['customer', 'operator', 'admin'])).toBe('admin')
  })
})
