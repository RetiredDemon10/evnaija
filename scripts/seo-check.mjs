#!/usr/bin/env node
/**
 * SEO guardrails for EV Naija.
 *
 * This does not promise any particular ranking. It checks the technical
 * contract we control: every indexable route has metadata, canonical URLs use
 * the configured production origin, sitemap/robots agree with the app, social
 * defaults exist, and structured data is never built from preview fixtures.
 *
 * Usage:
 *   npm run seo:check                 # warnings do not fail preview builds
 *   npm run seo:check -- --strict     # fails on missing production site URL
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const strict = process.argv.includes('--strict')
const failures = []
const warnings = []

const read = (relative) => readFileSync(resolve(root, relative), 'utf8')

const seoModule = read('src/lib/seo.ts')
const hook = read('src/hooks/usePageTitle.ts')
const indexHtml = read('index.html')
const sitemap = read('public/sitemap.xml')
const robots = read('public/robots.txt')
const stationDetail = read('src/pages/public/StationDetailPage.tsx')
const mechanicDetail = read('src/pages/public/MechanicDetailPage.tsx')
const howItWorks = read('src/pages/public/HowItWorksPage.tsx')
const legalModule = read('src/lib/legal.ts')

// Static document head must be complete even for crawlers that do not run JS.
for (const [needle, message] of [
  ['<title>', 'index.html is missing a title'],
  ['name="description"', 'index.html is missing a meta description'],
  ['rel="canonical"', 'index.html is missing a canonical link'],
  ['name="robots"', 'index.html is missing a robots directive'],
  ['property="og:title"', 'index.html is missing og:title'],
  ['property="og:description"', 'index.html is missing og:description'],
  ['property="og:url"', 'index.html is missing og:url'],
  ['property="og:image"', 'index.html is missing og:image'],
  ['name="twitter:card"', 'index.html is missing twitter:card'],
]) {
  if (!indexHtml.includes(needle)) failures.push(message)
}

// Every page component must participate in route metadata.
const walkPages = (directory) =>
  readdirSync(directory).flatMap((entry) => {
    const full = resolve(directory, entry)
    return statSync(full).isDirectory() ? walkPages(full) : full.endsWith('.tsx') ? [full] : []
  })
for (const file of walkPages(resolve(root, 'src/pages'))) {
  const source = readFileSync(file, 'utf8')
  if (!source.includes('usePageTitle') && !source.includes('useSeo')) {
    failures.push(`${file.replace(`${root}/`, '')} does not apply route metadata`)
  }
}

// Dynamic head management must cover the full metadata set.
for (const [needle, message] of [
  ['useLocation()', 'SEO hook is not reading the current route'],
  ["setCanonical", 'SEO hook is not setting a canonical link'],
  ["'og:url'", 'SEO hook is not setting og:url'],
  ["'twitter:description'", 'SEO hook is not setting twitter:description'],
  ["'noindex,nofollow'", 'SEO hook cannot noindex private routes'],
  ['application/ld+json', 'SEO hook is not emitting JSON-LD'],
  ["'Organization'", 'SEO hook is missing Organization schema'],
  ["'WebSite'", 'SEO hook is missing WebSite schema'],
  ["'BreadcrumbList'", 'SEO hook is missing BreadcrumbList schema'],
  ['isPreviewMode', 'SEO hook does not guard preview fixtures out of JSON-LD'],
  ['route.noindex', 'SEO hook ignores route-level noindex rules'],
]) {
  if (!hook.includes(needle)) failures.push(message)
}

// Parse the static route config and keep it aligned with the sitemap.
const routesBlock = seoModule.match(/const ROUTES:[\s\S]*?= \{([\s\S]*?)\n\}/)
if (!routesBlock) {
  failures.push('src/lib/seo.ts: ROUTES could not be parsed.')
} else {
  const entries = [...routesBlock[1].matchAll(/^  '(\/[^']*)': \{([\s\S]*?)^  \},/gm)]
  const routes = entries.map(([, path, block]) => ({ path, block }))
  if (routes.length < 9) failures.push(`Expected at least 9 SEO routes, found ${routes.length}.`)

  const sitemapPaths = [...sitemap.matchAll(/<loc>https:\/\/evnaija\.ng([^<]*)<\/loc>/g)].map(
    (match) => match[1] || '/',
  )
  const sitemapSet = new Set(sitemapPaths)

  for (const { path, block } of routes) {
    if (!sitemapSet.has(path)) failures.push(`SEO route ${path} is missing from sitemap.xml`)

    const titleMatch = block.match(/title:\s*(?:DEFAULT_TITLE|'([^']*)')/)
    const descriptionMatch = block.match(/description:\s*(?:\n\s*)?(?:DEFAULT_DESCRIPTION|'([^']*)')/)
    const title = titleMatch?.[1]
    const description = descriptionMatch?.[1]
    if (!title && !block.includes('DEFAULT_TITLE')) failures.push(`SEO route ${path} has no title`)
    if (!description && !block.includes('DEFAULT_DESCRIPTION')) failures.push(`SEO route ${path} has no description`)
    if (title && title.length > 65) warnings.push(`SEO route ${path} title is ${title.length} chars (aim for 60 or fewer)`)
    if (description && description.length > 165) {
      warnings.push(`SEO route ${path} description is ${description.length} chars (aim for 160 or fewer)`)
    }
  }
}

// Domain consistency. The hook, static head, sitemap and robots must agree.
const envPath = resolve(root, '.env.local')
const env = {}
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/)
    if (match) env[match[1]] = match[2]
  }
}
const siteUrl = (env.VITE_SITE_URL ?? process.env.VITE_SITE_URL ?? 'https://evnaija.ng').trim().replace(/\/+$/, '')

if (!indexHtml.includes(`href="${siteUrl}/"`)) failures.push(`index.html canonical must use ${siteUrl}/`)
if (!sitemap.includes(siteUrl)) failures.push(`sitemap.xml must use the configured site URL ${siteUrl}`)
if (!robots.includes(`Sitemap: ${siteUrl}/sitemap.xml`)) failures.push(`robots.txt must reference ${siteUrl}/sitemap.xml`)

const siteUrlProblems = []
if (!env.VITE_SITE_URL && !process.env.VITE_SITE_URL) {
  siteUrlProblems.push('VITE_SITE_URL is not set; canonical URLs fall back to https://evnaija.ng.')
}
if (!/^https:\/\//i.test(siteUrl)) siteUrlProblems.push('VITE_SITE_URL must use HTTPS.')
if (/localhost|127\.0\.0\.1|example|your-domain/i.test(siteUrl)) {
  siteUrlProblems.push('VITE_SITE_URL must be your real production domain, not a local or placeholder value.')
}
for (const problem of siteUrlProblems) {
  (strict ? failures : warnings).push(`Canonical domain: ${problem}`)
}

if (!sitemap.trim().startsWith('<?xml') || !sitemap.includes('<urlset') || !sitemap.includes('</urlset>')) {
  failures.push('sitemap.xml is not well-formed XML')
}
for (const privatePath of ['/app/', '/book/', '/booking/', '/payment/', '/operator/', '/mechanic/', '/admin/']) {
  if (sitemap.includes(privatePath)) failures.push(`sitemap.xml must not include private path ${privatePath}`)
}

// The mechanic registration page is a public landing page; other register flows are not.
if (!sitemap.includes('/register/mechanic')) failures.push('sitemap.xml is missing /register/mechanic')
if (!robots.includes('Disallow: /register$')) failures.push('robots.txt should disallow /register but keep /register/mechanic public')
if (/^Disallow: \/register\/\s*$/m.test(robots)) failures.push('robots.txt must not disallow the public /register/mechanic page')

// Every published legal document must be discoverable.
const legalSlugs = [...legalModule.matchAll(/slug:\s*'([a-z-]+)'/g)].map((match) => match[1])
for (const slug of legalSlugs) {
  if (!sitemap.includes(`/legal/${slug}`)) failures.push(`sitemap.xml is missing /legal/${slug}`)
  if (!seoModule.includes('LEGAL_DESCRIPTIONS')) failures.push('SEO config is missing legal page descriptions')
}

// Entity structured data must come from real, approved data only.
for (const [needle, message] of [
  ['isPreviewMode', 'StationDetailPage can emit schema from preview fixtures'],
  ["status === 'approved'", 'StationDetailPage can emit schema for unapproved stations'],
  ["'LocalBusiness'", 'StationDetailPage is missing LocalBusiness schema'],
  ['reviews.length > 0', 'StationDetailPage can publish fake aggregate ratings'],
]) {
  if (!stationDetail.includes(needle)) failures.push(message)
}
for (const [needle, message] of [
  ['isPreviewMode', 'MechanicDetailPage can emit schema from preview fixtures'],
  ["status === 'approved'", 'MechanicDetailPage can emit schema for unapproved mechanics'],
  ['is_verified', 'MechanicDetailPage can emit schema for unverified mechanics'],
  ["'AutoRepair'", 'MechanicDetailPage is missing AutoRepair schema'],
  ['rating_count > 0', 'MechanicDetailPage can publish fake aggregate ratings'],
]) {
  if (!mechanicDetail.includes(needle)) failures.push(message)
}
if (!howItWorks.includes('FAQPage') || !howItWorks.includes('acceptedAnswer')) {
  failures.push('HowItWorksPage is missing FAQPage structured data')
}
if (!existsSync(resolve(root, 'public/og-image.jpg'))) failures.push('public/og-image.jpg is missing')

const print = (label, items) => {
  if (!items.length) return
  console.log(`\n${label}`)
  for (const item of items) console.log(`  - ${item}`)
}

console.log('EV Naija SEO guardrails')
console.log(`  canonical origin: ${siteUrl}`)
console.log(`  strict mode: ${strict ? 'on' : 'off'}`)
print('FAILURES', failures)
print('WARNINGS', warnings)

if (failures.length) {
  console.error(`\nSEO checks failed: ${failures.length} issue(s).`)
  process.exit(1)
}
if (warnings.length) {
  console.log(`\nPassed with ${warnings.length} pre-launch warning(s). Resolve these before deployment.`)
} else {
  console.log('\nAll SEO guardrails passed.')
}
