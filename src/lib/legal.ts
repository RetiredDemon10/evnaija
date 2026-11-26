/**
 * Canonical list of published legal documents. Both the footer and the legal
 * page render from this list so a link can never point at a document that
 * does not exist. `npm run legal:check` guards this contract in CI.
 */
export const LEGAL_DOC_LINKS = [
  { slug: 'terms', label: 'Terms of Service' },
  { slug: 'privacy', label: 'Privacy Policy' },
  { slug: 'refunds', label: 'Refund Policy' },
  { slug: 'cancellation', label: 'Cancellation Policy' },
  { slug: 'cookies', label: 'Cookie Policy' },
] as const

export type LegalDocSlug = (typeof LEGAL_DOC_LINKS)[number]['slug']

export const LEGAL_DOC_SLUGS = LEGAL_DOC_LINKS.map((doc) => doc.slug) as LegalDocSlug[]

export function isLegalDoc(value: string | undefined): value is LegalDocSlug {
  return Boolean(value && (LEGAL_DOC_SLUGS as readonly string[]).includes(value))
}
