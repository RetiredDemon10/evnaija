import { describe, expect, it } from 'vitest'
import { durationLabel, formatNaira, humanize, initials, slugify } from '@/lib/utils'

describe('display helpers', () => {
  it('formats naira amounts with consistent decimal places', () => {
    expect(formatNaira(15675)).toContain('15,675')
    expect(formatNaira(58237.5)).toContain('58,237.50')
  })

  it('formats booking durations', () => {
    expect(durationLabel(30)).toBe('30 min')
    expect(durationLabel(60)).toBe('1h')
    expect(durationLabel(135)).toBe('2h 15m')
  })

  it('slugifies station names', () => {
    expect(slugify('Lekki Phase 1 — Hub')).toBe('lekki-phase-1-hub')
  })

  it('builds initials and human labels', () => {
    expect(initials('Adaeze Okafor')).toBe('AO')
    expect(humanize('pending_payment')).toBe('Pending Payment')
  })
})
