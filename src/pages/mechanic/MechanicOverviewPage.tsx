import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, BadgeCheck, CalendarCheck, ClipboardCheck, Eye, Star, Wrench } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { getMyMechanicProfile, listMechanicRequests } from '@/services/mechanics'
import { MECHANIC_STATUS_TONE, serviceTypeLabel } from '@/lib/mechanics'
import { PageHeader } from '@/components/ui/Data'
import { Badge } from '@/components/ui/Badge'
import { Button, buttonVariants } from '@/components/ui/Button'
import { ErrorState, Skeleton } from '@/components/ui/Feedback'
import { formatDate, formatNaira } from '@/lib/utils'

export default function MechanicOverviewPage() {
  usePageTitle('Workshop overview')
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: profile, isLoading, error, refetch } = useQuery({
    queryKey: ['my-mechanic', user?.id],
    queryFn: () => getMyMechanicProfile(user?.id),
    enabled: Boolean(user?.id),
  })
  const { data: requests = [] } = useQuery({
    queryKey: ['mechanic-requests', profile?.id],
    queryFn: () => listMechanicRequests(profile?.id),
    enabled: Boolean(profile?.id),
  })

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>
  if (error) return <ErrorState title="Could not load your workshop" description={(error as Error).message} onRetry={() => void refetch()} />

  if (!profile) {
    return (
      <div>
        <PageHeader title="Welcome to the service network" description="Create your mechanic listing to start receiving service requests from EV owners." />
        <div className="mt-6 rounded-2xl border border-lime/30 bg-lime/[0.07] p-8 text-center">
          <Wrench className="mx-auto h-10 w-10 text-midnight-900" />
          <h2 className="mt-3 font-display text-xl font-semibold text-midnight-950">Set up your workshop profile</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Add your specialities, location and contact details. Your listing is reviewed before it appears in public search.
          </p>
          <Link to="/register/mechanic" className={`${buttonVariants()} mt-5 inline-flex`}>
            Create listing <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    )
  }

  const pending = requests.filter((request) => request.status === 'new').length
  const active = requests.filter((request) => request.status === 'in_progress' || request.status === 'contacted').length
  const completed = requests.filter((request) => request.status === 'completed').length

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${profile.owner_name.split(' ')[0]}`}
        description="Here's what's happening with your EV service listing."
        actions={
          <Link to={`/mechanics/${profile.id}`} className="inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:underline">
            View public profile <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="mt-6 rounded-2xl border border-midnight-900/10 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-mint-100 text-midnight-900"><Wrench className="h-5 w-5" /></span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-semibold text-midnight-950">{profile.business_name}</h2>
                <Badge tone={MECHANIC_STATUS_TONE[profile.status]}>{profile.status}</Badge>
                {profile.is_verified && <Badge tone="success"><BadgeCheck className="h-3 w-3" /> Verified</Badge>}
              </div>
              <p className="text-xs text-muted">{profile.city}, {profile.state} · {profile.service_types.length} specialities</p>
            </div>
          </div>
          <Link to="/mechanic/listing" className={buttonVariants({ variant: 'outline', size: 'sm' })}>Edit listing</Link>
        </div>
        {profile.status === 'pending' && (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
            Your listing is awaiting admin review. You can edit it now, but it will not appear in public search until approved.
          </p>
        )}
        {profile.status === 'rejected' && profile.rejection_reason && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-700">
            Review feedback: {profile.rejection_reason}. Update your listing and use the form on the listing page to resubmit.
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'New requests', value: pending, icon: ClipboardCheck, to: '/mechanic/requests' },
          { label: 'Active jobs', value: active, icon: CalendarCheck, to: '/mechanic/requests' },
          { label: 'Completed', value: completed, icon: BadgeCheck, to: '/mechanic/requests' },
          { label: 'Rating', value: profile.rating_average.toFixed(1), icon: Star, to: `/mechanics/${profile.id}` },
        ].map((stat) => (
          <Link key={stat.label} to={stat.to} className="rounded-2xl border border-midnight-900/10 bg-white p-5 transition-shadow hover:shadow-card">
            <stat.icon className="h-5 w-5 text-brand-700" />
            <p className="mt-3 font-display text-2xl font-semibold text-midnight-950">{stat.value}</p>
            <p className="text-xs text-muted">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-midnight-900/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-midnight-950">Latest service requests</h2>
            <Link to="/mechanic/requests" className="text-xs font-bold text-brand-700 hover:underline">View all</Link>
          </div>
          {requests.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No service requests yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {requests.slice(0, 4).map((request) => (
                <div key={request.id} className="rounded-xl border border-midnight-900/5 bg-mint-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-midnight-950">{request.name}</p>
                    <Badge tone={request.status === 'new' ? 'info' : request.status === 'completed' ? 'success' : 'warning'}>{request.status}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-muted">{request.vehicle_make} {request.vehicle_model} · {request.issue_description}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted">{request.reference} · {formatDate(request.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-midnight-900/10 bg-white p-5">
          <h2 className="font-display text-base font-semibold text-midnight-950">Your public listing</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3"><span className="text-muted">Hourly rate</span><span className="font-semibold text-midnight-950">{profile.hourly_rate ? formatNaira(profile.hourly_rate) : 'Quote on request'}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted">Service modes</span><span className="text-right font-semibold text-midnight-950">{profile.service_modes.join(', ')}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted">Emergency callout</span><span className="font-semibold text-midnight-950">{profile.emergency_available ? 'Yes' : 'No'}</span></div>
            <div className="mt-2 border-t border-midnight-900/5 pt-3">
              <p className="text-muted">Specialities</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {profile.service_types.map((type) => <Badge key={type} tone="neutral">{serviceTypeLabel(type)}</Badge>)}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" className="mt-5 w-full" onClick={() => void queryClient.invalidateQueries({ queryKey: ['mechanics'] })}>
            Refresh listing data
          </Button>
        </section>
      </div>
    </div>
  )
}
