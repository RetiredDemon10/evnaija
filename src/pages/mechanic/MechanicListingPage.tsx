import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, FileWarning } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { getMyMechanicProfile, registerMechanic } from '@/services/mechanics'
import { MechanicForm } from '@/components/mechanics/MechanicForm'
import { PageHeader } from '@/components/ui/Data'
import { Badge } from '@/components/ui/Badge'
import { ErrorState, PageLoader, useToast } from '@/components/ui/Feedback'
import { MECHANIC_STATUS_TONE } from '@/lib/mechanics'
import type { MechanicRegistrationInput } from '@/services/mechanics'

export default function MechanicListingPage() {
  usePageTitle('My workshop listing')
  const { user, isPreview, enterPreview } = useAuth()
  const queryClient = useQueryClient()
  const { success, error: toastError } = useToast()
  const [saved, setSaved] = useState(false)
  const { data: profile, isLoading, error, refetch } = useQuery({
    queryKey: ['my-mechanic', user?.id],
    queryFn: () => getMyMechanicProfile(user?.id),
    enabled: Boolean(user?.id),
  })

  const mutation = useMutation({
    mutationFn: (input: MechanicRegistrationInput) => registerMechanic(input),
    onSuccess: async () => {
      if (isPreview) enterPreview('mechanic')
      await queryClient.invalidateQueries({ queryKey: ['my-mechanic', user?.id] })
      await queryClient.invalidateQueries({ queryKey: ['mechanics'] })
      setSaved(true)
      success('Listing saved', 'Your changes have been submitted for review.')
    },
    onError: (err: Error) => toastError('Could not save listing', err.message),
  })

  if (isLoading) return <PageLoader label="Loading listing" />
  if (error) return <ErrorState title="Could not load your listing" description={(error as Error).message} onRetry={() => void refetch()} />

  return (
    <div>
      <PageHeader
        title="My workshop listing"
        description="Keep your specialities, pricing and contact details accurate so drivers know what to expect."
        actions={
          profile && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={MECHANIC_STATUS_TONE[profile.status]}>{profile.status}</Badge>
              {profile.status === 'approved' && (
                <Link to={`/mechanics/${profile.id}`} target="_blank" className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline">
                  View public page <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          )
        }
      />

      {profile?.status === 'rejected' && profile.rejection_reason && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <h2 className="font-display text-sm font-semibold text-red-800">Review feedback</h2>
              <p className="mt-1 text-sm leading-relaxed text-red-700">{profile.rejection_reason}</p>
              <p className="mt-2 text-xs text-red-600">
                Update the details below and press “Save &amp; resubmit” to send your listing back for review.
              </p>
            </div>
          </div>
        </div>
      )}

      {saved && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Your listing was saved. Changes to verified fields are reviewed by the EV Naija team before going live.
        </div>
      )}

      <div className="mt-6 max-w-4xl">
        <MechanicForm
          mechanic={profile}
          submitting={mutation.isPending}
          submitLabel={profile?.status === 'rejected' ? 'Save & resubmit' : 'Save listing'}
          onSubmit={(input) => mutation.mutate(input)}
        />
      </div>
    </div>
  )
}
