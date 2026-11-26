import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

type FormValues = z.infer<typeof schema>

export default function ResetPasswordPage() {
  usePageTitle('Choose a new password')
  const { updatePassword, isPreview } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [done, setDone] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    const { error } = await updatePassword(values.password)
    if (error) {
      toast.error('Could not update password', error)
      return
    }
    setDone(true)
    toast.success('Password updated', 'You can now sign in with your new password.')
    window.setTimeout(() => navigate('/login'), 1800)
  }

  return (
    <AuthLayout
      title="Choose a new password."
      subtitle="Use a strong password you haven't used before. Your reset link is single-use and expires after one hour."
    >
      {done ? (
        <div className="rounded-2xl border border-lime-400/50 bg-lime/10 p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-lime-700" />
          <h2 className="mt-3 font-display text-lg font-semibold text-midnight-900">Password updated</h2>
          <p className="mt-1.5 text-sm text-charcoal-600">Taking you to the sign-in page…</p>
          <Link to="/login" className="mt-4 inline-block text-xs font-semibold text-lime-700 hover:underline">
            Sign in now
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {isPreview && (
            <p className="rounded-xl border border-lime-400/40 bg-lime/10 px-3 py-2 text-[11px] leading-relaxed text-charcoal-600">
              Preview mode cannot persist password changes. Configure Supabase Auth to enable this flow.
            </p>
          )}
          <Field label="New password" error={errors.password?.message} required>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="New password"
                className="pl-10 pr-11"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-charcoal-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <Field label="Confirm new password" error={errors.confirmPassword?.message} required>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Repeat new password"
                className="pl-10"
                {...register('confirmPassword')}
              />
            </div>
          </Field>
          <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
            Update password
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
