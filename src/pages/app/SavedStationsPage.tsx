import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Heart, MapPin, Search, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { listFavorites, toggleFavorite } from '@/services/account'
import { useToast } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/Data'
import { StationCard } from '@/components/stations/StationCard'
import { EmptyState, PageLoader } from '@/components/ui/Feedback'
import { Button, buttonVariants } from '@/components/ui/Button'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function SavedStationsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  usePageTitle('Saved stations')

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: () => listFavorites(user!.id),
    enabled: Boolean(user?.id),
  })

  const remove = async (stationId: string, name: string) => {
    if (!user) return
    try {
      await toggleFavorite(user.id, stationId)
      await queryClient.invalidateQueries({ queryKey: ['favorites', user.id] })
      toast.success('Removed from saved', `${name} is no longer in your saved stations.`)
    } catch (error) {
      toast.error('Could not update saved stations', (error as Error).message)
    }
  }

  if (isLoading) return <PageLoader label="Loading saved stations" />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Shortlist"
        title="Saved stations"
        description="The chargers you want to find again quickly. Saved stations are private to your account."
        actions={<Link to="/app/stations" className={buttonVariants({ size: 'md' })}><Search className="h-4 w-4" /> Discover more</Link>}
      />

      {favorites.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {favorites.map((favorite, index) => (
            <div key={favorite.id} className="group relative">
              {favorite.station ? (
                <>
                  <StationCard station={favorite.station} index={index} detailBase="/app/stations" />
                  <button
                    onClick={() => void remove(favorite.station_id, favorite.station!.name)}
                    className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border border-white/30 bg-midnight-950/60 text-white backdrop-blur transition hover:bg-red-500"
                    aria-label={`Remove ${favorite.station.name} from saved`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <div className="rounded-3xl border border-dashed border-midnight-900/10 bg-white p-5">
                  <p className="text-sm font-semibold text-midnight-900">Station unavailable</p>
                  <p className="mt-1 text-xs text-muted">This station is no longer listed. Remove it from your saved list.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => void remove(favorite.station_id, 'This station')}>Remove</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Heart className="h-6 w-6" />}
          title="No saved stations yet"
          description="Tap the heart on any station to keep it here for quick access when you need a charge."
          action={<Link to="/app/stations" className={buttonVariants({ variant: 'dark' })}><MapPin className="h-4 w-4" /> Browse the network</Link>}
        />
      )}
    </div>
  )
}
