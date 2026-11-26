import { CheckCircle2, MailCheck, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { isPreviewMode } from '@/lib/env'
import { supabase } from '@/lib/supabase'

export default function VerifyEmailPage() {
  usePageTitle('Verify your email')
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  const role = params.get('role') === 'operator' ? 'operator' : 'customer'
  const { user } = useAuth()
  const toast = useToast()
  const [resending, setResending] = useState(false)

  const resend = async () => {
    if (!supabase || !email) {
      toast.info('Resend unavailable', 'Add your email address or configure Supabase Auth.')
      return
    }
    setResending(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setResending(false)
    if (error) {
      toast.error('Could not resend email', error.message)
      return
    }
    toast.success('Email sent', `Check ${email} for a fresh verification link.`)
  }

  return (
    <AuthLayout
      title="Verify your email."
      subtitle="One quick step to secure your account and activate your EV Naija workspace."
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-midnight-900/[0.07] bg-mint-50 p-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-midnight-900 text-lime">
            <MailCheck className="h-6 w-6" />
          </span>
          <h2 className="mt-4 font-display text-lg font-semibold text-midnight-900">Check your inbox</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-charcoal-600">
            We sent a verification link{email ? <> to <span className="font-semibold text-midnight-900">{email}</span></> : null}.
            Click it to {role === 'operator' ? 'activate your operator workspace' : 'activate your driver account'}.
          </p>
        </div>

        <ul className="space-y-2 text-xs text-charcoal-600">
          {[
            'The link expires after 24 hours.',
            'Check spam or promotions if you do not see it.',
            'You can sign in after verifying your email.',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-600" />
              {item}
            </li>
          ))}
        </ul>

        {isPreviewMode && (
          <p className="rounded-xl border border-lime-400/40 bg-lime/10 px-3 py-2 text-[11px] leading-relaxed text-charcoal-600">
            Preview mode does not send email. Demo accounts are already verified —{' '}
            <Link to="/login" className="font-semibold text-lime-700 hover:underline">sign in here</Link>.
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => void resend()} loading={resending} variant="outline" className="flex-1">
            <RefreshCw className="h-4 w-4" /> Resend email
          </Button>
          <Link
            to={user ? (role === 'operator' ? '/operator' : '/app') : '/login'}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-midnight-900 px-5 text-sm font-semibold text-white transition hover:bg-midnight-800"
          >
            Continue to sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  )
}
