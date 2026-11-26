import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import {
  getOperatorProfile,
  getOperatorStats,
  listOperatorStations,
} from '@/services/operator'

/**
 * Shared operator workspace data. Keeps the operator profile, stations and
 * aggregate stats in one cached place so every operator page is consistent.
 */
export function useOperatorData() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const profileQuery = useQuery({
    queryKey: ['operator-profile', userId],
    queryFn: () => getOperatorProfile(userId),
    enabled: Boolean(userId),
  })
  const operatorId = user?.operatorProfile?.id ?? profileQuery.data?.id ?? ''
  const stationsQuery = useQuery({
    queryKey: ['operator-stations', operatorId],
    queryFn: () => listOperatorStations(operatorId),
    enabled: Boolean(operatorId),
  })
  const statsQuery = useQuery({
    queryKey: ['operator-stats', operatorId],
    queryFn: () => getOperatorStats(operatorId),
    enabled: Boolean(operatorId),
  })
  const stations = stationsQuery.data ?? []
  const stationIds = useMemo(() => stations.map((station) => station.id), [stations])
  return {
    user,
    operatorId,
    profile: user?.operatorProfile ?? profileQuery.data ?? null,
    profileQuery,
    stations,
    stationIds,
    stationsQuery,
    stats: statsQuery.data,
    statsQuery,
    isLoading: profileQuery.isLoading || stationsQuery.isLoading || statsQuery.isLoading,
  }
}
