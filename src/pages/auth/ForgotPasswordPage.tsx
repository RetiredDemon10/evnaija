import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Mail, Send } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'

const schema = z.object({ email: z.string().email('Enter a valid email address') })
type FormValues = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  usePageTitle('Reset your password')
  const { resetPassword, isPreview } = useAuth()
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    const { error } = await resetPassword(values.email)
    if (error) {
      setServerError(error)
      return
    }
    setSent(true)
  }

  return (
    <AuthLayout
      title="Reset your password."
      subtitle="Enter the email on your account and we'll send a secure link to choose a new password."
    >
      {sent ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-lime-400/50 bg-lime/10 p-5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-lime text-midnight-900">
              <Send className="h-5 w-5" />
            </span>
            <h2 className="mt-4 font-display text-lg font-semibold text-midnight-900">Check your inbox</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-charcoal-600">
              If an EV Naija account exists for <span className="font-semibold text-midnight-900">{getValues('email')}</span>,
              a reset link is on its way. The link expires in one hour.
            </p>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Didn't receive it? Check your spam folder, or{' '}
            <button onClick={() => setSent(false)} className="font-semibold text-lime-700 hover:underline">
              try another email
            </button>
            .
          </p>
          <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-semibold text-midnight-900 hover:text-lime-700">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Email address" error={errors.email?.message} required>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input type="email" autoComplete="email" placeholder="you@example.com" className="pl-10" {...register('email')} />
            </div>
          </Field>

          {serverError && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
              {serverError}
            </p>
          )}
          {isPreview && (
            <p className="rounded-xl border border-lime-400/40 bg-lime/10 px-3 py-2 text-[11px] leading-relaxed text-charcoal-600">
              Preview mode has no email backend, so reset links cannot be sent. Connect Supabase Auth to enable this flow.
            </p>
          )}

          <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
            Send reset link
          </Button>
          <Link to="/login" className="flex items-center justify-center gap-1.5 text-xs font-semibold text-charcoal-600 hover:text-midnight-900">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </Link>
        </form>
      )}
    </AuthLayout>
  )
}
