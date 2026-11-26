# Legal compliance & launch guide

> **Important:** This document is an operational checklist prepared by the engineering team. It is **not legal advice** and does not certify that EV Naija complies with every law. Before launch, have a qualified Nigerian lawyer review your entity documents, policies, mechanic agreements, tax treatment and data-protection programme. The regulator and official guidance change; verify current requirements.

This is the answer to **"how do I legally run this software?"** Work through sections 1–10 in order, then keep the cadence in section 11. The repository already implements the technical controls listed in section 9; the items in sections 1–8 are business and legal actions you must complete outside the codebase.

---

## 1. Set up the legal entity first

You cannot operate a marketplace under a brand name alone. Before taking a live payment:

| Item | Action | Evidence to keep |
| --- | --- | --- |
| Business registration | Register a company with the Corporate Affairs Commission (CAC). Do not trade as an unregistered sole proprietor if you plan to employ staff, raise funds or sign partner contracts. | CAC certificate, memorandum & articles, RC number |
| Tax identity | Obtain a TIN, register for VAT and PAYE where applicable, and understand Companies Income Tax obligations. | TIN letter, VAT registration, tax clearance where needed |
| Bank / payment account | Open a corporate account and complete Paystack business verification (director IDs, BVN/NIN, registered address, nature of business). | Paystack merchant approval, settlement account |
| Registered address | Use a real, monitored address. The app currently ships a placeholder Lagos address in `BRAND.address` — replace it or set it in code before launch. | Utility bill / lease, CAC address record |
| Public legal identity | Set the build-time environment variables below. The footer, Terms and Privacy Policy render from them. | Deployed footer showing the real entity and RC number |

```bash
VITE_LEGAL_ENTITY_NAME="Your Registered Entity Ltd"
VITE_LEGAL_RC_NUMBER="RC 1234567"
VITE_LEGAL_TIN="12345678"
VITE_LEGAL_DPO_EMAIL="dpo@yourdomain.ng"
```

Run the gate in CI and locally:

```bash
npm run legal:check            # checks links, disclosures, consent gates
npm run legal:check -- --strict # also fails on placeholder entity details
```

If `--strict` passes, the published pages and footer no longer show placeholder registration details. Never ship `RC 0000000`.

---

## 2. Data protection (NDPA 2023 / NDPR 2019)

EV Naija processes personal data, so a privacy programme is mandatory, not optional.

1. **Appoint a Data Protection Officer (DPO)** and publish the contact address. `VITE_LEGAL_DPO_EMAIL` appears in the Privacy Policy; ensure it reaches a real person.
2. **Confirm NDPC registration obligations** for your category of data controller and complete them if required. Your lawyer should confirm the current threshold and filing process.
3. **Create a Record of Processing Activities (RoPA):** purposes, categories of data and data subjects, recipients, retention periods, and transfer safeguards. Map it to the "Information we collect" and "Legal bases and retention" sections of `/legal/privacy`.
4. **Complete a Data Protection Impact Assessment (DPIA)** before launch. Focus on passenger/driver location patterns, payment data, verification documents, anonymous service requests and mechanic customer records.
5. **Publish the Privacy Policy** at `/legal/privacy` (already implemented) and keep the DPO and entity details current.
6. **Implement data-subject requests:** access, correction, deletion, portability, objection and consent withdrawal. The published policy promises a response within the statutory period; route requests to the DPO, verify identity, action the request in Supabase and log it. Delete financial records only when retention law allows.
7. **Prepare a breach response plan:** detect → contain → assess risk → notify the NDPC and affected people within the applicable statutory deadline → record the incident. The repository already writes admin audit events; keep an off-platform incident register too.
8. **Control marketing:** only send marketing to people who opted in, identify yourself in every message, and honour opt-out immediately. Transactional booking/payment/security messages are separate and do not require marketing consent.
9. **Handle children's data:** the Terms require users to be 18+. Do not knowingly collect data from minors; if discovered, delete it and escalate to the DPO.
10. **Cross-border transfers:** list every processor that may store/process data outside Nigeria (hosting, Supabase, email, Paystack) and record the safeguards. Your lawyer should confirm the required transfer mechanism under current Nigerian law.

---

## 3. Publish and maintain the policies

The app ships five documents at `/legal/*`:

| Document | Cover |
| --- | --- |
| Terms of Service | Marketplace role, accounts, bookings/payments, operator & mechanic obligations, reviews, liability |
| Privacy Policy | Data categories, purposes, legal bases, retention, security, rights, transfers, DPO |
| Refund Policy | Cancellation windows, station failure, no-shows, Paystack settlement times, disputes, mechanic requests |
| Cancellation Policy | How to cancel, timing/charges, recurring plans, operator cancellation |
| Cookie Policy | Essential auth/storage, local preferences, no analytics/advertising cookies today |

Operational rules:

- Keep the canonical list in `src/lib/legal.ts`. The footer and legal page render from it, and `npm run legal:check` fails if a link points at a missing document.
- Update the "Last updated" date in `src/pages/public/LegalPage.tsx` whenever copy changes materially.
- Give notice of material changes by email or in-app notice **before** they take effect. Do not apply new terms retroactively.
- Explicit acceptance is collected at customer signup, operator signup, mechanic registration and guest checkout. Keep the checkboxes; removing one breaks the consent record.
- Store snapshots of policy versions and the dates they were published. You may need to prove which terms applied to a booking or dispute.

---

## 4. Payments, tax and accounting

- Complete Paystack's merchant onboarding and keep the business account in your company's name. Personal settlement accounts create tax and legal problems.
- Keep `PAYSTACK_SECRET_KEY` and webhook secrets server-side only. The browser never stores card details and never marks a booking paid — settlement is verified by the `verify-payment` function and webhook.
- Complete Paystack's PCI-DSS self-assessment if requested. Because card data is handled by Paystack, EV Naija stays out of the card-data environment; preserve that boundary.
- Charge and remit VAT at the applicable rate (the checkout currently displays 7.5%). Confirm the current rate, exemptions and filing schedule with your tax adviser.
- Issue receipts and maintain the append-only transaction ledger. Financial records must be retained for the statutory period; the Privacy Policy promises this.
- Payouts to operators must be recorded and reconciled. Operator tax obligations are theirs, but you still need accurate records and potentially withholding documentation.
- Refunds must go through the admin refund queue and Paystack, never as informal bank transfers. The audit log is your evidence.
- Mechanic service requests take **no payment**. Do not introduce a platform fee without updating the Terms, Refund Policy, Paystack configuration and tax treatment first.

---

## 5. Consumer protection

- Price transparency: show charging fee, operator fee, platform fee, VAT and total before payment. The booking page already does this.
- Honour the published cancellation and refund rules. Support must not promise ad-hoc refunds that contradict the policy; admin refunds are audited.
- Provide a working complaint channel (`/contact` and `support@evnaija.ng`) and track resolution times. The site promises a one-business-day response; staff it accordingly.
- Avoid misleading claims: "verified" means documents were reviewed, not guaranteed performance. Do not claim 24/7 coverage, station counts or uptime you cannot substantiate.
- Keep service availability honest. If a station is defective or withdrawn, update the listing and handle affected bookings per the Cancellation Policy.
- The Federal Competition and Consumer Protection Act (FCCPA) gives consumers rights around fair treatment, accurate information and redress. Your published policies and support process are the front line of compliance.

---

## 6. EV mechanic marketplace

This is the highest-risk area legally because you are introducing third parties who work on expensive vehicles.

1. **Use a written mechanic agreement.** Before approval, have each mechanic accept terms covering: independent contractor status, no employment/agency/franchise, accurate qualifications, insurance, safe work, customer confidentiality, no off-platform solicitation, no discrimination, compliance with law, and indemnity for their own workmanship.
2. **Verify and retain documents:** identity, business registration, relevant certifications, insurance proof and bank details. Record who approved the listing and when — `admin_set_mechanic_status` already writes to `admin_audit_logs`.
3. **Require insurance.** At minimum public liability and professional indemnity / garage keepers cover appropriate to the work. Confirm acceptable limits with counsel and your insurer.
4. **Publish clear disclaimers.** The Terms state that mechanics are independent contractors, EV Naija does not employ them, and ratings are not warranties. Keep those statements.
5. **No payment handling for requests.** A service request only shares the driver's details with the mechanic. Any quote, diagnostic fee or repair cost is agreed directly. Do not describe EV Naija as performing or guaranteeing repairs.
6. **Handle disputes with a documented process:** collect the request reference, both parties' accounts, photos and invoices; recommend mediation; suspend a mechanic whose listing is fraudulent or unsafe. Never adjudicate technical workmanship yourself.
7. **Moderation:** suspend listings that are unverified, unsafe, abusive or impersonating another business. Admin actions are audited; keep the external complaint record linked to the audit entry.
8. **Data minimisation:** only pass the contact and vehicle details a mechanic needs to respond. The anonymous-request rate-limit table stores only a one-hour email hash, not a raw email.

---

## 7. Intellectual property and content

- **Trademark:** "EV Naija" and the logo are your brand assets. Register the mark with the CAC/IP Commissioner if you want enforcement rights. The site's footer claims "All rights reserved"; make sure the entity name is the owner.
- **Fonts:** `public/fonts` contains Bricolage Grotesque, Onest and JetBrains Mono self-hosted from Google Fonts. They are distributed under open font licences (typically SIL OFL); keep a copy of each upstream licence and confirm the current terms in `scripts/fetch-fonts.mjs` sources.
- **Photography/video:** hero and listing imagery comes from Unsplash/Pexels and the hero clips from Mixkit free licence. Keep the source URLs and licence snapshots in your asset register. Do not replace them with unlicensed images.
- **Map data:** the map shows "© OpenStreetMap contributors". Keep the attribution visible; OSM data has its own licence obligations.
- **Third-party marks:** Tesla, BYD, Nissan, Hyundai and other brand names appear only as compatibility/servicing labels. Do not imply endorsement or partnership.
- **Software:** this repository is proprietary to EV Naija. If you licence code to operators or mechanics, use a written agreement; do not represent the codebase as open source.

---

## 8. Marketing and communications

- Use opt-in for newsletters, promotions and SMS. Store the consent record (who, when, which channel, which wording).
- Never sell or rent personal data. The Privacy Policy promises this — do not contradict it with a growth tool.
- Every marketing message must identify EV Naija, explain why the recipient is receiving it and provide a working unsubscribe. Honour opt-outs across email and SMS.
- Transactional messages (receipts, QR codes, booking changes, security alerts, service-request confirmations) are allowed without marketing consent; keep them free of promotional content.
- If you add analytics, advertising pixels, session replay or any non-essential cookie, update `/legal/cookies`, obtain consent first, and re-run `npm run legal:check`. The current build intentionally sets none.

---

## 9. Controls already implemented in the code

| Area | Implementation |
| --- | --- |
| Authorisation | RLS on every public table; `security definer` RPCs; no client-controlled roles, payments or moderation flags |
| Payments | Server-side initialisation and verification; signed Paystack webhook; idempotent reconciliation; no fake success in preview |
| Guest checkout | Per-booking secure link, SHA-256 hashed token storage, server-side rate limits, explicit policy acceptance |
| Booking lookup | Reference + token/email, rate-limited server-side RPC |
| Mechanic requests | Anonymous submission via rate-limited RPC; one-hour email hash for abuse prevention; no payment taken |
| Admin actions | `admin_audit_logs` for mechanic moderation, refunds and other privileged changes |
| Transport/browser | HTTPS/HSTS, strict CSP, `nosniff`, frame denial, referrer and permissions policies in `vercel.json` / `netlify.toml` |
| Secrets | Only Supabase URL/anon key and Paystack public key in the browser; service-role and secret keys in Edge Functions |
| Legal UI | Five published policies, acceptance gates at all four collection points, canonical document list |

See [`SECURITY.md`](./SECURITY.md) for the full threat model and [`TESTING.md`](./TESTING.md) for functional acceptance tests.

---

## 10. Pre-launch gate (run on every release)

```bash
npm install
npm run typecheck
npm run test
npm run legal:check -- --strict
npm run build
```

Then deploy and verify on the live domain:

- [ ] Footer shows the real entity name and RC number.
- [ ] All five `/legal/*` pages load and contain current content.
- [ ] Signup, operator signup, mechanic registration and guest checkout all require policy acceptance.
- [ ] Paystack is in test mode for verification, then switched to live only after sign-off.
- [ ] DPO email and support inbox are monitored.
- [ ] Lawyer has reviewed and signed off the policies and mechanic agreement.
- [ ] Tax adviser has confirmed VAT, receipts, payouts and record retention.
- [ ] Insurance certificates for the platform and listed mechanics are on file.
- [ ] A data-subject request and a breach drill have been rehearsed.

`npm run legal:check` is a guardrail, not a certificate. Passing it means the app's technical promises are internally consistent — it does not replace the reviews above.

---

## 11. Ongoing calendar

| Cadence | Task |
| --- | --- |
| Monthly | Review support complaints, refund reasons, mechanic suspensions and failed webhooks. Reconcile Paystack, ledger and payouts. |
| Quarterly | Review RLS/RPC changes, dependency updates, access lists, MFA for admins/operators, and DSR/incident logs. Re-run `legal:check` and `SECURITY.md` checklist. |
| Annually | Re-review policies with counsel, renew insurance, file tax returns, refresh RoPA/DPIA, verify trademark and asset licences, rotate secrets. |
| On every material change | New data category, new processor, new country, new tracking script, new fee, or new mechanic product → update policies, consent and this guide before release. |

---

## 12. Records to keep outside the repository

- CAC certificate and TIN/VAT registrations
- Signed mechanic and operator agreements with dates and versions
- Verification documents and insurance certificates (access-controlled)
- Policy versions with publication dates and change notices
- Consent records and marketing opt-outs
- RoPA, DPIA, data-subject request log, breach register
- Transaction, refund, payout and tax filing records
- Audit log exports for privileged admin actions
- Legal counsel and tax adviser sign-off notes

---

## Bottom line

To legally operate EV Naija: **register a company, complete tax and Paystack onboarding, appoint a DPO and run a data-protection programme, publish and enforce the five policies, use written independent-contractor agreements with verified and insured mechanics, charge/remit tax correctly, honour consumer rights, keep the licences and records above, and have Nigerian counsel sign off before go-live.** The software already enforces the technical half of that list; the business half is your responsibility.
