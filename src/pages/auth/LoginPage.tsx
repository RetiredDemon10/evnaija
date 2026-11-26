import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { demoCredentials } from '@/data/demo'
import { dashboardPath } from '@/lib/roles'
import { useSeo } from '@/hooks/usePageTitle'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  useSeo({ title: 'Sign in' })
  const { signIn, user, isPreview } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const toast = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const redirect = params.get('redirect')

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })

  useEffect(() => {
    if (user && submitted) {
      navigate(redirect ?? dashboardPath(user.roles), { replace: true })
    }
  }, [user, submitted, navigate, redirect])

  useEffect(() => {
    if (user && !submitted) {
      navigate(dashboardPath(user.roles), { replace: true })
    }
  }, [user, submitted, navigate])

  const onSubmit = async (values: FormValues) => {
    const { error } = await signIn(values.email, values.password)
    if (error) {
      toast.error('Sign in failed', error)
      return
    }
    setSubmitted(true)
    toast.success('Welcome back', 'Taking you to your dashboard…')
  }

  const quickSignIn = async (email: string, password: string) => {
    setValue('email', email)
    setValue('password', password)
    const { error } = await signIn(email, password)
    if (error) {
      toast.error('Sign in failed', error)
      return
    }
    setSubmitted(true)
  }

  return (
    <AuthLayout
      title="Welcome back."
      subtitle="Sign in to manage your bookings, vehicles and charging history."
      image="https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=1400&q=80"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Email address" error={errors.email?.message} required>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input type="email" autoComplete="email" placeholder="you@example.com" className="pl-10" {...register('email')} />
          </div>
        </Field>
        <Field label="Password" error={errors.password?.message} required>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Your password"
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
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-charcoal-600">
            <input type="checkbox" defaultChecked className="h-3.5 w-3.5 rounded accent-lime-600" />
            Keep me signed in
          </label>
          <Link to="/forgot-password" className="text-xs font-semibold text-lime-700 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
          Sign in to EV Naija
        </Button>
      </form>

      {isPreview && (
        <div className="mt-7 rounded-2xl border border-lime-400/40 bg-lime/10 p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-midnight-700">Preview accounts</p>
          <p className="mt-1 text-[11px] leading-relaxed text-charcoal-500">
            Click a role to explore that portal. Password for all demo accounts is{' '}
            <code className="font-mono text-midnight-900">Demo1234!</code>.
          </p>
          <div className="mt-3 grid gap-1.5">
            {demoCredentials.map((credential) => (
              <button
                key={credential.role}
                type="button"
                onClick={() => void quickSignIn(credential.email, credential.password)}
                className="flex items-center justify-between rounded-xl border border-midnight-900/10 bg-white px-3 py-2 text-left transition hover:border-lime-400 hover:shadow-sm"
              >
                <span>
                  <span className="block text-[11px] font-semibold capitalize text-midnight-900">{credential.role}</span>
                  <span className="font-mono text-[9.5px] text-muted">{credential.email}</span>
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-lime-700">Use</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-7 text-center text-sm text-muted">
        New to EV Naija?{' '}
        <Link to="/register" className="font-semibold text-midnight-900 hover:text-lime-700">
          Create an account
        </Link>
      </p>
      <div className="mt-3 flex items-center justify-center gap-1 text-[11px] text-muted">
        Own a charging station?
        <Link to="/register/operator" className="font-semibold text-lime-700 hover:underline">
          Become a partner
        </Link>
      </div>
    </AuthLayout>
  )
}
