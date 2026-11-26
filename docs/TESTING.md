# Testing and acceptance

## Automated checks

```bash
npm run typecheck
npm run test
npm run build
```

Current unit tests cover:

- Booking quote arithmetic and the client/server pricing mirror.
- Role dashboard routing and primary-role selection.
- Date/booking helper formatting.

## Preview-mode review

Start without Supabase env vars:

```bash
npm run dev
```

Use the demo accounts listed in `README.md`. Verify:

- The preview banner is visible.
- All three portals render.
- Dashboard values come from fixtures and are labelled as sample data.
- Checkout is disabled with a clear explanation; no preview action marks a payment successful.

## Live backend acceptance checklist

Use a staging Supabase project and Paystack test keys.

### Auth and roles

- [ ] Customer signup creates one profile, one `customer` role and no operator profile.
- [ ] Operator signup creates one profile, one `operator` role and one pending operator profile.
- [ ] Email confirmation link lands on `/verify-email` and sign-in works.
- [ ] Password reset email arrives and `/reset-password` updates the password.
- [ ] Customer cannot open `/operator` or `/admin` by URL.
- [ ] Operator cannot open `/admin`.
- [ ] Admin can open all portals.
- [ ] Suspended customer cannot create a new booking.

### Operator verification and stations

- [ ] Operator submits business details and documents.
- [ ] Admin sees the application at `/admin/verification`.
- [ ] Admin approves/rejects; operator receives a notification.
- [ ] Only approved operators can create stations.
- [ ] New station starts `pending`; admin approval makes it publicly visible.
- [ ] Operator edits do not alter moderation fields directly.
- [ ] Cover image upload sets one cover and appears on the public station page.
- [ ] Charger create/update recalculates station charger counts.
- [ ] Availability save persists weekdays and operating hours.

### Discovery

- [ ] `/stations` filters by city and connector.
- [ ] Station detail shows live chargers, prices, amenities, map and reviews.
- [ ] Favourites persist across reloads.
- [ ] Public reviews show reviewer name/avatar but no email or phone.
- [ ] Anonymous users cannot read operator contact columns directly.

### Booking and payment

- [ ] Booking quote matches the amount stored after `create_booking`.
- [ ] Slot overlap is rejected even under concurrent attempts.
- [ ] Expired holds do not block new bookings.
- [ ] Maximum active bookings is enforced.
- [ ] Paystack checkout opens with the correct amount and reference.
- [ ] Callback verification confirms the booking and writes ledger credits exactly once.
- [ ] Replaying the webhook does not duplicate ledger entries or notifications.
- [ ] Cancelling an unpaid booking abandons the payment.
- [ ] Cancelling a paid booking inside the policy window creates a pending refund.
- [ ] Paying after hold expiry records payment and creates a pending refund without confirming the slot.

### Operator operations

- [ ] Operator sees only their stations, bookings and customers.
- [ ] QR check-in rejects another operator's booking.
- [ ] Confirmed → checked in → charging → completed works.
- [ ] Customer receives notifications at each status change.
- [ ] Operator can reply to a review once; reply appears publicly.
- [ ] Revenue, transactions and ledger balance reconcile.
- [ ] Payout request rejects amounts above available balance and below minimum.
- [ ] Admin approval does not equal transfer; transfer uses the edge function.
- [ ] Paystack test transfer creates one payout debit.

### Admin operations

- [ ] Dashboard counts match direct SQL queries.
- [ ] Commission update affects the next booking.
- [ ] Refund processing creates a Paystack refund and remains `processing` until confirmed.
- [ ] Completed refund marks payment reversed and writes one operator debit.
- [ ] Review moderation hides/publishes and updates station rating.
- [ ] Broadcast notification reaches only the selected audience.
- [ ] Content edits change the homepage/footer after reload.
- [ ] Team invitations are not faked; new admins are created with the script.
- [ ] Audit log records sensitive admin actions.
- [ ] Locations can be added and disable new station selection.

### Cross-cutting

- [ ] Mobile layouts work at 375 px, 768 px and 1440 px.
- [ ] Loading, empty and error states are visible and useful.
- [ ] No browser console errors.
- [ ] No secret key appears in built assets (`grep -R "service_role" dist` should be empty).
- [ ] Deep links work after a hard refresh.
- [ ] RLS can be spot-checked by querying as `anon` and as two different customers.

## SQL spot checks

```sql
-- A customer can only see their own bookings through the API.
select count(*) from public.bookings;

-- Only one ledger credit per booking.
select booking_id, entry_type, count(*)
from public.financial_ledger
group by booking_id, entry_type
having count(*) > 1;

-- No successful payment may exist without a Paystack reference.
select id, reference
from public.payments
where status = 'success' and paystack_reference is null;

-- Failed webhook deliveries.
select event_id, event_type, error, created_at
from public.payment_webhook_events
where processed = false
order by created_at desc;
```

## Load and concurrency

- Run two booking requests for the same charger and overlapping slot simultaneously; exactly one should succeed.
- Replay the same `charge.success` webhook three times; ledger credits must remain one set.
- Send a 2x amount verification; `settle_payment` must reject it.
- Attempt a direct client update to `payments.status` and `profiles.is_suspended`; both must fail.
