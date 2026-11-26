import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BadgeCheck, CheckCircle2, MapPin, PauseCircle, Search, Star, Wrench, XCircle } from 'lucide-react'
import { listAllMechanics, listMechanicRequests, setMechanicStatusAdmin } from '@/services/mechanics'
import { writeAuditLog } from '@/services/admin'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { Mechanic } from '@/types'
import { PageHeader } from '@/components/ui/Data'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Feedback'
import { MECHANIC_STATUS_TONE, serviceTypeLabel } from '@/lib/mechanics'
import { formatDate, formatNaira } from '@/lib/utils'

export default function AdminMechanicsPage() {
  usePageTitle('EV mechanics')
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [reason, setReason] = useState<Record<string, string>>({})
  const [workingId, setWorkingId] = useState<string | null>(null)

  const { data: mechanics = [], isLoading, error, refetch } = useQuery({
    queryKey: ['admin-mechanics'],
    queryFn: listAllMechanics,
  })
  const { data: requests = [] } = useQuery({
    queryKey: ['admin-mechanic-requests'],
    queryFn: () => listMechanicRequests(),
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return mechanics.filter((mechanic) => {
      const matchesStatus = status === 'all' || mechanic.status === status
      const matchesSearch = !term ||
        mechanic.business_name.toLowerCase().includes(term) ||
        mechanic.owner_name.toLowerCase().includes(term) ||
        mechanic.city.toLowerCase().includes(term) ||
        mechanic.email.toLowerCase().includes(term)
      return matchesStatus && matchesSearch
    })
  }, [mechanics, search, status])

  const mutation = useMutation({
    mutationFn: async ({
      mechanic,
      nextStatus,
      featured,
      verified,
      note,
    }: {
      mechanic: Mechanic
      nextStatus: Mechanic['status']
      featured?: boolean
      verified?: boolean
      note?: string
    }) => {
      setWorkingId(mechanic.id)
      await setMechanicStatusAdmin(mechanic.id, nextStatus, featured, verified, note)
      if (user) {
        await writeAuditLog(
          user.id,
          `mechanic.${nextStatus}`,
          'mechanic',
          mechanic.id,
          { businessName: mechanic.business_name, previousStatus: mechanic.status, note },
        )
      }
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-mechanics'] })
      await queryClient.invalidateQueries({ queryKey: ['mechanics'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
      toast.success('Mechanic updated', `${variables.mechanic.business_name} is now ${variables.nextStatus}.`)
      setWorkingId(null)
    },
    onError: (err: Error) => {
      toast.error('Could not update mechanic', err.message)
      setWorkingId(null)
    },
  })

  const pendingCount = mechanics.filter((mechanic) => mechanic.status === 'pending').length
  const approvedCount = mechanics.filter((mechanic) => mechanic.status === 'approved').length

  return (
    <div>
      <PageHeader
        title="EV mechanics"
        description="Review mechanic registrations, verify credentials and manage the public service directory."
        actions={
          <Link to="/mechanics" target="_blank" className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:underline">
            View public directory <Wrench className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Awaiting review', value: pendingCount, icon: Search },
          { label: 'Approved listings', value: approvedCount, icon: BadgeCheck },
          { label: 'Service requests', value: requests.length, icon: Wrench },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-midnight-900/10 bg-white p-5">
            <card.icon className="h-5 w-5 text-brand-700" />
            <p className="mt-3 font-display text-2xl font-semibold text-midnight-950">{card.value}</p>
            <p className="text-xs text-muted">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-midnight-900/10 bg-white p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, owner, city or email" />
        </div>
        <select className="input-base w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="mt-6 space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted">Loading mechanics…</p>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-700">{(error as Error).message}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>Retry</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-midnight-900/10 bg-white/60 p-10 text-center text-sm text-muted">
            No mechanics match your filters.
          </div>
        ) : (
          filtered.map((mechanic) => {
            const mechanicRequestCount = requests.filter((request) => request.mechanic_id === mechanic.id).length
            return (
              <article key={mechanic.id} className="rounded-2xl border border-midnight-900/10 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint-100 text-midnight-900"><Wrench className="h-5 w-5" /></span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-base font-semibold text-midnight-950">{mechanic.business_name}</h2>
                        <Badge tone={MECHANIC_STATUS_TONE[mechanic.status]}>{mechanic.status}</Badge>
                        {mechanic.is_verified && <Badge tone="success"><BadgeCheck className="h-3 w-3" /> Verified</Badge>}
                        {mechanic.is_featured && <Badge tone="lime"><Star className="h-3 w-3" /> Featured</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {mechanic.owner_name} · {mechanic.email} · {mechanic.phone}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted"><MapPin className="h-3.5 w-3.5" /> {mechanic.address}, {mechanic.city}, {mechanic.state}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted">
                    <p>{mechanic.years_experience} yrs exp.</p>
                    <p>{mechanicRequestCount} service requests</p>
                    <p>{formatDate(mechanic.created_at)}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {mechanic.service_types.map((type) => <Badge key={type} tone="neutral">{serviceTypeLabel(type)}</Badge>)}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                  <span>Rate: {mechanic.hourly_rate ? `${formatNaira(mechanic.hourly_rate)}/hr` : 'On request'}</span>
                  <span>Rating: <Star className="inline h-3 w-3 fill-amber-400 text-amber-400" /> {mechanic.rating_average.toFixed(1)} ({mechanic.rating_count})</span>
                  <span>Modes: {mechanic.service_modes.join(', ')}</span>
                </div>
                {mechanic.description && <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted">{mechanic.description}</p>}
                {mechanic.rejection_reason && (
                  <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">Reason: {mechanic.rejection_reason}</p>
                )}
                {mechanic.certifications.length > 0 && (
                  <p className="mt-3 text-xs text-muted">Certifications: {mechanic.certifications.join(' · ')}</p>
                )}

                <div className="mt-5 border-t border-midnight-900/5 pt-4">
                  <Textarea
                    rows={2}
                    value={reason[mechanic.id] ?? ''}
                    onChange={(e) => setReason({ ...reason, [mechanic.id]: e.target.value })}
                    placeholder="Optional review note (shown when rejecting)"
                    className="max-w-xl"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {mechanic.status !== 'approved' && (
                      <Button
                        size="sm"
                        loading={workingId === mechanic.id}
                        onClick={() => mutation.mutate({
                          mechanic,
                          nextStatus: 'approved',
                          verified: true,
                          note: reason[mechanic.id],
                        })}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve &amp; verify
                      </Button>
                    )}
                    {mechanic.status !== 'rejected' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!reason[mechanic.id]?.trim()}
                        loading={workingId === mechanic.id}
                        onClick={() => mutation.mutate({
                          mechanic,
                          nextStatus: 'rejected',
                          note: reason[mechanic.id],
                        })}
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                    )}
                    {mechanic.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={workingId === mechanic.id}
                        onClick={() => mutation.mutate({ mechanic, nextStatus: 'suspended' })}
                      >
                        <PauseCircle className="h-3.5 w-3.5" /> Suspend
                      </Button>
                    )}
                    {mechanic.status === 'suspended' && (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={workingId === mechanic.id}
                        onClick={() => mutation.mutate({ mechanic, nextStatus: 'approved' })}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Reinstate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={workingId === mechanic.id}
                      onClick={() => mutation.mutate({
                        mechanic,
                        nextStatus: mechanic.status,
                        featured: !mechanic.is_featured,
                      })}
                    >
                      <Star className="h-3.5 w-3.5" /> {mechanic.is_featured ? 'Unfeature' : 'Feature'}
                    </Button>
                    {mechanic.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={workingId === mechanic.id}
                        onClick={() => mutation.mutate({
                          mechanic,
                          nextStatus: mechanic.status,
                          verified: !mechanic.is_verified,
                        })}
                      >
                        <BadgeCheck className="h-3.5 w-3.5" /> {mechanic.is_verified ? 'Remove verify' : 'Verify'}
                      </Button>
                    )}
                    <Link to={`/mechanics/${mechanic.id}`} target="_blank" className="ml-auto text-xs font-bold text-brand-700 hover:underline">
                      View profile
                    </Link>
                  </div>
                </div>
              </article>
            )
          })
        )}
      </div>
    </div>
  )
}
