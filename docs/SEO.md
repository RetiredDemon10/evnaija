# EV Naija SEO guide

## Read this first

No implementation can guarantee a number-one search position. Rankings depend on competition, content quality, links, search demand, site speed, user signals and constant iteration. This guide describes the strongest technical and content foundation we can ship and how to verify it. Beware of any consultant who promises a guaranteed rank.

The goal is to make every useful page discoverable, unambiguous and fast, then measure and improve it in Google Search Console.

## What is implemented

- **Per-route metadata** — title, description, canonical URL, `robots`, Open Graph and Twitter tags are resolved centrally from `src/lib/seo.ts` and applied by `src/hooks/usePageTitle.ts` on every route.
- **Correct indexing boundaries** — public pages are `index,follow`; portals, auth flows, checkout and booking pages are `noindex,nofollow`. `/register/mechanic` is intentionally public.
- **Canonical control** — query-string filters such as `/stations?state=Lagos` canonicalise to `/stations`, preventing duplicate-page dilution.
- **Structured data** — a JSON-LD graph with `Organization`, `WebSite` and `BreadcrumbList` on every page; `FAQPage` on `/how-it-works`; real-data-only `LocalBusiness` schema on station details and `AutoRepair` schema on mechanic details.
- **No fake rich-result data** — preview fixtures never emit entity or rating schema. Ratings are published only when real reviews/ratings exist and the listing is approved and verified.
- **Sitemap and robots** — `public/sitemap.xml` lists all indexable static pages; `public/robots.txt` blocks private areas and references the sitemap.
- **Performance foundations** — self-hosted fonts, route-level code splitting, lazy map engine, lazy hero video and a pre-paint splash. See `docs/DEPLOYMENT.md` for hosting/cache configuration.
- **Automated guardrails** — `npm run seo:check` verifies the contract; `--strict` fails when production site identity is missing.

## Launch checklist

1. **Set the canonical domain.**
   Add the final HTTPS origin to every deployment environment:

   ```env
   VITE_SITE_URL="https://your-real-domain.com"
   ```

   The default is `https://evnaija.ng`. If you deploy on a different domain, also update:
   - `index.html` — `<link rel="canonical">`, `og:url`, title and description defaults
   - `public/sitemap.xml` — every `<loc>` and `<lastmod>`
   - `public/robots.txt` — the `Sitemap:` line

   Run `npm run seo:check -- --strict`. A preview or localhost origin must never become a canonical URL.

2. **Serve only HTTPS** with `www` or non-`www` consistently. Redirect the other variant with a 301. The domain in `VITE_SITE_URL`, sitemap, robots and canonical tags must match the redirect target exactly.

3. **Deploy the build** and confirm `npm run build` succeeds.

4. **Verify with Search Console.**
   - Add a **Domain property** for your real domain (covers HTTPS, HTTP, `www` and non-`www`).
   - Submit `https://your-domain/sitemap.xml` under **Sitemaps**.
   - Use **URL Inspection** on `/`, `/stations`, `/mechanics` and a real station detail page. Request indexing after confirming the canonical is correct.
   - Watch **Indexing → Pages** for excluded URLs. Private portals should show as blocked by robots or noindex, which is expected.

5. **Validate structured data.**
   - [Google Rich Results Test](https://search.google.com/test/rich-results)
   - [Schema.org Validator](https://validator.schema.org/)

   FAQ rich results are restricted by Google to limited site categories, but valid `FAQPage` markup is still useful context. Do not expect an FAQ accordion in search results.

6. **Measure speed and mobile quality.**
   - [PageSpeed Insights](https://pagespeed.web.dev/)
   - Chrome DevTools → Lighthouse
   - Search Console → **Core Web Vitals**

   Targets: LCP under 2.5s, INP under 200ms, CLS under 0.1. The map is lazy-loaded; do not preload it on the homepage.

7. **Finish the legal launch gate** in `docs/LEGAL_COMPLIANCE.md`. A fast site with missing policies or incomplete business identity will not earn durable trust.

## Verification commands

```bash
npm run seo:check
npm run seo:check -- --strict
npm run legal:check -- --strict
npm run typecheck
npm run test
npm run build
```

`seo:check -- --strict` fails until `VITE_SITE_URL` is set to a real HTTPS domain. `legal:check -- --strict` fails until real CAC/TIN/DPO values are configured.

## Structured data notes

### Global graph

`Organization` uses the public support email, phone and Lagos office address. `legalName` is added only after a real registered entity is configured through `VITE_LEGAL_ENTITY_NAME` and `VITE_LEGAL_RC_NUMBER`. This prevents publishing an unverified legal identity.

### Station detail pages

Station schema uses `LocalBusiness` with city/region, not the street address or geo coordinates. The exact pin and directions are deliberately revealed only after a paid, confirmed booking, so putting them in public JSON-LD would break that product rule. `aggregateRating` is emitted only when real reviews exist.

### Mechanic detail pages

Mechanic schema uses `AutoRepair` with the business address and geo area because the mechanic directory is a public local search surface. Contact details are behind a click in the UI but are not required for the schema. Ratings are emitted only for verified, approved mechanics with real rating counts.

### Preview mode

`isPreviewMode` suppresses all page/entity JSON-LD. Preview data exists to demonstrate the product, not to seed search results. Never run production with `VITE_DEMO_MODE=true`.

## Dynamic listings and the sitemap

The static sitemap covers the discovery hubs (`/stations`, `/mechanics`) and all evergreen pages. Individual station and mechanic records live in Supabase and are not listed in `public/sitemap.xml`.

Before scaling content, add a server-rendered `sitemap.xml` endpoint (or a build-time generated file) that includes only `status = 'approved'` stations and `status = 'approved' AND is_verified = true` mechanics, with accurate `lastmod` values. Do not add preview or unapproved records. Keep the static file as a fallback.

## Content plan that actually helps rankings

Search terms are competitive. Publish genuinely useful, accurate pages rather than thin keyword pages:

- **City guides** — “EV charging in Lagos”, “charging in Abuja”, “charging in Port Harcourt”, with real station coverage, connector availability and local practical advice.
- **Connector guides** — Type 2, CCS2, CHAdeMO and GB/T compatibility explanations tied to the filters the product already supports.
- **Cost guides** — how per-kWh pricing, booking fees, service fees and VAT work in Nigeria, using real values from pricing logic.
- **EV ownership guides** — battery care, charging at home vs public charging, what to check before a long trip.
- **Mechanic service guides** — battery diagnostics, charging-port repair, motor and inverter faults, mobile callouts.
- **Operator guides** — how to list a station, verification requirements, payouts and availability management.

Rules:

- One clear H1 per page, descriptive H2s and short paragraphs.
- Answer the searcher’s question in the first paragraph.
- Internal-link from guides to the relevant discovery page or real detail page.
- Use original images with descriptive `alt` text; never use muscle-car imagery for EV pages.
- Do not invent ratings, reviews, availability, prices or certifications.
- Update `lastmod` only when the content genuinely changes.
- Avoid keyword stuffing. Write for a Nigerian EV driver or workshop owner first.

## Local SEO

- Create a Google Business Profile only if the office is a real premises that legitimately serves visitors. Never create listings for virtual or demo locations.
- Keep name, address and phone identical on the site, Google Business Profile and any directories.
- Use the same support contact details returned by `platform_settings` in the footer.
- Encourage genuine reviews from real customers on appropriate platforms. Never buy reviews or publish fabricated testimonials.
- For station and mechanic listings, accuracy of service area, operating hours and verified status matters more than keyword repetition.

## What to monitor monthly

| Area | What to look for |
| --- | --- |
| Index coverage | Indexable pages actually indexed; no unexpected `noindex` |
| Queries | Impressions, clicks, CTR and average position by page |
| Canonicals | No alternate URLs or filter URLs chosen as canonical |
| Core Web Vitals | LCP, INP and CLS regressions after releases |
| Rich Results | Structured-data errors or warnings |
| Crawl stats | Spikes, blocked resources or slow server responses |
| Content | Pages with impressions but low CTR — rewrite titles/descriptions |

Rankings move over weeks and months. Improvements compound when accurate content, real internal links, fast pages and genuine user satisfaction work together.
