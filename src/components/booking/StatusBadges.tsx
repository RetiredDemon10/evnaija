import { Badge } from '@/components/ui/Badge'
import { bookingStatusTone, humanize } from '@/lib/utils'
import type { BookingStatus, PaymentStatus, PayoutStatus } from '@/types'

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge tone={bookingStatusTone(status)}>{humanize(status)}</Badge>
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={bookingStatusTone(status)}>{humanize(status)}</Badge>
}

export function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
  return <Badge tone={bookingStatusTone(status)}>{humanize(status)}</Badge>
}
