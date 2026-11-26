import { Navigate, useLocation } from 'react-router-dom'
import type { AppRole } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { dashboardPath } from '@/lib/roles'
import { PageLoader } from '@/components/ui/Feedback'
import { DashboardLayout } from './DashboardLayout'

/**
 * Guards every dashboard route. The role check is intentionally server-backed
 * (user_roles + RLS); this client guard only prevents dead-end navigation.
 */
export function ProtectedShell({ allow }: { allow?: AppRole[] }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-mint-50">
        <PageLoader label="Checking your session" />
      </div>
    )
  }

  if (!user) {
    const redirect = `${location.pathname}${location.search}`
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />
  }

  if (allow && !allow.some((role) => user.roles.includes(role))) {
    return <Navigate to={dashboardPath(user.roles)} replace />
  }

  return <DashboardLayout />
}
