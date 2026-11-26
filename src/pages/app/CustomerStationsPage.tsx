import { MapPin, Zap } from 'lucide-react'
import { StationDiscovery } from '@/components/stations/StationDiscovery'
import { PageHeader } from '@/components/ui/Data'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Badge } from '@/components/ui/Badge'

export default function CustomerStationsPage() {
  usePageTitle('Find a charging station')
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Network"
        title="Find a charger"
        description="Search verified stations across Lagos, Abuja and Port Harcourt. Filter by connector, speed and live availability."
        actions={<Badge tone="lime"><Zap className="h-3 w-3" /> Live availability</Badge>}
      />
      <StationDiscovery detailBase="/app/stations" />
      <div className="flex items-start gap-2 rounded-2xl border border-midnight-900/[0.07] bg-white px-4 py-3.5">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" />
        <p className="text-[10.5px] leading-relaxed text-charcoal-500">
          Availability updates as operators manage their chargers. A slot is only guaranteed once your booking is paid
          and confirmed — reserve before you drive.
        </p>
      </div>
    </div>
  )
}
