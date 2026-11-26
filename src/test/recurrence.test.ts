import { describe, expect, it } from 'vitest'
import {
  formatSchedulePreview,
  isReminderDue,
  nextOccurrence,
  recurrenceLabels,
  seriesRemaining,
} from '@/lib/recurrence'

const start = new Date(2026, 0, 31, 10, 0, 0)

describe('nextOccurrence', () => {
  it('advances weekly plans by seven days', () => {
    expect(nextOccurrence(start, 'weekly', 3).getDate()).toBe(21)
    expect(nextOccurrence(start, 'weekly', 3).getMonth()).toBe(1)
  })

  it('advances biweekly plans by fourteen days', () => {
    expect(nextOccurrence(start, 'biweekly', 1).getDate()).toBe(14)
    expect(nextOccurrence(start, 'biweekly', 1).getMonth()).toBe(1)
  })

  it('clamps monthly plans to the last day of a shorter month', () => {
    expect(nextOccurrence(start, 'monthly', 1).getMonth()).toBe(1)
    expect(nextOccurrence(start, 'monthly', 1).getDate()).toBe(28)
  })

  it('returns the start for the first occurrence', () => {
    expect(nextOccurrence(start, 'monthly', 0).toISOString()).toBe(start.toISOString())
  })
})

describe('recurrence helpers', () => {
  it('labels known frequencies', () => {
    expect(recurrenceLabels.weekly).toBe('Every week')
    expect(recurrenceLabels.biweekly).toBe('Every 2 weeks')
    expect(recurrenceLabels.monthly).toBe('Every month')
  })

  it('counts remaining sessions only for active plans', () => {
    expect(seriesRemaining({ occurrences: 4, bookings_created: 1, status: 'active' })).toBe(3)
    expect(seriesRemaining({ occurrences: 4, bookings_created: 4, status: 'active' })).toBe(0)
    expect(seriesRemaining({ occurrences: 4, bookings_created: 1, status: 'cancelled' })).toBe(0)
  })

  it('limits the schedule preview to the requested number of items', () => {
    const preview = formatSchedulePreview(start, 'weekly', 8, 4)
    expect(preview).toHaveLength(4)
    expect(preview[0]).toContain('10:00')
  })
})

describe('isReminderDue', () => {
  const now = new Date('2026-05-01T09:00:00.000Z')

  it('is due inside the reminder window', () => {
    expect(isReminderDue('2026-05-01T09:20:00.000Z', now)).toBe(true)
  })

  it('is not due outside the reminder window', () => {
    expect(isReminderDue('2026-05-01T10:00:00.000Z', now)).toBe(false)
  })

  it('never fires for a past session or invalid date', () => {
    expect(isReminderDue('2026-05-01T08:59:00.000Z', now)).toBe(false)
    expect(isReminderDue('not-a-date', now)).toBe(false)
  })
})
