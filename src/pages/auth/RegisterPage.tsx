import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Check, Eye, EyeOff, Lock, Mail, Phone, Sparkles, User } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { dashboardPath } from '@/lib/roles'

const schema = z
  .object({
    fullName: z.string().min(3, 'Enter your full name'),
    email: z.string().email('Enter a valid email address'),
    phone: z
      .string()
      .min(10, 'Enter a valid Nigerian phone number')
      .regex(/^(\+?234|0)[789][01]\d{8}$/, 'Use a Nigerian mobile number, e.g. 0803 123 4567'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string(),
    terms: z.literal(true, { message: 'Accept the terms to continue' }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

type FormValues = z.infer<typeof schema>

export default function RegisterPage() {
  usePageTitle('Create your account')
  const { user, signUpCustomer, isPreview } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const referralCode = searchParams.get('ref')?.trim().toUpperCase() ?? ''

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', email: '', phone: '', password: '', confirmPassword: '' },
  })

  if (user) return <Navigate to={dashboardPath(user.roles)} replace />

  const onSubmit = async (values: FormValues) => {
    const { error, needsVerification } = await signUpCustomer({
      fullName: values.fullName,
      email: values.email,
      phone: values.phone,
      password: values.password,
      referralCode: referralCode || null,
    })
    if (error) {
      toast.error('Could not create your account', error)
      return
    }
    toast.success('Account created', referralCode ? 'Your welcome bonus will arrive after your first charge.' : 'Welcome to EV Naija.')
    if (needsVerification) {
      navigate(`/verify-email?email=${encodeURIComponent(values.email)}`)
      return
    }
    navigate('/app')
  }

  return (
    <AuthLayout
      title="Create your free account."
      subtitle="Book verified chargers, manage your vehicles and keep every receipt in one place."
      image="https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=1400&q=80"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {referralCode && (
          <div className="flex items-start gap-2.5 rounded-xl border border-lime-400/50 bg-lime/15 px-3.5 py-3 text-[12px] leading-relaxed text-charcoal-700">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-lime-700" />
            <span>
              You were invited with code <span className="font-mono font-semibold text-midnight-900">{referralCode}</span>. Complete your first
              charge to unlock your welcome bonus points.
            </span>
          </div>
        )}
        <Field label="Full name" error={errors.fullName?.message} required>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input autoComplete="name" placeholder="Adaeze Okafor" className="pl-10" {...register('fullName')} />
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email address" error={errors.email?.message} required>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input type="email" autoComplete="email" placeholder="you@example.com" className="pl-10" {...register('email')} />
            </div>
          </Field>
          <Field label="Phone number" error={errors.phone?.message} required>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input type="tel" autoComplete="tel" placeholder="0803 123 4567" className="pl-10" {...register('phone')} />
            </div>
          </Field>
        </div>

        <Field
          label="Password"
          error={errors.password?.message}
          hint="At least 8 characters with an uppercase letter and a number."
          required
        >
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Create a strong password"
              className="pl-10 pr-11"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted transition hover:text-charcoal-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <Field label="Confirm password" error={errors.confirmPassword?.message} required>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Repeat your password"
              className="pl-10"
              {...register('confirmPassword')}
            />
          </div>
        </Field>

        <div>
          <label className="flex items-start gap-2.5 text-xs leading-relaxed text-charcoal-600">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded accent-lime-600" {...register('terms')} />
            <span>
              I agree to the{' '}
              <Link to="/legal/terms" className="font-semibold text-lime-700 hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/legal/privacy" className="font-semibold text-lime-700 hover:underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {errors.terms && <p className="mt-1.5 text-xs font-medium text-red-500">{errors.terms.message}</p>}
        </div>

        <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
          Create account <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      {isPreview && (
        <p className="mt-4 rounded-xl border border-lime-400/40 bg-lime/10 px-3 py-2 text-[11px] leading-relaxed text-charcoal-600">
          Preview mode: creating an account signs you into the sample customer workspace immediately. No email is sent.
        </p>
      )}

      <div className="mt-6 flex items-center gap-2 text-[11px] text-muted">
        <Check className="h-3.5 w-3.5 text-lime-600" /> No card required. Pay only when you book a charge.
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-midnight-900 hover:text-lime-700">
          Sign in
        </Link>
      </p>
      <p className="mt-2 text-center text-[11px] text-muted">
        Own charging infrastructure?{' '}
        <Link to="/register/operator" className="font-semibold text-lime-700 hover:underline">
          Become a charging partner
        </Link>
      </p>
    </AuthLayout>
  )
}
