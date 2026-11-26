import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react'
import { verifyPayment, recallGuestToken } from '@/services/bookings'
import { useAuth } from '@/contexts/AuthContext'
import { Button, buttonVariants } from '@/components/ui/Button'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatNaira } from '@/lib/utils'

type State = 'verifying' | 'success' | 'failed'

export default function PaymentCallbackPage() {
  const [params] = useSearchParams()
  const { isPreview } = useAuth()
  const reference = params.get('reference') ?? params.get('trxref') ?? ''
  const [state, setState] = useState<State>('verifying')
  const [message, setMessage] = useState('')
  const [amount, setAmount] = useState(0)
  const [bookingId, setBookingId] = useState('')
  const [guestToken, setGuestToken] = useState<string | null>(null)
  usePageTitle('Payment status')

  useEffect(() => {
    let cancelled = false
    if (!reference) {
      setState('failed')
      setMessage('No payment reference was provided. If you were charged, contact support with your bank reference.')
      return
    }
    // Guests are not signed in; their booking token was stashed against the
    // reference before we handed the browser to Paystack.
    const token = recallGuestToken(reference)
    setGuestToken(token)
    setState('verifying')
    verifyPayment(reference, token ?? undefined)
      .then((result) => {
        if (cancelled) return
        setAmount(result.payment?.amount ?? result.booking?.total_amount ?? 0)
        setBookingId(result.booking?.id ?? '')
        setState('success')
      })
      .catch((error: Error) => {
        if (cancelled) return
        setMessage(error.message)
        setState('failed')
      })
    return () => {
      cancelled = true
    }
  }, [reference])

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-10 text-center">
      {state === 'verifying' && (
        <>
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-midnight-900">
            <Loader2 className="h-7 w-7 animate-spin text-lime" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-semibold text-midnight-900">Verifying your payment…</h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            We are confirming the transaction directly with Paystack. This usually takes a few seconds. Do not close this
            page.
          </p>
          <div className="mt-6 flex items-center gap-1.5 rounded-full border border-midnight-900/10 bg-white px-3 py-1.5 font-mono text-[10px] text-charcoal-500">
            <ShieldCheck className="h-3 w-3 text-lime-600" /> {reference || 'Awaiting reference'}
          </div>
        </>
      )}

      {state === 'success' && (
        <>
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-lime text-midnight-900">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-semibold text-midnight-900">Payment confirmed</h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Your booking is now confirmed. Your QR code is ready and a receipt has been sent to your email.
          </p>
          {amount > 0 && (
            <div className="mt-5 w-full rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Amount paid</p>
              <p className="mt-1 font-mono text-2xl font-medium text-midnight-900">{formatNaira(amount)}</p>
              <p className="mt-1 font-mono text-[10px] text-muted">{reference}</p>
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {guestToken && bookingId ? (
              <Link to={`/book/confirmation/${bookingId}?token=${encodeURIComponent(guestToken)}`} className={buttonVariants({ size: 'lg' })}>
                View booking &amp; QR <ArrowRight className="h-4 w-4" />
              </Link>
            ) : bookingId ? (
              <Link to={`/app/bookings/${bookingId}`} className={buttonVariants({ size: 'lg' })}>
                View booking &amp; QR <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link to="/app/bookings" className={buttonVariants({ size: 'lg' })}>
                My bookings <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            {guestToken ? (
              <Link to="/" className={buttonVariants({ variant: 'outline', size: 'lg' })}>Back to EV Naija</Link>
            ) : (
              <Link to="/app" className={buttonVariants({ variant: 'outline', size: 'lg' })}>Go to dashboard</Link>
            )}
          </div>
          {guestToken && (
            <p className="mt-4 max-w-sm text-[11px] leading-relaxed text-muted">
              You booked as a guest. Set a password from your booking page to manage this booking, rebook in a tap and keep your receipts together.
            </p>
          )}
        </>
      )}

      {state === 'failed' && (
        <>
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-red-50 text-red-500">
            <XCircle className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-semibold text-midnight-900">We could not confirm this payment</h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            {message || 'The transaction may have been cancelled or is still processing.'}
          </p>
          {isPreview && (
            <div className="mt-4 flex w-full items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-[11px] leading-relaxed text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Preview mode never fakes a successful payment. Configure Supabase + Paystack to test live checkout and verification.
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {guestToken ? (
              <Link to="/" className={buttonVariants({ size: 'lg' })}>Back to EV Naija</Link>
            ) : (
              <Link to="/app/bookings" className={buttonVariants({ size: 'lg' })}>Back to bookings</Link>
            )}
            {guestToken ? (
              <Link to="/contact" className={buttonVariants({ variant: 'outline', size: 'lg' })}>Contact support</Link>
            ) : (
              <Link to="/app/support" className={buttonVariants({ variant: 'outline', size: 'lg' })}>Contact support</Link>
            )}
          </div>
          <p className="mt-4 font-mono text-[9.5px] text-muted">Reference: {reference || 'none'}</p>
        </>
      )}
    </div>
  )
}
