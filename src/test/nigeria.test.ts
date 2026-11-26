import { describe, expect, it } from 'vitest'
import {
  NIGERIA_STATES_CITIES,
  NIGERIA_STATE_NAMES,
  capitalForState,
  citiesForState,
  stateForCity,
  stateLabel,
} from '@/lib/nigeria'

describe('nigeria states and cities data', () => {
  it('lists all 36 states plus the FCT', () => {
    expect(NIGERIA_STATES_CITIES).toHaveLength(37)
    expect(NIGERIA_STATE_NAMES).toContain('Lagos')
    expect(NIGERIA_STATE_NAMES).toContain('FCT')
    expect(NIGERIA_STATE_NAMES).toContain('Rivers')
  })

  it('gives every state a capital and at least one city', () => {
    for (const entry of NIGERIA_STATES_CITIES) {
      expect(entry.capital.length).toBeGreaterThan(0)
      expect(entry.cities.length).toBeGreaterThan(0)
    }
  })

  it('returns the cities for a selected state', () => {
    expect(citiesForState('Lagos')).toContain('Lekki')
    expect(citiesForState('Rivers')).toContain('Port Harcourt')
    expect(citiesForState('FCT')).toContain('Abuja')
  })

  it('is case-insensitive and safe for unknown or empty input', () => {
    expect(citiesForState('lagos')).toContain('Ikeja')
    expect(citiesForState('Atlantis')).toEqual([])
    expect(citiesForState('')).toEqual([])
    expect(citiesForState(null)).toEqual([])
  })

  it('maps a city back to its state', () => {
    expect(stateForCity('Port Harcourt')).toBe('Rivers')
    expect(stateForCity('Abuja')).toBe('FCT')
    expect(stateForCity('Nowhere')).toBeNull()
  })

  it('exposes capitals and friendly labels', () => {
    expect(capitalForState('Lagos')).toBe('Ikeja')
    expect(stateLabel('FCT')).toBe('Abuja/FCT')
    expect(stateLabel('Oyo')).toBe('Oyo')
  })
})
