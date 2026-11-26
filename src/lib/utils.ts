import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, differenceInMinutes, parseISO, isToday, isTomorrow } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNaira(amount: number | null | undefined, options?: { compact?: boolean; kobo?: boolean }) {
  const value = Number(amount ?? 0)
  const naira = options?.kobo ? value / 100 : value
  if (options?.compact && naira >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(1)}m`
  if (options?.compact && naira >= 10_000) return `₦${(naira / 1_000).toFixed(0)}k`
  const hasFraction = naira % 1 !== 0
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(naira)
}

export function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('en-NG').format(Number(value ?? 0))
}

export function formatDate(date: string | Date | null | undefined, pattern = 'dd MMM yyyy') {
  if (!date) return '—'
  try {
    return format(typeof date === 'string' ? parseISO(date) : date, pattern)
  } catch {
    return '—'
  }
}

export function formatDateTime(date: string | Date | null | undefined) {
  return formatDate(date, 'dd MMM yyyy · HH:mm')
}

export function formatTime(date: string | Date | null | undefined) {
  return formatDate(date, 'HH:mm')
}

export function relativeTime(date: string) {
  try {
    return formatDistanceToNow(parseISO(date), { addSuffix: true })
  } catch {
    return '—'
  }
}

export function friendlyDate(date: string) {
  const parsed = parseISO(date)
  if (isToday(parsed)) return 'Today'
  if (isTomorrow(parsed)) return 'Tomorrow'
  return format(parsed, 'EEE, dd MMM')
}

export function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins ? `${hrs}h ${mins}m` : `${hrs}h`
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export function bookingStatusTone(status: string) {
  switch (status) {
    case 'confirmed':
    case 'completed':
    case 'success':
    case 'approved':
    case 'paid':
    case 'published':
    case 'active':
      return 'success' as const
    case 'pending_payment':
    case 'pending':
    case 'processing':
    case 'reserved':
    case 'checked_in':
    case 'in_progress':
      return 'warning' as const
    case 'cancelled':
    case 'expired':
    case 'failed':
    case 'rejected':
    case 'suspended':
    case 'hidden':
    case 'reversed':
      return 'danger' as const
    case 'refunded':
      return 'neutral' as const
    default:
      return 'neutral' as const
  }
}

export function humanize(value: string | null | undefined) {
  if (!value) return '—'
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export const connectorLabels: Record<string, string> = {
  type2: 'Type 2',
  ccs2: 'CCS2',
  chademo: 'CHAdeMO',
  gbt: 'GB/T',
}

export const speedLabels: Record<string, string> = {
  slow: 'Slow',
  fast: 'Fast',
  rapid: 'Rapid',
  ultra: 'Ultra-fast',
}

export const speedRange: Record<string, string> = {
  slow: '3 – 7 kW',
  fast: '11 – 22 kW',
  rapid: '43 – 100 kW',
  ultra: '150+ kW',
}

export function timeUntil(date: string) {
  const mins = differenceInMinutes(parseISO(date), new Date())
  if (mins < 60) return `${Math.max(mins, 0)} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export function escapeHtml(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function truncate(value: string, length = 120) {
  return value.length > length ? `${value.slice(0, length).trimEnd()}…` : value
}

export function generateId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

/** Client-side image compression before upload. Keeps Supabase storage tidy. */
export async function compressImage(file: File, maxWidth = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxWidth / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )
  if (!blob) return file
  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
}
