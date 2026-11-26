import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ShieldCheck, Wrench } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { MechanicForm } from '@/components/mechanics/MechanicForm'
import { Field, Input } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Feedback'
import { registerMechanic, type MechanicRegistrationInput } from '@/services/mechanics'
import { Logo } from '@/components/ui/Brand'

export default function RegisterMechanicPage() {
  usePageTitle('Register as an EV mechanic')
  const navigate = useNavigate()
  const { user, isPreview, enterPreview, signUpCustomer } = useAuth()
  const { success, error: toastError } = useToast()
  const [password, setPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (input: MechanicRegistrationInput) => {
    if (!user && !password) {
      toastError('Password required', 'Create a password for your account before submitting.')
      return
    }
    if (!acceptedTerms) {
      toastError('Accept the terms', 'Please accept the Terms of Service and Privacy Policy to publish a listing.')
      return
    }
    setSubmitting(true)
    try {
      if (!user) {
        const result = await signUpCustomer({
          fullName: input.ownerName,
          email: input.email,
          phone: input.phone,
          password,
        })
        if (result.error) throw new Error(result.error)
        if (isPreview) enterPreview('mechanic')
      } else if (isPreview) {
        enterPreview('mechanic')
      }
      await registerMechanic(input)
      success('Listing submitted for review', 'Our team will verify your details before your profile goes live.')
      setDone(true)
      if (isPreview) setTimeout(() => navigate('/mechanic/listing'), 400)
    } catch (error) {
      toastError('Could not submit listing', (error as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (done && !isPreview) {
    return (
      <div className="grid min-h-screen place-items-center bg-mint-50 px-4 py-16">
        <div className="max-w-md rounded-3xl border border-midnight-900/10 bg-white p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h1 className="mt-4 font-display text-2xl font-semibold text-midnight-950">Listing submitted</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Thanks for joining the EV Naija service network. Our team will review your details and email you once your
            profile is approved.
          </p>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand-700 hover:underline">
            Back to homepage <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-mint-50 py-10 lg:py-16">
      <div className="container-page max-w-4xl">
        <Link to="/" className="inline-block"><Logo /></Link>
        <div className="mt-8 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-lime/40 bg-lime/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-midnight-900">
            <Wrench className="h-3 w-3" /> EV service partner
          </span>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-midnight-950 sm:text-4xl">
            Put your EV workshop on the map
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Create a free listing, tell drivers what you can repair, and receive service requests from EV owners near you.
            Every listing is reviewed by our team before it appears in search.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Admin-verified badge</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Free to register</span>
          </div>
        </div>

        <div className="mt-8">
          <MechanicForm
            onSubmit={(input) => void submit(input)}
            submitting={submitting}
            submitLabel="Submit for review"
            showAccountFields={!user}
          >
            {!user && (
              <section className="rounded-2xl border border-lime/30 bg-lime/[0.06] p-5">
                <Field label="Create a password" required hint="At least 8 characters. Used to manage your listing later.">
                  <Input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                </Field>
              </section>
            )}
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-midnight-900/10 bg-white p-4 text-xs leading-relaxed text-muted">
              <input
                type="checkbox"
                required
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded accent-lime-600"
              />
              <span>
                I confirm the information above is accurate and I accept the{' '}
                <Link to="/legal/terms" className="font-semibold text-lime-700 hover:underline">Terms of Service</Link>{' '}
                and{' '}
                <Link to="/legal/privacy" className="font-semibold text-lime-700 hover:underline">Privacy Policy</Link>.
                I understand mechanics are independent contractors and EV Naija does not employ me or take payment for service requests.
              </span>
            </label>
          </MechanicForm>
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          Already registered? <Link to="/login" className="font-bold text-brand-700 hover:underline">Sign in to your workshop</Link>
        </p>
      </div>
    </div>
  )
}
