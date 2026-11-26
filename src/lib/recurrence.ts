import { addDays, addMonths, format } from 'date-fns'
import type { BookingFrequency } from '@/types'

export const BOOKING_FREQUENCIES: BookingFrequency[] = ['weekly', 'biweekly', 'monthly']

export const recurrenceLabels: Record<BookingFrequency, string> = {
  weekly: 'Every week',
  biweekly: 'Every 2 weeks',
  monthly: 'Every month',
}

export const recurrenceShortLabels: Record<BookingFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
}

/**
 * Pure recurrence helper shared by the booking UI, preview fixtures and tests.
 * Monthly plans clamp to the last valid day of the target month (for example,
 * 31 January advances to 28 February).
 */
export function nextOccurrence(
  start: string | Date,
  frequency: BookingFrequency,
  count = 1,
): Date {
  const date = start instanceof Date ? new Date(start.getTime()) : new Date(start)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid recurrence start date.')
  const step = Math.max(0, Math.trunc(count))
  if (frequency === 'weekly') return addDays(date, 7 * step)
  if (frequency === 'biweekly') return addDays(date, 14 * step)
  return addMonths(date, step)
}

export function recurrenceSchedule(
  start: string | Date,
  frequency: BookingFrequency,
  occurrences: number,
): Date[] {
  const total = Math.max(1, Math.trunc(occurrences))
  return Array.from({ length: total }).map((_, index) => nextOccurrence(start, frequency, index))
}

export function seriesRemaining(series: {
  occurrences: number
  bookings_created: number
  status: string
}): number {
  if (series.status !== 'active') return 0
  return Math.max(0, series.occurrences - series.bookings_created)
}

export function isReminderDue(
  startTime: string | Date,
  now: Date = new Date(),
  minutesBefore = 30,
): boolean {
  const start = startTime instanceof Date ? startTime.getTime() : new Date(startTime).getTime()
  if (Number.isNaN(start)) return false
  const difference = start - now.getTime()
  return difference > 0 && difference <= minutesBefore * 60_000
}

export function formatSchedulePreview(
  start: string | Date,
  frequency: BookingFrequency,
  occurrences: number,
  limit = 4,
): string[] {
  const schedule = recurrenceSchedule(start, frequency, Math.min(occurrences, limit))
  return schedule.map((date) => format(date, 'EEE, dd MMM · HH:mm'))
}
