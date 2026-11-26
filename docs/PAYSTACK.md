# Paystack integration

EV Naija uses Paystack server-side only. The browser never sees the Paystack secret key and cannot mark a payment successful.

## Keys and secrets

| Key | Where it belongs | Used for |
| --- | --- | --- |
| `pk_test_...` / `pk_live_...` | `VITE_PAYSTACK_PUBLIC_KEY` | Public readiness display only |
| `sk_test_...` / `sk_live_...` | Supabase Edge Function secret `PAYSTACK_SECRET_KEY` | Initialise, verify, refund, transfer, webhook signature |

Use test keys until the full acceptance checklist in `docs/TESTING.md` passes.

## End-to-end payment flow

```text
Customer selects a slot
        │
        ▼
create_booking RPC (service-side pricing, 15-minute hold)
        │
        ▼
initialize-payment edge function
  - verifies customer session and booking ownership
  - checks hold and pending status
  - POST /transaction/initialize with amount in kobo
  - returns Paystack authorization_url
        │
        ▼
Customer pays on Paystack
        │
        ├──────────────► callback /payment/callback verifies via verify-payment
        │
        └──────────────► charge.success webhook (signed HMAC SHA-512)
                                  │
                                  ▼
                         settle_payment RPC
                   - amount and currency checks
                   - payment becomes success
                   - booking confirmed only if hold valid
                   - ledger credits written once
```

Both verification paths are idempotent. The webhook records every delivery in `payment_webhook_events` and ignores duplicate event keys.

## Amount and currency

- Paystack expects the smallest unit. EV Naija multiplies the naira amount by 100 and rounds.
- Payment currency defaults to `NGN`.
- `settle_payment` rejects a verified amount below the booking amount or a currency mismatch.
- The authoritative booking amount comes from the database, not the browser.

## Late payment behaviour

If a customer pays after the charger hold expires or after another booking took the slot:

1. The payment is still recorded as successful because Paystack captured real money.
2. The booking is not confirmed.
3. A `refunds` row is created with `pending` status.
4. The customer receives a notification.
5. An administrator processes the refund through `process-refund`.

This avoids both faking a confirmation and losing the customer's payment.

## Refunds

`process-refund`:

- Requires an administrator JWT and the `admin` role.
- Finds the payment and uses the Paystack transaction reference.
- Calls `POST /refund` with the amount in kobo.
- Marks the refund `processing`; it does not pretend the money has returned.
- Calls `settle_refund` with `completed` only when Paystack reports the refund processed.

Paystack refund webhooks `refund.pending`, `refund.processed` and `refund.failed` update the same record idempotently. A completed refund marks the payment reversed, the booking refunded and writes the operator ledger reversal.

## Payouts

Approval and transfer are deliberately separate:

1. Operator requests a payout via `request_payout`; the RPC checks ledger balance and pending requests.
2. Admin approves with `admin_set_payout_status` (`approved`).
3. Admin triggers `operator-payout` to create/send the Paystack transfer.
4. `settle_payout` writes the ledger debit only after Paystack accepts the transfer.

Recipient handling:

- If the payout account already has a Paystack `recipient_code`, it is reused.
- Otherwise the function fetches Paystack's NGN bank list, matches the saved bank name and creates a NUBAN recipient.
- If the bank cannot be matched, update the saved bank name to Paystack's exact name and retry.

OTP-enabled transfers return `otp_required`. Complete the OTP in Paystack before retrying. For automated production payouts, disable transfer OTP in Paystack where your risk settings allow it.

Paystack transfer webhooks `transfer.success` and `transfer.failed` reconcile the payout.

## Webhook setup

URL:

```text
https://YOUR_PROJECT.supabase.co/functions/v1/paystack-webhook
```

Events: `charge.success`, `refund.pending`, `refund.processed`, `refund.failed`, `transfer.success`, `transfer.failed`.

The function:

- Reads the raw body before parsing.
- Computes HMAC SHA-512 with `PAYSTACK_SECRET_KEY`.
- Compares `x-paystack-signature` in constant time.
- Stores the event and deduplicates by `event:data.id`/reference.
- Returns 2xx on success or duplicate; non-2xx on processing failure so Paystack retries.

## Test cards and accounts

Use Paystack test keys and Paystack's documented test cards. Successful test transactions behave like live transactions in the database, but no real money moves. Paystack test transfers require a test balance and test recipient details.

## Common failures

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Missing required environment secret: PAYSTACK_SECRET_KEY` | Function secret not set | `npx supabase secrets set PAYSTACK_SECRET_KEY=...` |
| `Invalid Paystack signature` | Wrong secret or proxy altered body | Verify secret and that raw body is used |
| `Verified amount ... does not match` | Client tampering or stale payment record | Check `payments.amount` and Paystack transaction |
| `duplicate` on initialize | Existing Paystack reference | The function generates a new reference automatically |
| Transfer fails to match bank | Saved name differs from Paystack bank list | Save Paystack's exact bank name |
| Webhook rows have `processed = false` | Processing error | Read `error`, fix payload/secret, replay from Paystack |
