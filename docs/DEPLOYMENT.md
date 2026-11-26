# Deployment guide

This guide takes EV Naija from a local checkout to a production deployment with Supabase, Paystack and a static frontend host.

## 1. Pre-flight

- Node.js 20+ and npm installed.
- Supabase project created (production and, ideally, a separate staging project).
- Paystack business account verified and test keys available.
- A domain and DNS access (recommended: `evnaija.ng` and `www.evnaija.ng`).
- A CAC-registered entity, TIN, DPO contact and reviewed policies. Work through [`LEGAL_COMPLIANCE.md`](./LEGAL_COMPLIANCE.md) before taking live payments.
- No service-role or Paystack secret key in frontend files or repository history.

Run locally:

```bash
npm install
npm run typecheck
npm run test
npm run legal:check
npm run seo:check
npm run build
```

For a production release, run `npm run legal:check -- --strict` with the legal entity environment variables set, and `npm run seo:check -- --strict` with `VITE_SITE_URL` set to your real HTTPS domain. These gates fail the release if legal identity or canonical URL details are still placeholders. See [`LEGAL_COMPLIANCE.md`](./LEGAL_COMPLIANCE.md) and [`SEO.md`](./SEO.md).

## 2. Database

Link the production project and push migrations:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PRODUCTION_REF
npx supabase db push
```

Then run `supabase/seed.sql` if this is a fresh project. The seed is idempotent and does not overwrite existing platform content.

`20260101001700_mechanics.sql` adds the EV mechanic marketplace: `mechanic_profiles`, `mechanic_service_requests`, an `app_role` value of `mechanic`, RLS policies, the registration and moderation RPCs, and the anonymous service-request RPC with per-email rate limiting. Apply it before enabling the `/mechanics`, `/register/mechanic`, `/mechanic` or `/admin/mechanics` routes in production. It is forward-only and safe to push alongside the other migrations.

Verify in Supabase SQL Editor:

```sql
select count(*) from pg_tables where schemaname = 'public';
select key, value from public.platform_settings order by key;
select tier, name, price_monthly from public.subscription_plans order by price_monthly;
```

## 3. Edge Functions

Set production secrets:

```bash
npx supabase secrets set \
  PAYSTACK_SECRET_KEY=sk_live_or_test_... \
  APP_URL=https://evnaija.ng \
  SITE_URL=https://evnaija.ng
```

Deploy:

```bash
# These three accept signed-out guests, so gateway JWT verification is off.
# Each function validates user JWTs itself and authorises guests by a
# per-booking token. `supabase/config.toml` sets verify_jwt = false for them.
npx supabase functions deploy guest-booking --no-verify-jwt
npx supabase functions deploy initialize-payment --no-verify-jwt
npx supabase functions deploy verify-payment --no-verify-jwt
npx supabase functions deploy lookup-booking --no-verify-jwt

npx supabase functions deploy process-refund
npx supabase functions deploy operator-payout
npx supabase functions deploy send-notification
# Paystack signs the raw body; the function verifies that signature itself.
npx supabase functions deploy paystack-webhook --no-verify-jwt
```

Check logs after the first requests:

```bash
npx supabase functions logs paystack-webhook
npx supabase functions logs verify-payment
```

## 4. Auth configuration

Supabase Dashboard → Authentication → URL Configuration:

- **Site URL:** `https://evnaija.ng`
- **Redirect URLs:**
  - `https://evnaija.ng/login`
  - `https://evnaija.ng/payment/callback`
  - `https://evnaija.ng/reset-password`
  - `https://www.evnaija.ng/login` (if using `www`)

Configure a production SMTP provider for confirmation, reset and support emails. Supabase's default email service has strict limits and is not suitable for launch.

Recommended Auth hardening:

- Require email confirmation.
- Enable leaked-password protection.
- Set JWT expiry to 1 hour and enable refresh-token rotation.
- Add CAPTCHA if public signup is abused.

## 5. Frontend host

The app is a Vite SPA. Build command `npm run build`; output directory `dist`.

### Vercel

1. Import the repository.
2. Framework preset: Vite.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_URL=https://evnaija.ng`
   - `VITE_SITE_URL=https://evnaija.ng` (canonical origin for SEO; see [`SEO.md`](./SEO.md))
   - `VITE_PAYSTACK_PUBLIC_KEY`
   - `VITE_MAPS_STYLE_URL` / `VITE_MAPS_API_KEY` (optional)
   - `VITE_DEMO_MODE=false`
   - `VITE_LEGAL_ENTITY_NAME`, `VITE_LEGAL_RC_NUMBER`, `VITE_LEGAL_TIN`, `VITE_LEGAL_DPO_EMAIL` (see [`LEGAL_COMPLIANCE.md`](./LEGAL_COMPLIANCE.md))
6. Add an SPA rewrite so all paths serve `index.html`.

`vercel.json` example:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Netlify

Build command `npm run build`, publish directory `dist`, and:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Cloudflare Pages

Build command `npm run build`, output directory `dist`. Cloudflare handles SPA fallback when no matching asset exists, but confirm deep links such as `/admin/audit` resolve.

## 6. Paystack webhook

Paystack Dashboard → Settings → API Keys & Webhooks:

```text
https://YOUR_PROJECT.supabase.co/functions/v1/paystack-webhook
```

Enable at least `charge.success`, `refund.pending`, `refund.processed`, `refund.failed`, `transfer.success`, `transfer.failed`.

Use test mode first. Confirm `payment_webhook_events` rows appear with `processed = true`.

## 7. Administrator bootstrap

```bash
SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="..." \
ADMIN_EMAIL="admin@evnaija.ng" \
ADMIN_PASSWORD="strong-unique-password" \
ADMIN_NAME="EV Naija Admin" \
npm run seed:admin
```

Do not create production admins by inserting a role from the browser. The script uses the service role and confirms the auth user.

## 8. Custom domain

1. Add the domain in the frontend host.
2. Point DNS as instructed by the host.
3. Use `https://evnaija.ng` consistently in `VITE_APP_URL`, Supabase Auth and Paystack callbacks.
4. Update `public/sitemap.xml` and `public/robots.txt` if the domain changes.
5. Force HTTPS and redirect `www` to the canonical host.

## 9. Launch smoke test

- Open `/`, `/stations`, a station detail and `/for-operators` signed out.
- Register a customer, confirm email, sign in and reach `/app`.
- Register an operator, submit business details and confirm the application is pending.
- As admin, approve the operator and a station.
- As operator, add a charger and availability.
- As customer, create a booking and verify the Paystack test payment.
- Confirm the booking becomes `confirmed` and a ledger credit exists.
- Scan the booking QR in the operator portal.
- Approve and send a test payout to a Paystack test recipient.
- Request and process a test refund.
- Confirm every notification appears in the correct portal.
- Check deep links and mobile layouts.
- Open `/legal/terms`, `/legal/privacy`, `/legal/refunds`, `/legal/cancellation` and `/legal/cookies`. Confirm the footer shows the real registered entity and RC number, not a placeholder.
- Register a mechanic and confirm the terms checkbox is required; reserve as a guest and confirm the same.

## 10. Rollback

- Frontend: promote the previous deployment in the host dashboard.
- Functions: redeploy the previous commit.
- Database: migrations are forward-only. Take a Supabase backup before production changes and use a new corrective migration rather than editing applied files.

## 11. Monitoring

- Supabase logs: Auth, Postgres, Edge Functions.
- Paystack dashboard: transactions, refunds, transfers and webhook delivery.
- Frontend host: build logs and error analytics.
- Alert on repeated `payment_webhook_events.error` rows, failed functions and negative operator ledger balances.
