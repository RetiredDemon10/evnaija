import { describe, expect, it } from 'vitest'
import { isLegalDoc, LEGAL_DOC_LINKS, LEGAL_DOC_SLUGS } from '@/lib/legal'

describe('legal documents', () => {
  it('publishes every document the footer links to', () => {
    expect(LEGAL_DOC_SLUGS).toEqual(['terms', 'privacy', 'refunds', 'cancellation', 'cookies'])
    expect(new Set(LEGAL_DOC_SLUGS).size).toBe(LEGAL_DOC_LINKS.length)
  })

  it('resolves known slugs and rejects unknown ones', () => {
    expect(isLegalDoc('privacy')).toBe(true)
    expect(isLegalDoc('cancellation')).toBe(true)
    expect(isLegalDoc('terms-and-conditions')).toBe(false)
    expect(isLegalDoc(undefined)).toBe(false)
  })
})
