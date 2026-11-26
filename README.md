# EV Naija

**Power your journey. Charge without limits.**

EV Naija is a production-oriented Nigerian EV charging marketplace: a public discovery site, a customer booking portal, an operator workspace and an administrator control room. Drivers find verified stations, reserve a charger, pay through Paystack and check in with a QR code. Operators manage stations, chargers, availability, bookings, reviews and payouts. Administrators verify operators, moderate the marketplace, control commission and settle refunds and payouts.

The repository includes the React application, a complete Supabase schema with RLS and RPCs, server-side Paystack edge functions, seed configuration, tests and deployment documentation.

---

## Product surfaces

| Surface | Routes | Purpose |
| --- | --- | --- |
| Public site | `/`, `/stations`, `/stations/:slug`, `/how-it-works`, `/for-operators`, `/about`, `/contact`, `/legal/:doc` | Discovery, station detail, operator recruitment, policies |
| Authentication | `/login`, `/register`, `/register/operator`, `/forgot-password`, `/reset-password`, `/verify-email` | Supabase auth, operator application |
| Customer portal | `/app/*` | Dashboard, station booking, bookings, payments, vehicles, saved stations, reviews, notifications, support, profile |
| Operator portal | `/operator/*` | Overview, stations, chargers, availability, bookings, customers, revenue, transactions, payouts, reviews, notifications, support, business profile |
| Admin portal | `/admin/*` | Customers, operators, verification, stations, chargers, bookings, payments, transactions, refunds, payouts, commission, reviews, notifications, support, promotions, locations, content, settings, users, audit log |
| Payment callback | `/payment/callback`, `/app/payments/callback` | Verifies the Paystack transaction server-side |

Access is enforced by `ProtectedShell` plus database RLS. A customer cannot open `/operator` or `/admin` by editing the URL.

## Location data and search

The homepage hero uses a state-first selector: choosing a state loads that state's cities from `src/data/nigeria-states-cities.json` — all 36 states plus the FCT, each with its capital and major cities and towns. The chosen state and city are passed to `/stations` as `state` and `city` query params, and the station filter bar exposes the same dependent state → city pair. `src/lib/nigeria.ts` exposes the typed helpers (`NIGERIA_STATE_NAMES`, `citiesForState`, `stateForCity`, `capitalForState`, `stateLabel`).

## Stack

- React 18, TypeScript, Vite
- Tailwind CSS, Framer Motion, Lucide
- React Router, React Hook Form, Zod, TanStack Query
- Supabase Postgres, Auth, Storage, Realtime and Edge Functions
- Paystack transactions, refunds and transfers
- MapLibre GL with a no-token OpenStreetMap raster fallback
- Bricolage Grotesque (display), Onest (body), JetBrains Mono (labels/figures) — self-hosted in `public/fonts`

## Brand

Typography, colour, logo, motion and voice rules are documented in [`docs/BRAND.md`](docs/BRAND.md). Typefaces are self-hosted under `public/fonts` and can be refreshed with `node scripts/fetch-fonts.mjs`.

The homepage hero plays a self-hosted, muted background film — `public/videos/hero-arrive.mp4` cross-fading into `hero-charge.mp4` (arrive → charge), with `hero-poster.jpg` as the poster. `HeroVideo` degrades to the poster image under `prefers-reduced-motion`, Save-Data, or playback errors, and the clips are long-cached via `/videos/*` headers.

## Preview mode vs production mode

The app has two deliberate modes:

1. **Preview mode** (automatic when Supabase env vars are missing, or `VITE_DEMO_MODE=true`) renders the complete interface against a labelled fixture dataset. A persistent banner states that sample data is in use. Live Paystack writes are disabled. Booking checkout remains `pending_payment`; it never fakes a successful payment.
2. **Production mode** (Supabase URL and anon key present, demo mode off) uses real Supabase Auth, tables, RLS, RPCs, Storage and Edge Functions. Dashboard values are queried from the database; there are no hardcoded live statistics or fake bookings.

Preview demo accounts:

| Role | Email | Password |
| --- | --- | --- |
| Customer | `adaeze@evnaija.ng` | `Demo1234!` |
| Operator | `emeka@greendrive.ng` | `Demo1234!` |
| Administrator | `admin@evnaija.ng` | `Demo1234!` |

These accounts exist **only in the preview fixture store**. They are not created by `seed.sql` and are not production credentials.

## Quick start in preview mode

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. With no `.env.local`, the app starts in preview mode. This is the fastest way to review the design and all portals.

## Full local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Create a project at [supabase.com](https://supabase.com). Copy the project URL and anon key. Never put the service role key in a `VITE_` variable.

### 3. Configure the frontend

```bash
cp .env.example .env.local
```

Set:

```dotenv
VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_ANON_KEY"
VITE_APP_URL="http://localhost:5173"
VITE_PAYSTACK_PUBLIC_KEY="pk_test_..."
VITE_DEMO_MODE="false"
```

`VITE_PAYSTACK_PUBLIC_KEY` is available for client-side display/readiness checks; Paystack initialisation, verification, refunds and transfers all happen server-side with the secret key.

### 4. Apply the database

Using the Supabase CLI from the repository root:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Or run each file in `supabase/migrations/` in filename order in the SQL editor, then run `supabase/seed.sql`.

Migrations:

| Migration | Contents |
| --- | --- |
| `20260101000000_extensions_and_enums.sql` | Extensions and domain enums |
| `20260101000100_core_tables.sql` | Profiles, roles, vehicles, operators, documents, locations |
| `20260101000200_marketplace_tables.sql` | Stations, chargers, availability, bookings, reviews, favourites, notifications |
| `20260101000300_finance_tables.sql` | Payments, webhooks, refunds, payout accounts/requests, ledger, commission, subscriptions, promotions |
| `20260101000400_support_content_tables.sql` | Support, audit and platform settings |
| `20260101000500_functions_triggers.sql` | Auth provisioning, protected fields, counts, ratings, updated_at triggers |
| `20260101000600_rls_policies.sql` | RLS on every table and anonymous column grants |
| `20260101000700_rpcs.sql` | Availability, booking lifecycle, payouts, admin actions, public review RPCs |
| `20260101000800_storage.sql` | `avatars`, `station-images`, `operator-documents` buckets and object policies |
| `20260101000900_settlement_rpcs.sql` | Service-role-only atomic payment, refund and payout settlement |

`supabase/seed.sql` is idempotent and seeds homepage content, booking settings, commission defaults, launch locations and subscription plans.

### 5. Configure Auth URLs

In Supabase Dashboard → Authentication → URL Configuration:

- Site URL: `http://localhost:5173` locally, your production origin in production.
- Redirect URLs: `http://localhost:5173/login`, `http://localhost:5173/payment/callback`, `http://localhost:5173/reset-password`, and the production equivalents.

Email confirmation is handled by `/verify-email`. For production, configure SMTP in Supabase Auth.

### 6. Configure Edge Function secrets

Set these in Supabase Dashboard → Edge Functions → Secrets, or with the CLI:

```bash
npx supabase secrets set \
  PAYSTACK_SECRET_KEY=sk_test_... \
  APP_URL=http://localhost:5173 \
  SITE_URL=http://localhost:5173
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to deployed functions by Supabase. For `supabase functions serve`, pass them via `supabase/functions/.env` (never commit that file):

```dotenv
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=...
PAYSTACK_SECRET_KEY=sk_test_...
APP_URL=http://localhost:5173
```

### 7. Deploy Edge Functions

```bash
# Guest checkout: gateway JWT verification is off so signed-out guests can call
# these. Each function still validates user JWTs itself and authorises guests
# with a per-booking bearer token (see config.toml verify_jwt = false).
npx supabase functions deploy guest-booking --no-verify-jwt
npx supabase functions deploy initialize-payment --no-verify-jwt
npx supabase functions deploy verify-payment --no-verify-jwt
npx supabase functions deploy lookup-booking --no-verify-jwt

npx supabase functions deploy paystack-webhook --no-verify-jwt
npx supabase functions deploy process-refund
npx supabase functions deploy operator-payout
npx supabase functions deploy send-notification
```

`supabase/config.toml` marks `guest-booking`, `initialize-payment`, `verify-payment`, `lookup-booking` and `paystack-webhook` as `verify_jwt = false`. The first three validate user JWTs in-function and authorise guests by a per-booking token; `lookup-booking` is rate-limited by IP and its RPC requires the booking reference plus the guest token or email; the webhook authenticates with Paystack's HMAC signature.

### 8. Configure the Paystack webhook

Paystack Dashboard → Settings → API Keys & Webhooks → Webhook URL:

```text
https://YOUR_PROJECT.supabase.co/functions/v1/paystack-webhook
```

Subscribe at minimum to:

- `charge.success`
- `refund.pending`
- `refund.processed`
- `refund.failed`
- `transfer.success`
- `transfer.failed`

The webhook verifies `x-paystack-signature` with HMAC SHA-512 against the raw body. It records events in `payment_webhook_events`, deduplicates by event key and calls the settlement RPCs. Returned non-2xx responses make Paystack retry.

### 9. Create the first administrator

Never create an admin by editing the browser or self-assigning a role. Use the service-role script:

```bash
SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
ADMIN_EMAIL="admin@yourdomain.com" \
ADMIN_PASSWORD="a-long-unique-password" \
ADMIN_NAME="Your Name" \
npm run seed:admin
```

Or put the values in `.env.local` and run `npm run seed:admin`. The script creates/confirms the auth user, upserts the profile and grants the `admin` role. It does not print secrets. Sign in at `/login`, then open `/admin`.

### 10. Run

```bash
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Payments and money movement

The only code path that may mark a payment successful is `settle_payment`, a service-role-only SQL function called by `verify-payment` or `paystack-webhook` after Paystack verification. No browser or operator action can set `payment_status = 'success'` directly.

- `initialize-payment` validates ownership, checks the hold and asks Paystack for a checkout URL.
- `verify-payment` verifies the transaction with Paystack, then settles atomically.
- `paystack-webhook` verifies the signature and settles asynchronously.
- `process-refund` is admin-only, creates a Paystack refund and records it as processing. It cannot mark a refund complete unless Paystack says it is complete.
- `operator-payout` is admin-only. Payout approval and transfer are separate steps: `admin_set_payout_status` approves; `operator-payout` sends the Paystack transfer.
- Settlement writes double-entry-style ledger rows. Operator balance is the sum of credits minus debits for `operator_earning` and payout/refund debits.

Late payment is handled honestly: if Paystack confirms after the charger hold expired or the slot was taken, the payment is recorded and the booking is not confirmed. A refund is created in `pending` and the customer is notified.

## Waitlists, recurring plans and PWA

Three customer features share the booking flow:

- **Waitlist.** When a date is full, a signed-in driver can join the waitlist from the booking screen with an optional preferred start time. `join_waitlist` stores the request; a trigger marks matching entries `notified` and writes an in-app notification when a held or confirmed slot is cancelled or expires. The notification deep-links back to the booking screen with the charger and date preselected.
- **Recurring plans.** Toggling “Make it a recurring plan” on the booking screen creates the first held booking immediately through `create_booking_series`. Future sessions are never auto-held or auto-charged. From **My bookings**, “Book next session” calls `book_next_series_occurrence`, and “Stop plan” calls `cancel_booking_series`, which releases unpaid holds but leaves confirmed or paid bookings alone.
- **PWA.** A hand-written manifest and service worker (`public/manifest.webmanifest`, `public/sw.js`) make the app installable, cache the app shell and hashed assets, and serve `public/offline.html` when navigation fails. Device notifications are local reminders generated on-device while the app is open; remote push while the app is closed is intentionally not implemented.

Relevant schema is in `supabase/migrations/20260101001200_waitlist_and_recurring.sql`: `booking_series`, `waitlist_entries`, `bookings.series_id`, and the RPCs `create_booking_series`, `book_next_series_occurrence`, `cancel_booking_series`, `join_waitlist`, `leave_waitlist` and `next_booking_series_time`. See [`docs/SECURITY.md`](docs/SECURITY.md) for the authorisation model.

## Operational tasks

- **Expire stale holds.** `public.expire_stale_bookings()` marks unpaid holds expired and abandons pending payments. Schedule it every five minutes with `pg_cron` if your project has it; otherwise invoke it from a scheduled job using the service role. Booking creation also ignores expired holds even before this runs.
- **Payout accounts.** A Paystack recipient is created automatically when an admin sends the first transfer and the saved bank name matches Paystack's bank list. If matching fails, update the account to Paystack's exact bank name. OTP-enabled transfers return `otp_required`; complete Paystack's OTP flow before retrying.
- **Review moderation.** `review_moderation_required` in `platform_settings` can hide new reviews until an admin publishes them.
- **Content.** Homepage hero, announcement, footer and support/social links are stored in `platform_settings` and editable at `/admin/content`.
- **Commission and fees.** Edit at `/admin/commission`. The client-side quote mirrors the seeded defaults; the database recalculates the authoritative amount at booking creation.
- **Waitlist alerts.** Waitlist notifications are written by the `bookings_notify_waitlist` trigger when a booking moves to `cancelled` or `expired`. No cron job is required, but keep `expire_stale_bookings()` scheduled so expired holds actually fire the trigger.
- **Recurring plans.** Plans are customer-driven. There is no background job that creates future sessions; drivers reserve each next session with one tap from **My bookings**.
- **PWA releases.** Bump `VERSION` in `public/sw.js` when changing caching behaviour so clients pick up the new worker. `/sw.js` is served with `Cache-Control: no-store` by the deployment configs.

## Project layout

```text
ev-naija/
├── public/                     favicon, robots, sitemap, PWA manifest, service worker, offline page
├── scripts/create-admin.mjs     service-role admin bootstrap
├── src/
│   ├── components/             UI primitives, layouts, maps, PWA prompts, shared components
│   ├── contexts/               AuthContext and AuthLayout
│   ├── data/                   preview fixtures/store, Nigeria states & cities JSON
│   ├── hooks/                  platform content and query hooks
│   ├── lib/                    env, Supabase client, pricing, roles, fees, recurrence, pwa, utils
│   ├── pages/                  public, auth, customer, operator, admin
│   ├── services/               real Supabase data layer + preview branching
│   ├── test/                   unit tests
│   ├── types/                  canonical domain types
│   ├── App.tsx                 route tree
│   └── main.tsx
├── supabase/
│   ├── functions/              Paystack, refund, payout, notification edge functions
│   ├── migrations/             schema, triggers, RLS, RPCs, storage, settlement, waitlist/recurring
│   ├── config.toml             local Supabase configuration
│   └── seed.sql                baseline content/settings/locations/plans
├── docs/                       deployment, Supabase, Paystack, testing, admin guide, security, brand
├── .env.example
└── README.md
```

## Tests and checks

```bash
npm run typecheck
npm run test
npm run build
```

Tests cover the pricing mirror, role routing, date/booking helpers and recurring-plan helpers. Backend integration requires a Supabase project and Paystack test keys; see `docs/TESTING.md` for a full acceptance checklist. The waitlist and recurring RPCs are also smoke-tested against a PGlite instance during development.

## Deployment summary

1. Deploy the frontend to Vercel, Netlify or Cloudflare Pages.
2. Configure SPA fallback to `index.html`.
3. Keep the security headers from `vercel.json` / `netlify.toml`, and extend `connect-src` if you use a custom map style host.
4. Set frontend env vars and `VITE_APP_URL` to the production origin.
5. Push migrations and seed.
6. Deploy functions and set secrets.
7. Update Supabase Auth URLs and the Paystack webhook URL.
8. Create the first admin with `scripts/create-admin.mjs`.
9. Run the live checklist in `docs/TESTING.md` with Paystack test mode before switching keys.

Detailed instructions: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md), [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md), [`docs/PAYSTACK.md`](docs/PAYSTACK.md), [`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md), [`docs/TESTING.md`](docs/TESTING.md), [`docs/SECURITY.md`](docs/SECURITY.md), [`docs/LEGAL_COMPLIANCE.md`](docs/LEGAL_COMPLIANCE.md), [`docs/SEO.md`](docs/SEO.md).

Before taking live payments, work through [`docs/LEGAL_COMPLIANCE.md`](docs/LEGAL_COMPLIANCE.md) and run `npm run legal:check -- --strict`. It is an operational guide, not legal advice; have qualified Nigerian counsel review your launch.

For search visibility, set `VITE_SITE_URL` to your final HTTPS domain, follow [`docs/SEO.md`](docs/SEO.md) and run `npm run seo:check -- --strict`. No implementation can guarantee a #1 ranking; the guide covers verification and realistic measurement.

## Security notes

- RLS is enabled on all 33 public tables, including `booking_series` and `waitlist_entries`.
- Anonymous users can read approved stations, chargers, images, availability and public content only.
- Public reviews and testimonials are exposed through security-definer RPCs that omit reviewer email/phone.
- Anonymous direct reads of `operator_profiles` are restricted by column grants.
- Payment, refund and payout settlement functions are executable only by `service_role`.
- Service-role keys and Paystack secret keys are environment-only. They must never be committed or exposed through `VITE_` variables.
- The browser cannot change a user's role, suspension state, operator status, station moderation status or successful payment state.
- Support documents are stored in a private bucket; operator documents are readable only by the owning operator and administrators.
- Waitlist and recurring-plan writes go only through `security definer` RPCs; the tables have no direct write policies.
- New RPCs revoke `execute` from `public` and grant it only to `authenticated` and `service_role`.
- Production deployments ship a strict Content-Security-Policy plus HSTS, `nosniff`, `DENY` framing and a restrictive `Permissions-Policy` (see `vercel.json` / `netlify.toml`).
- The PWA service worker only caches same-origin assets and the app shell; notifications are local device reminders, not remote push.

The full model, CSP caveats and the hardening checklist live in [`docs/SECURITY.md`](docs/SECURITY.md).

## License

Proprietary — EV Naija. All rights reserved.
