import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Building2, Check, Eye, EyeOff, FileText, Lock, Mail, MapPin, Phone, User } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { dashboardPath } from '@/lib/roles'

const schema = z
  .object({
    businessName: z.string().min(2, 'Enter your registered business name'),
    ownerName: z.string().min(3, 'Enter the owner or director name'),
    email: z.string().email('Enter a valid business email'),
    phone: z
      .string()
      .min(10, 'Enter a valid Nigerian phone number')
      .regex(/^(\+?234|0)[789][01]\d{8}$/, 'Use a Nigerian mobile number, e.g. 0803 123 4567'),
    businessAddress: z.string().min(8, 'Enter the full business address'),
    registrationNumber: z.string().optional(),
    businessDescription: z.string().min(30, 'Tell drivers about your charging business (30+ characters)'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string(),
    terms: z.literal(true, { message: 'Accept the partner terms to continue' }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

type FormValues = z.infer<typeof schema>

const BENEFITS = [
  'A verified listing in front of paying EV drivers',
  'Real-time bookings, availability and revenue',
  'Automated commission, ledger and bank payouts',
  'Dedicated onboarding and operator support',
]

export default function RegisterOperatorPage() {
  usePageTitle('Become a charging partner')
  const { user, signUpOperator, isPreview } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (user) return <Navigate to={dashboardPath(user.roles)} replace />

  const onSubmit = async (values: FormValues) => {
    const { error, needsVerification } = await signUpOperator({
      businessName: values.businessName,
      ownerName: values.ownerName,
      email: values.email,
      phone: values.phone,
      businessAddress: values.businessAddress,
      registrationNumber: values.registrationNumber,
      businessDescription: values.businessDescription,
      password: values.password,
    })
    if (error) {
      toast.error('Could not submit your application', error)
      return
    }
    toast.success('Application received', 'Your operator workspace is ready.')
    if (needsVerification) {
      navigate(`/verify-email?email=${encodeURIComponent(values.email)}&role=operator`)
      return
    }
    navigate('/operator')
  }

  return (
    <AuthLayout
      title="Become a charging partner."
      subtitle="List your station, receive paid bookings and grow revenue with Nigeria's premium EV charging marketplace."
      mode="operator"
      image="https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1400&q=80"
    >
      <div className="mb-6 grid gap-2 rounded-2xl border border-midnight-900/[0.07] bg-mint-50 p-4">
        {BENEFITS.map((benefit) => (
          <p key={benefit} className="flex items-start gap-2 text-[12px] leading-relaxed text-charcoal-600">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-lime text-midnight-900">
              <Check className="h-2.5 w-2.5" />
            </span>
            {benefit}
          </p>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" error={errors.businessName?.message} required>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input placeholder="GreenDrive Energy Ltd" className="pl-10" {...register('businessName')} />
            </div>
          </Field>
          <Field label="Owner / director" error={errors.ownerName?.message} required>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input placeholder="Emeka Nwosu" className="pl-10" {...register('ownerName')} />
            </div>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business email" error={errors.email?.message} required>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input type="email" autoComplete="email" placeholder="you@business.ng" className="pl-10" {...register('email')} />
            </div>
          </Field>
          <Field label="Phone number" error={errors.phone?.message} required>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input type="tel" placeholder="0803 123 4567" className="pl-10" {...register('phone')} />
            </div>
          </Field>
        </div>

        <Field label="Business address" error={errors.businessAddress?.message} required>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted" />
            <Input placeholder="18 Adeola Odeku Street, Victoria Island, Lagos" className="pl-10" {...register('businessAddress')} />
          </div>
        </Field>

        <Field
          label="CAC registration number"
          hint="Optional at sign-up — required during station verification."
          error={errors.registrationNumber?.message}
        >
          <div className="relative">
            <FileText className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input placeholder="RC 1847293" className="pl-10" {...register('registrationNumber')} />
          </div>
        </Field>

        <Field label="About your business" error={errors.businessDescription?.message} required>
          <Textarea
            placeholder="Describe your charging locations, equipment and the drivers you serve."
            {...register('businessDescription')}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" error={errors.password?.message} required>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Create a password"
                className="pl-10 pr-10"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-charcoal-700"
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
                placeholder="Repeat password"
                className="pl-10"
                {...register('confirmPassword')}
              />
            </div>
          </Field>
        </div>

        <div>
          <label className="flex items-start gap-2.5 text-xs leading-relaxed text-charcoal-600">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded accent-lime-600" {...register('terms')} />
            <span>
              I accept the{' '}
              <Link to="/legal/terms" className="font-semibold text-lime-700 hover:underline">partner terms</Link>{' '}
              and confirm I am authorised to list the stations I submit.
            </span>
          </label>
          {errors.terms && <p className="mt-1.5 text-xs font-medium text-red-500">{errors.terms.message}</p>}
        </div>

        <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
          Submit partner application <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      {isPreview && (
        <p className="mt-4 rounded-xl border border-lime-400/40 bg-lime/10 px-3 py-2 text-[11px] leading-relaxed text-charcoal-600">
          Preview mode: this signs you into the demo operator workspace immediately. Real applications enter the admin
          verification queue.
        </p>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        Already a partner?{' '}
        <Link to="/login" className="font-semibold text-midnight-900 hover:text-lime-700">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
