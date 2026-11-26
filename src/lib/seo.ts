import { env } from '@/lib/env'
import { isLegalDoc, LEGAL_DOC_LINKS, type LegalDocSlug } from '@/lib/legal'

/**
 * Central SEO source of truth.
 *
 * Every route that uses `usePageTitle` (and therefore `useSeo`) gets its title,
 * description, canonical URL, social tags, robots directive and structured data
 * from here. `npm run seo:check` keeps this config in sync with the sitemap and
 * the static document head.
 */

export const SITE_NAME = 'EV Naija'
export const DEFAULT_TITLE = 'EV Naija — EV Charging Stations & EV Mechanics in Nigeria'
export const DEFAULT_DESCRIPTION =
  'Find verified EV charging stations across Lagos, Abuja and Port Harcourt, reserve a charger and connect with trusted EV mechanics across Nigeria.'
export const OG_IMAGE = '/og-image.jpg'

export interface SeoBreadcrumb {
  label: string
  path: string
}

export interface SeoRoute {
  title: string
  description: string
  canonicalPath: string
  type: 'website' | 'article'
  noindex: boolean
  breadcrumbs: SeoBreadcrumb[]
}

type StaticSeoPage = Pick<SeoRoute, 'title' | 'description'> & {
  type?: SeoRoute['type']
}

const NOINDEX_SEGMENTS = new Set([
  'app',
  'operator',
  'mechanic',
  'admin',
  'login',
  'register',
  'forgot-password',
  'reset-password',
  'verify-email',
  'payment',
  'book',
  'booking',
])

const CRUMB_LABELS: Record<string, string> = {
  stations: 'Charging stations',
  mechanics: 'EV mechanics',
  'how-it-works': 'How it works',
  'for-operators': 'For station owners',
  about: 'About',
  contact: 'Contact',
  'manage-booking': 'Manage booking',
  legal: 'Legal',
  'register': 'Register',
}

const LEGAL_DESCRIPTIONS: Record<LegalDocSlug, string> = {
  terms:
    'Read the EV Naija terms covering bookings, payments, station operators, EV mechanics, accounts and acceptable use.',
  privacy:
    'Learn how EV Naija collects, uses and protects your data under the Nigeria Data Protection Act 2023, including your rights and our DPO contact.',
  refunds:
    'Understand EV Naija refund rules for cancelled bookings, station faults, no-shows and mechanic service requests.',
  cancellation:
    'Learn how to cancel an EV charging booking or a mechanic service request and what timing and charges apply.',
  cookies: 'See which cookies and local storage EV Naija uses and how to manage your preferences.',
}

const ROUTES: Record<string, StaticSeoPage> = {
  '/': {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  '/stations': {
    title: 'Find EV Charging Stations in Nigeria — EV Naija',
    description:
      'Browse verified EV charging stations in Lagos, Abuja and Port Harcourt. Filter by connector and speed, check prices and reserve a slot.',
  },
  '/mechanics': {
    title: 'Find EV Mechanics in Nigeria — EV Naija',
    description:
      'Find verified EV mechanics for battery diagnostics, motor repairs, charging port fixes and mobile callouts across Nigeria.',
  },
  '/register/mechanic': {
    title: 'Register as an EV Mechanic — EV Naija',
    description:
      'Run an EV repair workshop? Create a verified EV Naija listing, manage your services and receive service requests from drivers.',
  },
  '/how-it-works': {
    title: 'How EV Naija Works — EV Naija',
    description:
      'See how EV Naija works: find a charger, reserve a slot, pay securely, charge with a QR code and track your bookings.',
  },
  '/for-operators': {
    title: 'List Your Charging Station — EV Naija',
    description:
      'List your charging station on EV Naija, reach verified drivers, manage availability and get paid through secure payouts.',
  },
  '/about': {
    title: 'About Us — EV Naija',
    description:
      'Learn about EV Naija, the Nigerian marketplace connecting EV drivers with verified charging stations and EV mechanics.',
  },
  '/contact': {
    title: 'Contact EV Naija — EV Naija',
    description:
      'Contact EV Naija for booking help, payment questions, station partnerships or feedback. We respond within one business day.',
  },
  '/manage-booking': {
    title: 'Manage Your Booking — EV Naija',
    description:
      'Look up an EV Naija booking with your reference and email or guest token to view status, payment and cancellation details.',
  },
}

const NOT_FOUND_ROUTE: StaticSeoPage = {
  title: 'Page Not Found — EV Naija',
  description: 'The page you requested could not be found. Browse EV charging stations and EV mechanics on EV Naija.',
}

/** Remove query strings, hashes and trailing slashes without touching the root. */
export function normalizePath(path: string): string {
  const raw = decodeURIComponent((path || '/').split(/[?#]/)[0] || '/')
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  if (withSlash.length > 1 && withSlash.endsWith('/')) return withSlash.replace(/\/+$/, '')
  return withSlash
}

/** Build the canonical absolute URL for a site-relative path. */
export function absoluteUrl(path = '/', origin = env.siteUrl): string {
  const cleanOrigin = (origin || 'https://evnaija.ng').trim().replace(/\/+$/, '')
  const safeOrigin = /^https?:\/\//i.test(cleanOrigin) ? cleanOrigin : 'https://evnaija.ng'
  return `${safeOrigin}${normalizePath(path)}`
}

/** Resolve a possibly-absolute asset URL without double-prefixing the origin. */
export function assetUrl(value?: string | null, fallback = OG_IMAGE): string {
  const trimmed = value?.trim()
  if (!trimmed) return absoluteUrl(fallback)
  return /^https?:\/\//i.test(trimmed) ? trimmed : absoluteUrl(trimmed)
}

/** Add the brand suffix once, including for callers that already supply it. */
export function formatTitle(title?: string): string {
  const trimmed = title?.trim()
  if (!trimmed) return DEFAULT_TITLE
  if (/\bEV Naija\b/i.test(trimmed)) return trimmed
  return `${trimmed} — ${SITE_NAME}`
}

function humanizeSlug(slug: string): string {
  return (
    decodeURIComponent(slug || '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim() || 'Details'
  )
}

function buildBreadcrumbs(path: string, leafLabel?: string): SeoBreadcrumb[] {
  const segments = path.split('/').filter(Boolean)
  const crumbs: SeoBreadcrumb[] = [{ label: 'Home', path: '/' }]
  let current = ''

  segments.forEach((segment, index) => {
    current += `/${segment}`
    const isLeaf = index === segments.length - 1
    const label = isLeaf && leafLabel ? leafLabel : CRUMB_LABELS[segment] ?? humanizeSlug(segment)
    crumbs.push({ label, path: current })
  })

  return crumbs
}

function buildRoute(path: string, page: StaticSeoPage, leafLabel?: string): SeoRoute {
  return {
    title: page.title,
    description: page.description,
    canonicalPath: path,
    type: page.type ?? 'website',
    noindex: false,
    breadcrumbs: path === '/' ? [] : buildBreadcrumbs(path, leafLabel),
  }
}

function noRoute(path: string): SeoRoute {
  return {
    ...buildRoute(path, NOT_FOUND_ROUTE),
    noindex: true,
  }
}

/**
 * Resolve metadata for a pathname. `titleOverride` is the value callers already
 * pass to `usePageTitle`, so legacy call sites keep working while detail pages
 * get accurate, data-driven titles.
 */
export function getSeoRoute(pathname: string, titleOverride?: string): SeoRoute {
  const path = normalizePath(pathname)

  const exact = ROUTES[path]
  if (exact) return buildRoute(path, exact)

  const segments = path.split('/').filter(Boolean)
  const rootSegment = segments[0] ?? ''

  // `/register/mechanic` is a public landing page; the other auth flows are not.
  if (rootSegment === 'register' && path !== '/register/mechanic') return noRoute(path)
  if (NOINDEX_SEGMENTS.has(rootSegment)) return noRoute(path)

  if (rootSegment === 'legal') {
    const slug = segments[1]
    if (slug && isLegalDoc(slug)) {
      const label = LEGAL_DOC_LINKS.find((doc) => doc.slug === slug)?.label ?? humanizeSlug(slug)
      return buildRoute(path, { title: formatTitle(label), description: LEGAL_DESCRIPTIONS[slug] }, label)
    }
    return noRoute(path)
  }

  if (rootSegment === 'stations' && segments[1]) {
    const name = titleOverride?.trim() || humanizeSlug(segments[1])
    return buildRoute(
      path,
      {
        title: formatTitle(name),
        description: `${name}: compare EV charger types, prices and availability, then reserve a charging slot on EV Naija.`,
      },
      name,
    )
  }

  if (rootSegment === 'mechanics' && segments[1]) {
    const name = titleOverride?.trim() || humanizeSlug(segments[1])
    return buildRoute(
      path,
      {
        title: formatTitle(name),
        description: `${name}: EV repair specialities, service areas and operating hours. Send a service request with no payment required.`,
      },
      name,
    )
  }

  return noRoute(path)
}

/** Indexable static routes; used by the sitemap guardrail. */
export const INDEXABLE_ROUTES = Object.keys(ROUTES)
