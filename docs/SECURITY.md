# EV Naija security guide

This document describes the security model, the controls that are already implemented, and the hardening steps an operator must complete before handling real money. It is written for engineers deploying or maintaining EV Naija.

EV Naija assumes the browser is untrusted. Every privilege boundary is enforced in Postgres with Row Level Security (RLS) and `security definer` RPCs, or in Supabase Edge Functions that hold the `service_role` key. Client-side checks are treated as UX only.

---

## 1. Trust boundaries

| Layer | Trusted? | Notes |
| --- | --- | --- |
| Browser bundle | No | Anyone can modify it. Never authorise based on client state. |
| Supabase `anon` key | No | Public by design. Its power is limited entirely by RLS. |
| Authenticated JWT | Partly | Identity is trusted, but every request is still checked against RLS and RPC guards. |
| `service_role` key | Yes | Bypasses RLS. Lives only in Edge Function secrets. |
| Paystack secret key | Yes | Server-only. Verifies transactions and signs webhooks. |
| Postgres RLS + RPCs | Yes | The authoritative authorisation layer. |

## 2. Authentication and sessions

- Supabase Auth issues short-lived JWTs and refresh tokens. The frontend never sees the `service_role` key.
- Email confirmation and password reset are handled by Supabase. Production Auth URLs must be locked to the production origin and a small allow-list of preview origins.
- Passwords are validated client-side for UX and authoritatively by Supabase. Never log passwords, tokens or full JWTs.
- The app is single-tab safe: `ProtectedShell` blocks protected routes for signed-out users, and RLS blocks data access even if the route guard is bypassed.
- Admin and operator access requires a `user_roles` row. Roles cannot be changed from the browser; only a service-role script or an admin RPC can grant them.

### Recommended next steps

1. **Enable MFA/TOTP** for `operator` and `admin` accounts in the Supabase Auth dashboard. Document recovery codes out of band.
2. **Enable Auth rate limits** (sign-in, sign-up, password reset, OTP) in Supabase project settings. Add a CAPTCHA such as hCaptcha/Turnstile to the register and forgot-password forms if abuse appears.
3. **Shorten session lifetime** for admin accounts if Supabase exposes per-project settings for your plan.
4. **Add a login alert** notification on new-device sign-in (can reuse the `notifications` table plus an Edge Function).

## 3. Database authorisation (RLS and RPCs)

- RLS is enabled on every public table. Anonymous users can only read approved stations, active chargers, station images, availability and public content.
- Customers can only read and update rows they own (`auth.uid()`), and can never set their own role, suspension flag, operator status, station moderation status, booking status to `confirmed`, or payment status to `successful`.
- Operators can only read rows for stations they own (`current_operator_id()`).
- Admins can read and moderate marketplace rows through dedicated admin policies.
- Money movement (payment settlement, refunds, payouts) is restricted to `service_role` and the Edge Functions.
- Public reviews and testimonials are exposed through `security definer` RPCs that omit reviewer email and phone.
- The browser cannot write `platform_settings`, commission values, or successful payment state.

### Waitlist and recurring-plan security

Migration `20260101001200_waitlist_and_recurring.sql` adds two tables and six functions. The security properties are:

- `booking_series` and `waitlist_entries` have RLS enabled. Customers can only read their own rows; operators can read rows for their own stations; admins can read everything.
- No `insert`, `update` or `delete` policies exist for those tables, so all writes go through `security definer` RPCs.
- `join_waitlist` validates the station is approved, the charger belongs to the station and is active, and the date is not in the past. It reuses an existing `pending` or `notified` entry instead of creating duplicates, and caps a customer at 25 active waitlist requests.
- `create_booking_series` delegates the actual slot validation to `create_booking`, so station approval, availability, conflicts, operating hours, account suspension and the maximum-active-bookings rule are all still enforced. It also caps a customer at 10 active recurring plans.
- `book_next_series_occurrence` locks the series row (`for update`) and only the owning customer can advance it. It tracks the occurrence index separately from `bookings_created` so skipped sessions never inflate the count or complete a plan early.
- `cancel_booking_series` only releases unpaid `pending_payment` holds. Confirmed or paid bookings must be cancelled through the normal refund-aware flow.
- `leave_waitlist` only closes the caller's own entry (or an admin's).
- The waitlist release trigger runs as `security definer`, uses `for update skip locked`, and only notifies `pending` entries for the released date and station.
- `next_booking_series_time` is `immutable` and side-effect free.
- Every new function revokes `execute` from `public` and grants it only to `authenticated` and `service_role`.

### Other RPC guards to keep

- Booking creation rejects past starts, sessions longer than 12 hours, starts more than 60 days out, suspended accounts, inactive chargers and conflicting holds.
- `expire_stale_bookings()` must run on a schedule so unpaid holds do not block real drivers.
- Payment initialization is server-side and returns a Paystack `authorization_url`. The client never marks a booking paid.

## 4. Input handling and XSS

- React escapes rendered strings by default. Avoid `dangerouslySetInnerHTML`; if it is ever required, sanitize with a vetted library and a strict allow-list.
- Map popups build HTML strings. Those values are escaped before insertion. Keep it that way, or move to DOM nodes.
- Station slugs and IDs that appear in URLs are encoded. Reject unexpected shapes instead of trusting them.
- Validate and normalise all user input in the service layer with Zod schemas before it reaches Supabase.
- File uploads (avatars, station images, support documents) are size-limited and type-checked. Support and operator documents live in private Storage buckets with signed URLs.

## 5. Content Security Policy and browser headers

`vercel.json` and `netlify.toml` ship the same hardened header set:

| Header | Value / purpose |
| --- | --- |
| `Content-Security-Policy` | Restricts scripts, styles, frames, workers and connections to known origins. |
| `Strict-Transport-Security` | Forces HTTPS for two years, including subdomains. |
| `X-Content-Type-Options` | `nosniff` — stops MIME confusion attacks. |
| `X-Frame-Options` | `DENY` — blocks clickjacking (mirrors `frame-ancestors`). |
| `Referrer-Policy` | `strict-origin-when-cross-origin`. |
| `Permissions-Policy` | Disables geolocation, microphone, camera, USB and serial. |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` so the Paystack redirect/popup keeps working. |
| `Cache-Control` | Hashed `/assets/*` are immutable for a year; `/sw.js` is never cached. |
| `Service-Worker-Allowed` | Lets `/sw.js` control the whole origin. |

### CSP caveats

- **Map provider.** `connect-src` whitelists MapTiler, OpenFreeMap, CARTO and OpenStreetMap. If `VITE_MAPS_STYLE_URL` points at another host, add that host to `connect-src` and (for raster tiles) `img-src`, or the map will render blank.
- **Supabase.** `connect-src` uses `https://*.supabase.co` and `wss://*.supabase.co`. A custom domain or self-hosted Supabase needs to be added explicitly.
- **Paystack.** `script-src`, `frame-src` and `connect-src` include Paystack checkout hosts. If you enable a new Paystack product, re-check its required origins.
- **`style-src 'unsafe-inline'`** is required by MapLibre and React inline styles. It does not permit inline scripts.
- Test CSP in report-only mode first if you change the map or payment provider.

## 6. Progressive Web App and notifications

- The service worker is hand-written (`public/sw.js`) and only registers in production builds.
- It caches the app shell and hashed assets and serves `offline.html` when navigation fails. It never caches cross-origin API traffic and never caches `/sw.js` itself.
- Notification permission is requested only from the Profile page, after a clear explanation. Device notifications are **local reminders generated on the device while the app is open**; they are not remote push.
- Reminders contain a station name, a time and a deep link. They never contain payment credentials or full account details.
- Remote push (when the app is closed) requires a production push service and is intentionally out of scope for the current build.
- `manifest.webmanifest` and icons are public assets and contain no secrets.

## 7. Secrets and environment

- `VITE_*` variables are embedded in the browser bundle. Only the Supabase URL and anon key may live there.
- `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY` and webhook secrets exist only in Edge Function environment variables.
- Never commit `.env`, `.env.local` or service keys. Rotate keys immediately if one is exposed.
- The preview build never calls live Paystack and never fabricates a successful payment. It clearly labels sample data.

## 8. Payments and webhooks

- Payments are initialised server-side and verified with Paystack before a booking becomes `confirmed`.
- The Paystack webhook verifies the signature before trusting the payload, then reconciles by transaction reference. Webhook handling must be idempotent.
- Refunds and payouts are server-side only and audited in `admin_audit_log`.
- Never trust a client-supplied amount, currency, reference or booking status.

## 9. Operational hardening checklist

- [ ] RLS enabled on all public tables; new tables get policies in the same migration.
- [ ] All new `security definer` functions revoke `execute` from `public` and grant only to `authenticated` / `service_role`.
- [ ] `expire_stale_bookings()` scheduled every five minutes.
- [ ] Supabase Auth rate limits and CAPTCHA configured.
- [ ] MFA required for admin and operator accounts.
- [ ] CSP verified against the real map and Paystack origins.
- [ ] Storage buckets private unless intentionally public; signed URLs for private files.
- [ ] `service_role` and Paystack keys stored only in secret managers.
- [ ] Dependencies scanned (`npm audit`) and updated on a schedule.
- [ ] `docs/TESTING.md` acceptance checklist run against test keys before going live.

## 10. Reporting a vulnerability

Do not open a public issue for a security problem. Contact the maintainers privately with steps to reproduce, affected versions and any proof-of-concept. Do not access, modify or exfiltrate other users' data while testing.
