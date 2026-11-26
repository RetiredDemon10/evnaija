# Supabase setup reference

## Project values

From Supabase Dashboard → Project Settings → API:

- Project URL → `VITE_SUPABASE_URL`
- `anon` public key → `VITE_SUPABASE_ANON_KEY`
- `service_role` secret → **server only**, used by edge functions and `scripts/create-admin.mjs`

Never prefix the service role key with `VITE_`; Vite exposes such values to every browser.

## Schema

The migrations create 31 public tables:

1. `profiles`
2. `user_roles`
3. `vehicles`
4. `operator_profiles`
5. `operator_documents`
6. `stations`
7. `station_images`
8. `chargers`
9. `charger_connectors`
10. `charger_availability`
11. `bookings`
12. `booking_status_history`
13. `payments`
14. `payment_webhook_events`
15. `refunds`
16. `reviews`
17. `review_responses`
18. `favorites`
19. `notifications`
20. `payout_accounts`
21. `payout_requests`
22. `financial_ledger`
23. `commission_settings`
24. `subscription_plans`
25. `operator_subscriptions`
26. `promotional_listings`
27. `support_tickets`
28. `support_messages`
29. `locations`
30. `platform_settings`
31. `admin_audit_logs`

## Identity and roles

`auth.users` insert triggers `public.handle_new_user()`:

- Creates a `profiles` row.
- Creates a `user_roles` row (`customer` or `operator` from signup metadata).
- Creates a pending `operator_profiles` row for operator signup.

The browser does not insert identity or role rows. Admin promotion is service-role only through `scripts/create-admin.mjs`.

RLS helpers:

- `has_role(role)`
- `is_admin()`
- `is_operator()`
- `current_operator_id()`

## Protected columns

Before-update triggers prevent non-admin clients from changing:

- Profile suspension flags and email.
- Operator status, rejection reason and reviewed timestamp.
- Station owner, moderation status (except resubmitting a rejected station as pending), featured flag and denormalised counts.

Service-role updates bypass these protections through the `request.jwt.claim.role` check.

## Booking flow

`create_booking(station_id, charger_id, vehicle_id, start_time, duration_minutes)`:

1. Validates the signed-in customer, suspension, duration, future window and station/charger status.
2. Validates the selected vehicle belongs to the customer.
3. Checks charger availability by weekday.
4. Takes a transaction advisory lock per charger.
5. Rejects overlapping active bookings.
6. Enforces the maximum active booking count.
7. Prices energy, charging, booking fee, service fee, VAT, commission and operator earning from database settings.
8. Creates `pending_payment` booking, payment record, history and notification.
9. Sets a hold expiry (default 15 minutes).

`cancel_booking` enforces ownership/operator/admin access, creates a pending refund when a successful payment is eligible under the cancellation window, and abandons unpaid payments.

`update_booking_status` allows only the transitions `confirmed → checked_in/cancelled`, `checked_in → in_progress`, `in_progress → completed` and unpaid `pending_payment → cancelled/expired`, except administrators.

`validate_booking_qr` checks the station operator and confirmed status, then checks the booking in.

## Payment settlement

`settle_payment` is executable only by `service_role`. It:

- Locks the payment and booking.
- Rejects amount/currency mismatches.
- Marks the payment successful.
- Confirms the booking only when the hold is valid and no overlapping booking exists.
- Creates a pending refund for late payments instead of stealing a slot.
- Writes operator earning, commission, service fee and tax ledger credits once.

`settle_refund` reverses the operator earning on completed refunds and marks the payment reversed. `settle_payout` writes the payout debit once and notifies the operator.

## Public data

Anonymous users can read:

- Approved stations, station images, chargers, connectors and availability.
- Active locations and subscription plans.
- Public content keys in `platform_settings`.
- `get_charger_slots`, `get_station_reviews`, `get_testimonials` RPC results.

Public review RPCs return display name and avatar only. They do not expose reviewer email or phone.

## Storage

| Bucket | Public | Write policy |
| --- | --- | --- |
| `avatars` | Yes | Authenticated user folder named after `auth.uid()` |
| `station-images` | Yes | Operator owning the station folder, or admin |
| `operator-documents` | No | Operator folder named after `operator_profiles.id`; admins can read |

## Realtime

`notifications` is added to the `supabase_realtime` publication when available. The portal notification bell subscribes to the current user's rows.

## Stale holds

`expire_stale_bookings()` is not automatically scheduled by the migrations because not every Supabase plan allows `pg_cron`. Schedule it every five minutes if available:

```sql
select cron.schedule(
  'expire-ev-naija-bookings',
  '*/5 * * * *',
  $$select public.expire_stale_bookings();$$
);
```

Booking creation already ignores expired holds, so the marketplace remains correct before the job runs.

## Backups

Enable daily backups in Supabase. Before applying future migrations in production, take a manual backup or confirm point-in-time recovery is available.
