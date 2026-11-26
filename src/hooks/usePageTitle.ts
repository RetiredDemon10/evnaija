import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { BRAND, LEGAL_ENTITY } from '@/lib/constants'
import { isPreviewMode } from '@/lib/env'
import {
  absoluteUrl,
  assetUrl,
  formatTitle,
  getSeoRoute,
  OG_IMAGE,
  SITE_NAME,
  type SeoRoute,
} from '@/lib/seo'

export interface SeoOptions {
  title?: string
  description?: string
  image?: string
  type?: 'website' | 'article'
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
  noindex?: boolean
}

const JSON_LD_ID = 'evnaija-seo-jsonld'
const INDEXABLE_ROBOTS = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
const NOINDEX_ROBOTS = 'noindex,nofollow'

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  if (typeof document === 'undefined') return
  const selector = `meta[${attribute}="${key}"]`
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

function setCanonical(url: string) {
  if (typeof document === 'undefined') return
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', url)
}

function setJsonLd(graph: Record<string, unknown>[]) {
  if (typeof document === 'undefined') return
  document.getElementById(JSON_LD_ID)?.remove()
  const script = document.createElement('script')
  script.type = 'application/ld+json'
  script.id = JSON_LD_ID
  // Prevent a stray `</script>` in user-supplied content from breaking out.
  script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')
  document.head.appendChild(script)
}

function flattenJsonLd(value: SeoOptions['jsonLd']): Record<string, unknown>[] {
  if (!value) return []
  const entries = Array.isArray(value) ? value : [value]
  return entries.flatMap((entry) => {
    const nested = (entry as Record<string, unknown>)['@graph']
    if (Array.isArray(nested)) return nested as Record<string, unknown>[]
    return [entry]
  })
}

function buildOrganizationSchema() {
  const site = absoluteUrl('/')
  const schema: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': `${site}#organization`,
    name: SITE_NAME,
    url: site,
    logo: {
      '@type': 'ImageObject',
      '@id': `${site}#logo`,
      url: absoluteUrl('/icon-512.png'),
      width: 512,
      height: 512,
    },
    image: absoluteUrl(OG_IMAGE),
    email: BRAND.supportEmail,
    telephone: BRAND.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: BRAND.address,
      addressLocality: 'Lagos',
      addressRegion: 'Lagos',
      addressCountry: 'NG',
    },
  }
  // Only publish a legal name once a real registered identity is configured.
  if (LEGAL_ENTITY.registrationNumber) schema.legalName = LEGAL_ENTITY.name
  return schema
}

function buildWebSiteSchema() {
  const site = absoluteUrl('/')
  return {
    '@type': 'WebSite',
    '@id': `${site}#website`,
    url: site,
    name: SITE_NAME,
    publisher: { '@id': `${site}#organization` },
    inLanguage: 'en-NG',
  }
}

function buildBreadcrumbSchema(route: SeoRoute) {
  if (route.breadcrumbs.length < 2) return null
  return {
    '@type': 'BreadcrumbList',
    '@id': `${absoluteUrl(route.canonicalPath)}#breadcrumb`,
    itemListElement: route.breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      item: absoluteUrl(crumb.path),
    })),
  }
}

function socialImage(image?: string) {
  return assetUrl(image)
}

/**
 * Applies complete page metadata. All existing `usePageTitle` call sites keep
 * working; this hook resolves the route from the router so private pages are
 * noindexed automatically and public pages always have a canonical URL.
 */
export function useSeo(options: SeoOptions = {}) {
  const { pathname } = useLocation()
  const jsonLdKey = options.jsonLd ? JSON.stringify(options.jsonLd) : ''

  useEffect(() => {
    const route = getSeoRoute(pathname, options.title)
    const title = options.title ? formatTitle(options.title) : route.title
    const description = (options.description?.trim() || route.description).slice(0, 320)
    const canonical = absoluteUrl(route.canonicalPath || pathname)
    const image = socialImage(options.image)
    const noindex = route.noindex || options.noindex === true
    const type = options.type ?? route.type

    document.title = title
    setMeta('name', 'description', description)
    setMeta('name', 'robots', noindex ? NOINDEX_ROBOTS : INDEXABLE_ROBOTS)
    setCanonical(canonical)

    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:url', canonical)
    setMeta('property', 'og:type', type)
    setMeta('property', 'og:site_name', SITE_NAME)
    setMeta('property', 'og:locale', 'en_NG')
    setMeta('property', 'og:image', image)
    setMeta('property', 'og:image:width', '1200')
    setMeta('property', 'og:image:height', '630')
    setMeta('property', 'og:image:alt', `${SITE_NAME} — EV charging and EV mechanics in Nigeria`)

    setMeta('name', 'twitter:card', 'summary_large_image')
    setMeta('name', 'twitter:title', title)
    setMeta('name', 'twitter:description', description)
    setMeta('name', 'twitter:image', image)
    setMeta('name', 'twitter:image:alt', `${SITE_NAME} — EV charging and EV mechanics in Nigeria`)

    const graph: Record<string, unknown>[] = [buildOrganizationSchema(), buildWebSiteSchema()]
    const breadcrumbs = buildBreadcrumbSchema(route)
    if (breadcrumbs) graph.push(breadcrumbs)

    // Preview fixtures must never produce entity or rating structured data.
    if (!isPreviewMode && options.jsonLd) graph.push(...flattenJsonLd(options.jsonLd))
    setJsonLd(graph)
  }, [pathname, options.title, options.description, options.image, options.type, options.noindex, jsonLdKey])
}

/** Backwards-compatible wrapper used by every page in the app. */
export function usePageTitle(title?: string, options: Omit<SeoOptions, 'title'> = {}) {
  useSeo({ ...options, title })
}
