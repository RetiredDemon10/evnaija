import { CalendarClock, FileText, Lock, RefreshCcw, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { usePageTitle } from '@/hooks/usePageTitle'
import { BRAND, LEGAL_ENTITY } from '@/lib/constants'
import { isLegalDoc, LEGAL_DOC_LINKS, type LegalDocSlug } from '@/lib/legal'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

type Doc = {
  title: string
  intro: string
  icon: typeof FileText
  sections: { heading: string; body: string[] }[]
}

const DOCS: Record<LegalDocSlug, Doc> = {
  terms: {
    title: 'Terms of Service',
    icon: FileText,
    intro:
      'These terms govern your use of the EV Naija marketplace, including station discovery, bookings, payments, operator tools, the mechanic directory and service requests. By creating an account, publishing a listing or sending a service request, you agree to them.',
    sections: [
      {
        heading: '1. The marketplace',
        body: [
          'EV Naija connects electric vehicle drivers with independent charging station operators and independent EV mechanics. Unless expressly stated, we do not own or operate the charging equipment and we do not employ the mechanics listed in the directory. The operator or mechanic is responsible for its equipment, workmanship, safety and the service it delivers.',
          'We verify operator and mechanic identity, business documentation and listing details before publishing. Verification is a review of information, not a guarantee of uninterrupted availability, equipment performance or workmanship.',
          'Mechanic service requests introduce a driver and a mechanic. EV Naija does not take payment for these requests and is not a party to any repair agreement. Price, scope, timing and warranties are agreed directly between you and the mechanic.',
        ],
      },
      {
        heading: '2. Accounts',
        body: [
          'You must provide accurate information, keep your credentials secure and be at least 18 years old to create an account. You are responsible for activity under your account, including activity by anyone you allow to use it.',
          'Roles are granted by EV Naija. You may not sell, transfer or attempt to assign an operator, mechanic or admin role. We may suspend or close accounts that engage in fraud, abuse, unsafe conduct, payment reversals, impersonation or repeated policy violations.',
        ],
      },
      {
        heading: '3. Bookings and payments',
        body: [
          'A booking reserves a specific charger for a specific time window. Your reservation is held while payment is pending and is confirmed only after the payment is verified server-side through Paystack. A pending hold is not a confirmed booking.',
          'Prices are displayed before payment and include the charging fee, any operator booking fee, our platform service fee and applicable VAT. Paystack processes payments; EV Naija does not store full card details. Guest checkouts are authorised by a per-booking secure link sent to the email address you provide.',
          'Arrive on time. A reservation may be released if you have not checked in within 15 minutes of your start time, without refund of the platform service fee. See the Cancellation and Refund policies for details.',
        ],
      },
      {
        heading: '4. Cancellations and refunds',
        body: [
          'Cancel free of charge up to 2 hours before your session. Cancellations inside 2 hours may be eligible for a 50% refund of the charging fee, excluding the platform service fee, at the operator’s discretion and subject to our refund policy.',
          'If a station cannot deliver the booked service, contact support. We will investigate and, where appropriate, arrange a refund or credit. Mechanic service requests involve no platform payment, so there is nothing for EV Naija to refund.',
        ],
      },
      {
        heading: '5. Operator and mechanic obligations',
        body: [
          'Operators must keep station details, charger status, pricing and availability accurate, maintain equipment in safe working order, honour confirmed bookings and comply with applicable Nigerian law.',
          'Mechanics must provide accurate business, qualification and insurance information, perform work with reasonable care, keep customer information confidential and comply with applicable Nigerian law. Mechanics are independent contractors; nothing in these terms creates an employment, partnership, franchise or agency relationship with EV Naija.',
          'Neither operators nor mechanics may solicit off-platform payment for bookings or leads initiated on EV Naija, manipulate reviews or ratings, or misrepresent equipment, credentials or capabilities.',
        ],
      },
      {
        heading: '6. Reviews, ratings and content',
        body: [
          'Only customers with a completed booking may review a station. Reviews must reflect genuine experience. We may hide reviews that contain abuse, personal data, spam or unlawful content, and we may report serious conduct to the relevant authorities.',
          'Any rating displayed for a mechanic is based on completed service records where available. It is indicative only and is not a warranty of workmanship. You are responsible for checking qualifications, insurance and pricing before agreeing to repairs.',
        ],
      },
      {
        heading: '7. Liability',
        body: [
          'To the maximum extent permitted by law, EV Naija is not liable for indirect or consequential loss, vehicle damage caused by third-party equipment or third-party mechanics, losses arising from station unavailability, or the acts and omissions of independent operators and mechanics.',
          'Nothing in these terms excludes or limits liability that cannot lawfully be excluded or limited under Nigerian law, including liability for fraud or fraudulent misrepresentation.',
        ],
      },
      {
        heading: '8. Changes and contact',
        body: [
          `We may update these terms as the marketplace evolves. Material changes will be communicated by email or in-app notice before they take effect. The current version is always published at /legal/terms. Questions: ${BRAND.supportEmail}.`,
          `Published by ${LEGAL_ENTITY.name}${LEGAL_ENTITY.registrationNumber ? ` (${LEGAL_ENTITY.registrationNumber})` : ''}.`,
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    icon: Lock,
    intro:
      'This policy explains what personal data EV Naija collects, why we collect it, how long we keep it, who receives it and the choices available to you. It should be read with our Cookie Policy.',
    sections: [
      {
        heading: 'Information we collect',
        body: [
          'Account data: name, email address, phone number, password hash, profile photo, home address and vehicle details where provided.',
          'Operator and mechanic data: business name, registration details, business address, verification documents, payout account details, service specialities, certifications and listing location.',
          'Booking and payment data: station, charger, time slot, amounts, VAT, payment status and Paystack transaction references. Paystack processes card data; we receive references, channel and status, not full card numbers.',
          'Service-request data: the name, email, phone, vehicle and fault description you choose to share with a mechanic. For anonymous requests, the abuse-prevention record stores only a one-way hash of the email and expires after one hour; the request itself contains the contact details you submitted so the mechanic can reply.',
          'Technical data: device and browser information, IP address and usage events needed to secure and improve the service. Local preferences such as sidebar state stay on your device.',
          'Support chat data: if you use the Smartsupp live chat widget, your messages, any contact details you provide in chat, and session metadata such as the page you were on, browser type and approximate location derived from IP are processed so our support team can reply and keep a record of the conversation.',
        ],
      },
      {
        heading: 'How we use it',
        body: [
          'To create and secure accounts, process bookings and payments, verify operators and mechanics, match drivers with mechanics, calculate fees and settlements, provide support through our live chat and support inbox, prevent fraud, send transactional notifications and improve the product.',
          'We do not sell personal data. We share only what is necessary with Paystack, Smartsupp (live chat support), hosting and email delivery providers, and — for a specific booking or service request — the relevant operator or mechanic. Marketing messages are sent only where you have opted in, and every message includes an opt-out.',
        ],
      },
      {
        heading: 'Legal bases and retention',
        body: [
          'We rely on the Nigeria Data Protection Act 2023 and the Nigeria Data Protection Regulation 2019. Processing is based on performing our contract with you, complying with legal obligations, protecting legitimate interests such as fraud prevention and platform security, and consent where required.',
          'Financial and tax records are kept for the statutory period required by Nigerian tax and accounting law. Account data is kept while your account is active and for a reasonable period afterwards. Service requests are kept while active and for a reasonable dispute period. Live chat transcripts are kept only for a reasonable support and dispute period. Abuse-prevention hashes are kept for one hour. When data is no longer needed, it is deleted or anonymised.',
        ],
      },
      {
        heading: 'Security',
        body: [
          'We use row-level security, least-privilege database policies, server-side payment verification, one-way hashing for guest tokens and abuse-prevention identifiers, restricted production access and encrypted transport.',
          'No system is perfectly secure. We design for containment, auditability and rapid response, and we notify the regulator and affected people of qualifying personal-data breaches within the statutory deadlines.',
        ],
      },
      {
        heading: 'Your rights',
        body: [
          `Subject to applicable law, you may request access to, correction of, export of, or deletion of your personal data; object to certain processing; withdraw consent; and ask us to restrict processing. Email ${LEGAL_ENTITY.dpoEmail} or ${BRAND.supportEmail}. We may need to verify your identity before acting.`,
          'You can control non-essential communications in your notification settings or by using the opt-out in a message. Transactional messages about bookings, payments and security are still sent while your account is active.',
          `If you are unhappy with how we handle your data, you may complain to the Nigeria Data Protection Commission (NDPC). We would appreciate the chance to resolve it first at ${LEGAL_ENTITY.dpoEmail}.`,
        ],
      },
      {
        heading: 'Transfers and contact',
        body: [
          'Some service providers, including hosting, email delivery, Paystack and Smartsupp, may process data outside Nigeria. Where they do, we use contractual and technical safeguards appropriate to the transfer and applicable Nigerian law.',
          `The data controller is ${LEGAL_ENTITY.name}${LEGAL_ENTITY.registrationNumber ? ` (${LEGAL_ENTITY.registrationNumber})` : ''}, ${BRAND.address}. Data protection enquiries: ${LEGAL_ENTITY.dpoEmail}.`,
        ],
      },
    ],
  },
  refunds: {
    title: 'Refund Policy',
    icon: RefreshCcw,
    intro:
      'We aim to be fair to drivers and operators. This policy explains when a charging booking is eligible for a refund and how refunds are processed.',
    sections: [
      {
        heading: 'Free cancellation',
        body: [
          'Cancel more than 2 hours before your booking start time for a full refund of the amount paid, excluding any non-refundable promotional credit.',
          'Cancel inside 2 hours and the platform service fee is non-refundable. The charging fee may be refunded at 50% subject to operator policy shown at checkout.',
        ],
      },
      {
        heading: 'Station or equipment failure',
        body: [
          'If the charger is unavailable, faulty or materially different from the listing, report it in-app or to support within 24 hours. We will review the booking and, where verified, refund the affected amount.',
          'Where a session is partially delivered, we may refund the undelivered portion based on the metered energy and the booking record.',
        ],
      },
      {
        heading: 'No-shows and late arrival',
        body: [
          'If you do not check in within 15 minutes of your start time, the operator may release the charger. The platform service fee is not refunded. The charging fee may be retained by the operator.',
        ],
      },
      {
        heading: 'Mechanic service requests',
        body: [
          'Sending a service request to a mechanic is free. EV Naija takes no payment for the introduction and therefore has no fee to refund. Any diagnostic fee, callout fee or repair cost is agreed and paid directly between you and the mechanic. To cancel a request, contact the mechanic using the details on their listing or reply to their message.',
        ],
      },
      {
        heading: 'Processing time',
        body: [
          'Approved refunds are initiated through Paystack to the original payment method. Card refunds typically settle within 5–10 business days depending on your bank. Bank transfer refunds may take longer.',
          'Refund status is visible in your payment history. Contact support if a refund has not reflected after 10 business days.',
        ],
      },
      {
        heading: 'Disputes',
        body: [
          `If you disagree with a refund outcome, reply to the support thread or email ${BRAND.supportEmail} with your booking reference. We review disputes within 5 business days.`,
        ],
      },
    ],
  },
  cancellation: {
    title: 'Cancellation Policy',
    icon: CalendarClock,
    intro:
      'This policy explains how to cancel a charging booking or a recurring plan, and what happens to your reservation and payment.',
    sections: [
      {
        heading: 'How to cancel',
        body: [
          'Signed-in customers can cancel from /app/bookings or from the booking detail page. Guests can open the secure link emailed with their booking and cancel from the booking confirmation page. You may also contact support with your booking reference.',
          'Cancelling releases the charger immediately, so another driver can reserve it. A cancellation is only effective once the app or support confirms it.',
        ],
      },
      {
        heading: 'Timing and charges',
        body: [
          'Cancel more than 2 hours before the session start time for a full refund of the amount paid, excluding non-refundable promotional credit.',
          'Cancel inside 2 hours and the platform service fee is non-refundable. The charging fee may be refunded at 50% depending on the operator policy shown at checkout. See the Refund Policy for processing times.',
          'If you do not check in within 15 minutes of the start time, the operator may release the charger and treat the booking as a no-show.',
        ],
      },
      {
        heading: 'Recurring plans',
        body: [
          'Cancelling a recurring plan stops future automatic bookings. Sessions already created and confirmed follow the normal cancellation rules above. Unpaid future holds are released when the plan is cancelled.',
        ],
      },
      {
        heading: 'Operator or platform cancellation',
        body: [
          'If a station is unavailable, unsafe or materially different from its listing, we may cancel or modify the booking and arrange a refund or credit. We will notify you using the contact details on the booking.',
        ],
      },
      {
        heading: 'Mechanic service requests',
        body: [
          'A mechanic service request is not a booking and takes no payment. To withdraw one, contact the mechanic directly using the details on their listing. There is no platform fee to reverse.',
        ],
      },
    ],
  },
  cookies: {
    title: 'Cookie Policy',
    icon: ShieldCheck,
    intro:
      'EV Naija uses a small number of cookies and similar storage technologies to keep you signed in, secure the service, remember local preferences and operate our support live chat.',
    sections: [
      {
        heading: 'Essential cookies',
        body: [
          'Authentication cookies from Supabase keep you signed in and protect your session. They are required for the dashboard, booking and payment flows and cannot be disabled while using those features.',
          'Security storage helps detect abuse and prevent cross-site request forgery. It contains no advertising identifiers. Guest booking access uses a per-booking token in the secure link you receive by email.',
        ],
      },
      {
        heading: 'Preference storage',
        body: [
          'We store small preferences locally, such as whether your dashboard sidebar is collapsed and, in preview mode, which demo role you selected. These stay on your device and are not sent to a marketing provider.',
        ],
      },
      {
        heading: 'Support chat, analytics and advertising',
        body: [
          'Smartsupp may set a session cookie or local-storage entry to keep the live chat widget working, remember your conversation and recognise repeat visitors to the same chat. This storage is used only to deliver support. We do not use Smartsupp for analytics, advertising, cross-site tracking or profiling, and we do not sell chat data.',
          'This build does not set analytics, advertising or cross-site tracking cookies, and we do not sell cookie data. If we introduce non-essential tracking in future, we will update this policy and ask for your consent before setting it.',
        ],
      },
      {
        heading: 'Managing cookies',
        body: [
          'You can clear or block cookies in your browser settings. Blocking essential cookies will prevent sign-in and booking; blocking Smartsupp storage may stop the live chat widget from remembering your conversation. The chat widget is operated by Smartsupp under its own privacy notice, and third-party payment pages are governed by Paystack’s own cookie policy.',
          `Questions about this policy? Contact ${BRAND.supportEmail}.`,
        ],
      },
    ],
  },
}

export default function LegalPage() {
  const { doc } = useParams<{ doc: string }>()
  const key: LegalDocSlug = isLegalDoc(doc) ? doc : 'terms'
  const active = DOCS[key]
  usePageTitle(active.title)
  const Icon = active.icon

  return (
    <div className="bg-mint-50 pb-20 pt-28">
      <div className="container-page">
        <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Link to="/" className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted hover:text-midnight-900">
              EV Naija / Legal
            </Link>
            <nav className="mt-4 space-y-1 rounded-2xl border border-midnight-900/[0.07] bg-white p-2 shadow-card">
              {LEGAL_DOC_LINKS.map((link) => (
                <Link
                  key={link.slug}
                  to={`/legal/${link.slug}`}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition',
                    key === link.slug ? 'bg-midnight-900 text-lime' : 'text-charcoal-600 hover:bg-mint-50',
                  )}
                >
                  {link.slug === key ? <Icon className="h-3.5 w-3.5" /> : <span className="w-3.5" />} {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 rounded-2xl border border-lime-400/40 bg-lime/15 p-4">
              <p className="text-[11px] font-semibold text-midnight-900">Last updated</p>
              <p className="mt-1 font-mono text-[10px] text-charcoal-500">26 November 2026</p>
              <p className="mt-3 text-[10px] leading-relaxed text-charcoal-500">
                Questions about this document? Email {LEGAL_ENTITY.dpoEmail}.
              </p>
            </div>
          </aside>

          <article className="rounded-3xl border border-midnight-900/[0.07] bg-white p-6 shadow-card sm:p-9">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-midnight-900 text-lime"><Icon className="h-5 w-5" /></span>
              <Badge tone="lime">Legal</Badge>
            </div>
            <h1 className="mt-5 font-display text-3xl font-semibold tracking-[-0.035em] text-midnight-900 sm:text-4xl">{active.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-charcoal-500">{active.intro}</p>
            <div className="mt-8 space-y-8">
              {active.sections.map((section) => (
                <section key={section.heading}>
                  <h2 className="font-display text-lg font-semibold text-midnight-900">{section.heading}</h2>
                  <div className="mt-2.5 space-y-2.5">
                    {section.body.map((paragraph) => (
                      <p key={paragraph.slice(0, 32)} className="text-[13px] leading-relaxed text-charcoal-600">{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div className="mt-10 rounded-2xl bg-mint-50 p-5">
              <p className="text-[11px] font-semibold text-midnight-900">Need clarification?</p>
              <p className="mt-1 text-[11px] leading-relaxed text-charcoal-500">
                Contact <a href={`mailto:${BRAND.supportEmail}`} className="font-semibold text-lime-700 hover:underline">{BRAND.supportEmail}</a> or use the in-app support centre. We aim to respond within one business day.
              </p>
            </div>
          </article>
        </div>
      </div>
    </div>
  )
}
