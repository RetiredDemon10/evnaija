import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CheckCircle2, KeyRound, Search, ShieldCheck, Terminal, UserCog, Users } from 'lucide-react'
import { listAdminUsers, setCustomerSuspended, writeAuditLog } from '@/services/admin'
import type { AdminTeamMember } from '@/types'
import { PageHeader, DataTable, Tabs, type Column } from '@/components/ui/Data'
import { Avatar } from '@/components/ui/Brand'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Field, Textarea } from '@/components/ui/Form'
import { Button } from '@/components/ui/Button'
import { ExportButton, TableEmpty } from '@/components/dashboard/Kit'
import { PageLoader, useToast } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate } from '@/lib/utils'

type Filter = 'all' | 'admin' | 'operator'

export default function AdminUsersPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState<AdminTeamMember | null>(null)
  const [reason, setReason] = useState('')
  const [working, setWorking] = useState(false)
  usePageTitle('Admin users')

  const { data: team = [], isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: listAdminUsers })

  const counts = useMemo(
    () => ({
      all: team.length,
      admin: team.filter((member) => member.role === 'admin').length,
      operator: team.filter((member) => member.role === 'operator').length,
      suspended: team.filter((member) => member.is_suspended).length,
    }),
    [team],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return team.filter((member) => {
      const matchesFilter = filter === 'all' || member.role === filter
      const matchesSearch =
        !term || member.full_name.toLowerCase().includes(term) || member.email.toLowerCase().includes(term)
      return matchesFilter && matchesSearch
    })
  }, [team, filter, search])

  const toggle = async () => {
    if (!target) return
    const next = !target.is_suspended
    if (next && reason.trim().length < 6) {
      toast.error('Add a reason', 'Every suspension needs an audit note.')
      return
    }
    setWorking(true)
    try {
      await setCustomerSuspended(target.id, next, next ? reason.trim() : undefined)
      if (user) {
        await writeAuditLog(user.id, next ? 'team.suspended' : 'team.reinstated', 'profile', target.id, {
          email: target.email,
          role: target.role,
          reason: next ? reason.trim() : undefined,
        })
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
      toast.success(next ? 'Account suspended' : 'Account reinstated', target.email)
      setTarget(null)
      setReason('')
    } catch (error) {
      toast.error('Could not update account', (error as Error).message)
    } finally {
      setWorking(false)
    }
  }

  const columns: Column<AdminTeamMember>[] = [
    {
      key: 'member',
      header: 'Account',
      render: (member) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={member.full_name} src={member.avatar_url} size={34} />
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[12px] font-semibold text-midnight-900">{member.full_name}</p>
              {member.id === user?.id && <Badge tone="lime">You</Badge>}
            </div>
            <p className="text-[9.5px] text-muted">{member.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (member) => (
        <Badge tone={member.role === 'admin' ? 'lime' : 'neutral'}>
          {member.role === 'admin' ? <ShieldCheck className="h-2.5 w-2.5" /> : <UserCog className="h-2.5 w-2.5" />}
          {member.role}
        </Badge>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (member) => <span className="text-[10.5px] text-charcoal-600">{member.phone ?? '—'}</span>,
    },
    {
      key: 'joined',
      header: 'Joined',
      render: (member) => <span className="text-[10px] text-muted">{formatDate(member.created_at)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (member) => <Badge tone={member.is_suspended ? 'danger' : 'success'}>{member.is_suspended ? 'Suspended' : 'Active'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (member) => (
        <div className="flex justify-end">
          <button
            disabled={member.id === user?.id}
            onClick={() => {
              setTarget(member)
              setReason('')
            }}
            className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
              member.is_suspended ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-red-50 text-red-600 hover:bg-red-100'
            }`}
          >
            {member.is_suspended ? (
              <>
                <CheckCircle2 className="h-3 w-3" /> Reinstate
              </>
            ) : (
              <>
                <Ban className="h-3 w-3" /> Suspend
              </>
            )}
          </button>
        </div>
      ),
    },
  ]

  if (isLoading) return <PageLoader label="Loading team accounts" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuration"
        title="Admin & team accounts"
        description="Administrators and operator accounts with privileged platform access. Provision new admins with the server-side script."
        actions={
          <ExportButton
            filename="ev-naija-team.csv"
            rows={filtered.map((member) => ({
              name: member.full_name,
              email: member.email,
              role: member.role,
              phone: member.phone ?? '',
              status: member.is_suspended ? 'suspended' : 'active',
              joined: member.created_at,
            }))}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Administrators', value: counts.admin, icon: ShieldCheck, tone: 'text-midnight-900', hint: 'Full platform access' },
          { label: 'Operators', value: counts.operator, icon: UserCog, tone: 'text-midnight-900', hint: 'Business accounts' },
          { label: 'Team accounts', value: counts.all, icon: Users, tone: 'text-midnight-900', hint: 'Privileged roles' },
          { label: 'Suspended', value: counts.suspended, icon: Ban, tone: 'text-red-500', hint: 'Access blocked' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{stat.label}</p>
              <stat.icon className={`h-4 w-4 ${stat.tone}`} />
            </div>
            <p className={`mt-2 font-mono text-xl font-medium ${stat.tone}`}>{stat.value}</p>
            <p className="mt-0.5 text-[9.5px] text-muted">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'all', label: 'All accounts', count: counts.all },
            { value: 'admin', label: 'Admins', count: counts.admin },
            { value: 'operator', label: 'Operators', count: counts.operator },
          ]}
        />
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email"
            className="input-base h-9 pl-9 text-[11px]"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        minWidth={760}
        empty={<TableEmpty title="No accounts in this view" description="Try another role or clear the search." />}
        mobileRender={(member) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Avatar name={member.full_name} src={member.avatar_url} size={34} />
                <div>
                  <p className="text-[12px] font-semibold text-midnight-900">{member.full_name}</p>
                  <p className="text-[9.5px] text-muted">{member.email}</p>
                </div>
              </div>
              <Badge tone={member.role === 'admin' ? 'lime' : 'neutral'}>{member.role}</Badge>
            </div>
          </div>
        )}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-3xl bg-midnight-950 p-5 text-white">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-lime" />
            <p className="font-display text-sm font-semibold">Provision a new administrator</p>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-white/50">
            Creating auth users requires the service-role key and must never happen in the browser. Run the script locally
            with your Supabase service role environment variables:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-black/40 p-3 font-mono text-[9px] leading-relaxed text-lime">
{`SUPABASE_URL=... \\
SUPABASE_SERVICE_ROLE_KEY=... \\
node scripts/create-admin.mjs \\
  --email new-admin@evnaija.ng \\
  --name "New Admin"`}
          </pre>
          <p className="mt-2 font-mono text-[8.5px] text-white/35">Never commit the service-role key. Rotate it after use.</p>
        </div>

        <div className="rounded-3xl border border-midnight-900/[0.07] bg-white p-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-lime-700" />
            <p className="font-display text-sm font-semibold text-midnight-900">Access rules</p>
          </div>
          <ul className="mt-3 space-y-2.5">
            {[
              'Admins can review every marketplace record but cannot sign in as a customer.',
              'Suspending a team account immediately blocks dashboard access via RLS and middleware.',
              'Role changes require a service-role script and are recorded in the audit log.',
              'Use least privilege: create operator accounts through the normal application flow.',
            ].map((rule) => (
              <li key={rule} className="flex items-start gap-2 text-[10.5px] leading-relaxed text-charcoal-600">
                <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-lime-600" /> {rule}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={target?.is_suspended ? 'Reinstate account' : 'Suspend account'}
        description={target ? `${target.full_name} · ${target.email}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button variant={target?.is_suspended ? 'soft' : 'danger'} loading={working} onClick={toggle}>
              {target?.is_suspended ? 'Reinstate account' : 'Suspend account'}
            </Button>
          </>
        }
      >
        {target?.is_suspended ? (
          <p className="text-[12px] leading-relaxed text-charcoal-600">
            This restores dashboard access. Confirm any security investigation is complete before reinstating.
          </p>
        ) : (
          <Field label="Suspension reason" required hint="Recorded in the audit log and shown to the account owner.">
            <Textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Suspended pending review of unauthorised station status changes."
            />
          </Field>
        )}
      </Modal>
    </div>
  )
}
