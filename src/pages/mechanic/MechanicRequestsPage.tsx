import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Car, CheckCheck, Mail, MessageSquare, Phone } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { getMyMechanicProfile, listMechanicRequests, updateMechanicRequestStatus } from '@/services/mechanics'
import { PageHeader } from '@/components/ui/Data'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Form'
import { EmptyState, ErrorState, Skeleton, useToast } from '@/components/ui/Feedback'
import { REQUEST_STATUS_TONE, serviceModeLabel } from '@/lib/mechanics'
import { formatDate, formatNaira } from '@/lib/utils'
import type { ServiceRequestStatus } from '@/types'

const STATUSES: ServiceRequestStatus[] = ['new', 'contacted', 'in_progress', 'completed', 'cancelled']

export default function MechanicRequestsPage() {
  usePageTitle('Service requests')
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { success, error: toastError } = useToast()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const { data: profile } = useQuery({
    queryKey: ['my-mechanic', user?.id],
    queryFn: () => getMyMechanicProfile(user?.id),
    enabled: Boolean(user?.id),
  })
  const { data: requests = [], isLoading, error, refetch } = useQuery({
    queryKey: ['mechanic-requests', profile?.id],
    queryFn: () => listMechanicRequests(profile?.id),
    enabled: Boolean(profile?.id),
  })

  const mutation = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: ServiceRequestStatus; note?: string }) =>
      updateMechanicRequestStatus(id, status, note),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mechanic-requests', profile?.id] })
      success('Request updated', 'The status has been saved.')
    },
    onError: (err: Error) => toastError('Could not update request', err.message),
  })

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}</div>
  if (error) return <ErrorState title="Could not load requests" description={(error as Error).message} onRetry={() => void refetch()} />

  return (
    <div>
      <PageHeader
        title="Service requests"
        description="Work through requests from EV owners. Contact them directly to confirm pricing and timing."
      />

      {requests.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No service requests yet"
            description="Once your listing is approved and drivers start reaching out, requests will appear here."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {requests.map((request) => (
            <article key={request.id} className="rounded-2xl border border-midnight-900/10 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-semibold text-midnight-950">{request.name}</h2>
                    <Badge tone={REQUEST_STATUS_TONE[request.status]}>{request.status}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-muted">{request.reference} · {formatDate(request.created_at)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={request.status}
                    disabled={mutation.isPending}
                    onChange={(event) => mutation.mutate({ id: request.id, status: event.target.value as ServiceRequestStatus })}
                    className="input-base h-9 w-auto py-0 text-xs"
                    aria-label={`Status for ${request.reference}`}
                  >
                    {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-xs text-muted sm:grid-cols-2 lg:grid-cols-4">
                <p className="flex items-center gap-1.5"><Car className="h-3.5 w-3.5" /> {request.vehicle_make} {request.vehicle_model}</p>
                <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {request.phone}</p>
                <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {request.email}</p>
                <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {request.preferred_date ? formatDate(request.preferred_date) : 'No preferred date'}</p>
              </div>

              <div className="mt-4 rounded-xl bg-mint-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Issue</p>
                <p className="mt-1 text-sm leading-relaxed text-midnight-900">{request.issue_description}</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><MessageSquare className="h-3.5 w-3.5" /> Preferred: {serviceModeLabel(request.service_mode)}</p>
              </div>

              {request.mechanic_notes && (
                <p className="mt-3 text-xs leading-relaxed text-muted"><span className="font-bold text-midnight-900">Your note:</span> {request.mechanic_notes}</p>
              )}

              <div className="mt-4 flex flex-wrap items-end gap-2">
                <Field label="Internal note" className="min-w-[220px] flex-1">
                  <Textarea
                    rows={2}
                    value={notes[request.id] ?? ''}
                    onChange={(event) => setNotes({ ...notes, [request.id]: event.target.value })}
                    placeholder="Add a note for yourself"
                  />
                </Field>
                <Button
                  variant="outline"
                  size="sm"
                  loading={mutation.isPending}
                  onClick={() => {
                    const note = notes[request.id]
                    if (!note?.trim()) return
                    mutation.mutate({ id: request.id, status: request.status, note })
                    setNotes({ ...notes, [request.id]: '' })
                  }}
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Save note
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {profile && profile.hourly_rate && (
        <p className="mt-5 text-xs text-muted">Your listed rate is {formatNaira(profile.hourly_rate)}/hour. Always confirm the final quote with the driver before work begins.</p>
      )}
    </div>
  )
}
