import { describe, expect, it } from 'vitest'
import { absoluteUrl, formatTitle, getSeoRoute, INDEXABLE_ROUTES } from '@/lib/seo'
import { LEGAL_DOC_LINKS } from '@/lib/legal'

describe('SEO routes', () => {
  it('keeps public discovery pages indexable with unique metadata', () => {
    const stations = getSeoRoute('/stations')
    const mechanics = getSeoRoute('/mechanics')

    expect(stations.noindex).toBe(false)
    expect(mechanics.noindex).toBe(false)
    expect(stations.title).not.toBe(mechanics.title)
    expect(stations.description).not.toBe(mechanics.description)
    expect(stations.canonicalPath).toBe('/stations')
  })

  it('does not confuse /mechanics with the private /mechanic portal', () => {
    expect(getSeoRoute('/mechanics').noindex).toBe(false)
    expect(getSeoRoute('/mechanic/listing').noindex).toBe(true)
    expect(getSeoRoute('/admin/bookings').noindex).toBe(true)
    expect(getSeoRoute('/app/stations').noindex).toBe(true)
  })

  it('treats only the mechanic registration page as an indexable auth route', () => {
    expect(getSeoRoute('/register/mechanic').noindex).toBe(false)
    expect(getSeoRoute('/register').noindex).toBe(true)
    expect(getSeoRoute('/register/operator').noindex).toBe(true)
    expect(getSeoRoute('/login').noindex).toBe(true)
  })

  it('publishes metadata for every legal document', () => {
    for (const doc of LEGAL_DOC_LINKS) {
      const route = getSeoRoute(`/legal/${doc.slug}`)
      expect(route.noindex).toBe(false)
      expect(route.title).toContain(doc.label)
      expect(route.description.length).toBeGreaterThan(40)
      expect(route.breadcrumbs.at(-1)?.label).toBe(doc.label)
    }
    expect(getSeoRoute('/legal/unknown').noindex).toBe(true)
  })

  it('uses page data for detail titles but never overrides the brand twice', () => {
    const station = getSeoRoute('/stations/marina-charge-hub', 'Marina Charge Hub')
    const mechanic = getSeoRoute('/mechanics/mech-1', 'VoltFix EV Workshop')

    expect(station.title).toBe('Marina Charge Hub — EV Naija')
    expect(mechanic.title).toBe('VoltFix EV Workshop — EV Naija')
    expect(formatTitle('Already EV Naija branded')).toBe('Already EV Naija branded')
  })

  it('strips query strings, hashes and trailing slashes from canonical paths', () => {
    expect(getSeoRoute('/stations?state=Lagos#results').canonicalPath).toBe('/stations')
    expect(getSeoRoute('/mechanics/').canonicalPath).toBe('/mechanics')
    expect(getSeoRoute('/').canonicalPath).toBe('/')
  })

  it('keeps static metadata within recommended lengths', () => {
    for (const path of INDEXABLE_ROUTES) {
      const route = getSeoRoute(path)
      expect(route.title.length, `${path} title`).toBeLessThanOrEqual(65)
      expect(route.description.length, `${path} description`).toBeLessThanOrEqual(165)
    }
  })

  it('builds canonical URLs from the configured production origin', () => {
    expect(absoluteUrl('/stations')).toBe('https://evnaija.ng/stations')
    expect(absoluteUrl('mechanics')).toBe('https://evnaija.ng/mechanics')
  })
})
