#!/usr/bin/env node
/**
 * Automated legal/compliance guardrails for EV Naija.
 *
 * This is not legal advice and does not certify regulatory compliance. It
 * checks the technical promises the app makes: every published legal document
 * resolves, consent gates exist, required disclosures are present, and the
 * registered entity is configured before launch.
 *
 * Usage:
 *   npm run legal:check           # warnings do not fail local/CI preview builds
 *   npm run legal:check -- --strict  # fails on missing registered-identity config
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const strict = process.argv.includes('--strict')
const failures = []
const warnings = []

const read = (relative) => readFileSync(resolve(root, relative), 'utf8')

const legalModule = read('src/lib/legal.ts')
const legalPage = read('src/pages/public/LegalPage.tsx')
const footer = read('src/components/layout/SiteFooter.tsx')
const sitemap = read('public/sitemap.xml')
const register = read('src/pages/auth/RegisterPage.tsx')
const registerOperator = read('src/pages/auth/RegisterOperatorPage.tsx')
const registerMechanic = read('src/pages/auth/RegisterMechanicPage.tsx')
const booking = read('src/pages/app/BookingPage.tsx')

const linksBlock = legalModule.match(/LEGAL_DOC_LINKS\s*=\s*\[([\s\S]*?)\]\s*as const/)
if (!linksBlock) failures.push('src/lib/legal.ts: LEGAL_DOC_LINKS could not be parsed.')
const slugs = linksBlock
  ? [...linksBlock[1].matchAll(/slug:\s*'([a-z-]+)'/g)].map((match) => match[1])
  : []

const requiredSlugs = ['terms', 'privacy', 'refunds', 'cancellation', 'cookies']
for (const slug of requiredSlugs) {
  if (!slugs.includes(slug)) failures.push(`Missing required legal document slug: ${slug}`)
}
if (new Set(slugs).size !== slugs.length) failures.push('Legal document slugs must be unique.')

// Every /legal/... link in the UI and sitemap must resolve to a published doc.
const scanLinks = (label, source) => {
  for (const [, slug] of source.matchAll(/\/legal\/([a-z-]+)/g)) {
    if (!slugs.includes(slug)) failures.push(`${label} links to unknown legal document: /legal/${slug}`)
  }
}
scanLinks('SiteFooter', footer)
scanLinks('BookingPage', booking)
scanLinks('RegisterMechanicPage', registerMechanic)
scanLinks('sitemap.xml', sitemap)

for (const slug of slugs) {
  if (!new RegExp(`^\\s{2}${slug}: \\{`, 'm').test(legalPage)) {
    failures.push(`LegalPage.tsx is missing content for: ${slug}`)
  }
  if (!sitemap.includes(`/legal/${slug}`)) failures.push(`sitemap.xml is missing /legal/${slug}`)
}

// Disclosures the published copy must keep making.
const requiredCopy = [
  ['Nigeria Data Protection Act 2023', 'Privacy Policy must cite the NDPA'],
  ['Nigeria Data Protection Regulation 2019', 'Privacy Policy must cite the NDPR'],
  ['independent contractors', 'Terms must disclose that mechanics are independent'],
  ['one-way hash', 'Privacy Policy must disclose token/hash handling'],
  ['Paystack', 'Terms must disclose the payment processor'],
  ['VAT', 'Terms must disclose that prices include VAT'],
  ['No system is perfectly secure', 'Privacy Policy must include a security caveat'],
  ['NDPC', 'Privacy Policy must name the regulator'],
  ['Smartsupp', 'Privacy/Cookie policy must disclose the live chat provider'],
]
for (const [needle, message] of requiredCopy) {
  if (!legalPage.includes(needle)) failures.push(message)
}

// Explicit acceptance gates for every path that collects personal data.
if (!/terms:\s*z\.literal\(true/.test(register)) failures.push('Customer registration lacks a required terms checkbox.')
if (!/terms:\s*z\.literal\(true/.test(registerOperator)) failures.push('Operator registration lacks a required terms checkbox.')
if (!registerMechanic.includes('acceptedTerms')) failures.push('Mechanic registration lacks a required terms acceptance gate.')
if (!booking.includes('guestAcceptedTerms')) failures.push('Guest checkout lacks a required terms acceptance gate.')

// No placeholder registration details may ship to production.
for (const file of [
  'src/components/layout/SiteFooter.tsx',
  'src/pages/public/LegalPage.tsx',
  'src/lib/constants.ts',
]) {
  if (read(file).includes('RC 0000000')) failures.push(`${file} still contains the placeholder RC number.`)
}

// Registered identity comes from environment variables at build time.
const env = {}
const envPath = resolve(root, '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/)
    if (match) env[match[1]] = match[2]
  }
}
const value = (key) => env[key] ?? process.env[key] ?? ''
const entityName = value('VITE_LEGAL_ENTITY_NAME')
const rcNumber = value('VITE_LEGAL_RC_NUMBER')
const tin = value('VITE_LEGAL_TIN')
const dpoEmail = value('VITE_LEGAL_DPO_EMAIL')

const identityProblems = []
if (!entityName || /your registered entity|ev naija technologies ltd/i.test(entityName)) {
  identityProblems.push('VITE_LEGAL_ENTITY_NAME must be your real CAC-registered entity name.')
}
if (!/^RC\s*\d{4,7}$/i.test(rcNumber) || /^RC\s*0+$/i.test(rcNumber)) {
  identityProblems.push('VITE_LEGAL_RC_NUMBER must be a real CAC registration number (e.g. RC 1234567).')
}
if (!/^\d{8,10}$/.test(tin)) identityProblems.push('VITE_LEGAL_TIN must be a valid Tax Identification Number.')
if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(dpoEmail)) identityProblems.push('VITE_LEGAL_DPO_EMAIL must be a valid email address.')

for (const problem of identityProblems) {
  (strict ? failures : warnings).push(`Registered identity: ${problem}`)
}

const print = (label, items) => {
  if (!items.length) return
  console.log(`\n${label}`)
  for (const item of items) console.log(`  - ${item}`)
}

console.log('EV Naija legal guardrails')
console.log(`  legal documents: ${slugs.join(', ') || 'none'}`)
console.log(`  strict mode: ${strict ? 'on' : 'off'}`)
print('FAILURES', failures)
print('WARNINGS', warnings)

if (failures.length) {
  console.error(`\nLegal checks failed: ${failures.length} issue(s).`)
  process.exit(1)
}

if (warnings.length) {
  console.log(`\nPassed with ${warnings.length} pre-launch warning(s). Resolve these before deployment.`)
} else {
  console.log('\nAll legal guardrails passed.')
}
