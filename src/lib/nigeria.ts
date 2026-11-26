import nigeriaStatesCities from '@/data/nigeria-states-cities.json'

export interface NigeriaStateCities {
  state: string
  capital: string
  cities: string[]
}

/**
 * Source of truth for the homepage hero state → city selector and the station
 * state filter. Backed by `src/data/nigeria-states-cities.json`, which lists all
 * 36 states plus the FCT and their major cities and towns.
 */
export const NIGERIA_STATES_CITIES = nigeriaStatesCities as NigeriaStateCities[]

/** All state names, in the same order as the JSON file. */
export const NIGERIA_STATE_NAMES: string[] = NIGERIA_STATES_CITIES.map((entry) => entry.state)

/** Human-friendly label, mapping the FCT to the more familiar "Abuja/FCT". */
export function stateLabel(state: string): string {
  return state === 'FCT' ? 'Abuja/FCT' : state
}

/** Cities for a state, case-insensitive. Returns an empty list when unknown. */
export function citiesForState(state: string | null | undefined): string[] {
  if (!state) return []
  const match = NIGERIA_STATES_CITIES.find(
    (entry) => entry.state.toLowerCase() === state.trim().toLowerCase(),
  )
  return match ? match.cities : []
}

/** Capital city for a state, or null when the state is unknown. */
export function capitalForState(state: string | null | undefined): string | null {
  if (!state) return null
  const match = NIGERIA_STATES_CITIES.find(
    (entry) => entry.state.toLowerCase() === state.trim().toLowerCase(),
  )
  return match ? match.capital : null
}

/** Find the state that a city belongs to, or null when unknown. Case-insensitive. */
export function stateForCity(city: string | null | undefined): string | null {
  if (!city) return null
  const target = city.trim().toLowerCase()
  const match = NIGERIA_STATES_CITIES.find((entry) =>
    entry.cities.some((candidate) => candidate.toLowerCase() === target),
  )
  return match ? match.state : null
}
