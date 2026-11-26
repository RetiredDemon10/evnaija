# Administrator guide

## Signing in

Administrators use the normal `/login` page. An admin account must be provisioned with `scripts/create-admin.mjs`; there is no self-service admin signup and no browser role editor.

## First week checklist

1. Open `/admin/settings` and confirm support email/phone, booking hold, cancellation window and maximum active bookings.
2. Open `/admin/commission` and set commission, service fee, VAT and minimum payout. The next booking uses the new values.
3. Open `/admin/locations` and enable launch cities; add new cities before operators can select them.
4. Open `/admin/content` and set hero copy, announcement, footer tagline and social links.
5. Review operators at `/admin/verification`; approve only after checking documents.
6. Review pending stations at `/admin/stations`, verify photos, address and charger data, then approve.
7. Test one Paystack test booking and refund before enabling live keys.

## Operator verification

- Check the business name, registration number, owner identity and proof of ownership.
- Use signed document links from the private `operator-documents` bucket.
- Approving an operator allows station submission, not automatic station approval.
- Rejection requires a reason; the operator is notified.
- Suspension hides the operator's access to operational writes and should be paired with station suspension where needed.

## EV mechanic verification

Open **EV Mechanics** in the admin sidebar to review workshop registrations. Approve a listing only after confirming the technician's identity, business details and EV-specific experience. Approving also verifies the listing; rejections require a reason that the mechanic sees on their listing page. Suspended and featured states are reversible. Service requests sent by drivers appear on the same page as a count, and are answered by the mechanic directly — no payment is taken by EV Naija for these requests.

## Station moderation

A station lifecycle is `pending → approved/rejected → suspended`. Operators can resubmit a rejected station as pending after fixing issues. Admin approval makes the station and its active chargers publicly discoverable. Featured placement is controlled only by admins.

## Refunds

1. Open `/admin/refunds`.
2. Confirm the refund is not already completed or processing.
3. Use **Process refund**. The edge function calls Paystack.
4. A queued refund remains `processing` until Paystack confirms `refund.processed`.
5. A completed refund reverses the operator earning in the ledger.

Never mark a refund complete manually when Paystack has not confirmed it.

## Payouts

1. Operator requests a payout from `/operator/payouts`.
2. Admin reviews the request and ledger balance at `/admin/payouts`.
3. **Approve** first using the status action.
4. Then **Send transfer**. The edge function uses Paystack and writes the ledger debit only after transfer acceptance.
5. `processing` means Paystack has accepted or queued it; `paid` means success was confirmed.
6. If the bank cannot be matched, update the payout account to Paystack's exact bank name and retry.

## Reviews

Reviews are submitted only for completed bookings. Report/moderation can hide or publish. Published ratings recalculate the station average automatically. Operator replies appear publicly.

## Notifications

`/admin/notifications` broadcasts in-app notifications to all users, customers or operators. The edge function excludes suspended profiles and validates audience/title/message length. Email/SMS delivery is not included by this broadcast function; integrate a transactional provider if needed.

## Support

`/admin/support` lists customer/operator tickets and message threads. Staff replies are marked `is_staff` and move the ticket to `pending`; customer replies reopen it. Resolve or close when complete.

## Audit trail

Sensitive admin actions should write to `admin_audit_logs`; review `/admin/audit`. Do not delete audit rows. Restrict production database access to trusted staff.

## Platform content keys

| Key | Used on |
| --- | --- |
| `hero_headline` | Homepage hero |
| `hero_subheadline` | Homepage hero |
| `homepage_announcement` | Homepage announcement bar |
| `footer_tagline` | Site footer |
| `support_email` | Footer/contact |
| `support_phone` | Footer/contact |
| `social_instagram` | Footer |
| `social_x` | Footer |
| `social_linkedin` | Footer |

Additional operational keys: `booking_hold_minutes`, `cancellation_window_hours`, `max_active_bookings_per_user`, `review_moderation_required`, `maintenance_mode`.

## Incident playbook

- **Paystack webhook failures:** inspect `payment_webhook_events.error`, function logs and Paystack delivery logs. Replay after fixing.
- **Duplicate ledger entries:** stop payouts, reconcile against Paystack, and correct with a new ledger migration; do not edit historical rows casually.
- **Suspected account takeover:** suspend the profile, revoke sessions in Supabase Auth, reset credentials, review audit logs.
- **Operator outage:** suspend affected stations so drivers cannot book, notify affected customers, process refunds per policy.
