import type { ReactNode } from 'react'
import { Download, Inbox, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState } from '@/components/ui/Feedback'

export function TableToolbar({
  search,
  onSearch,
  placeholder = 'Search…',
  filters,
  actions,
  className,
}: {
  search?: string
  onSearch?: (value: string) => void
  placeholder?: string
  filters?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between', className)}>
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        {onSearch && (
          <div className="relative w-full sm:max-w-xs">
            <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder={placeholder}
              className="input-base h-10 pl-10 text-[13px]"
            />
          </div>
        )}
        {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function TableEmpty({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <EmptyState
      icon={<Inbox className="h-6 w-6" />}
      title={title}
      description={description}
      action={action}
      className="border-0 bg-transparent py-10"
    />
  )
}

export function QueryError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <ErrorState
      title="Could not load this data"
      description={message}
      onRetry={onRetry}
    />
  )
}

export function DetailRow({
  label,
  value,
  mono,
  className,
}: {
  label: string
  value: ReactNode
  mono?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-2.5', className)}>
      <span className="text-[12px] text-muted">{label}</span>
      <span className={cn('text-right text-[12.5px] font-medium text-charcoal-700', mono && 'font-mono')}>{value}</span>
    </div>
  )
}

export function RefreshButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} loading={loading}>
      <RefreshCw className="h-3.5 w-3.5" /> Refresh
    </Button>
  )
}

export function ExportButton({
  rows,
  filename,
  label = 'Export CSV',
}: {
  rows: Record<string, string | number | null | undefined>[]
  filename: string
  label?: string
}) {
  const download = () => {
    if (!rows.length) return
    const headers = Object.keys(rows[0])
    const escape = (value: string | number | null | undefined) => {
      const text = String(value ?? '')
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <Button variant="outline" size="sm" onClick={download} disabled={!rows.length}>
      <Download className="h-3.5 w-3.5" /> {label}
    </Button>
  )
}

export function usePaged<T>(rows: T[], pageSize = 10, page = 1) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, pageCount)
  return {
    pageCount,
    rows: rows.slice((safePage - 1) * pageSize, safePage * pageSize),
  }
}

export function MiniStat({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'lime' | 'dark'
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3',
        tone === 'default' && 'border-midnight-900/[0.07] bg-white',
        tone === 'lime' && 'border-lime-400/40 bg-lime/20',
        tone === 'dark' && 'border-midnight-800 bg-midnight-900',
      )}
    >
      <p className={cn('font-mono text-[13px] font-medium', tone === 'dark' ? 'text-lime' : 'text-midnight-900')}>{value}</p>
      <p className={cn('mt-0.5 text-[9.5px] uppercase tracking-[0.12em]', tone === 'dark' ? 'text-white/40' : 'text-muted')}>{label}</p>
    </div>
  )
}

export function InfoNote({
  title,
  children,
  tone = 'info',
}: {
  title: string
  children: ReactNode
  tone?: 'info' | 'warning' | 'success'
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3.5',
        tone === 'info' && 'border-sky-200 bg-sky-50',
        tone === 'warning' && 'border-amber-200 bg-amber-50',
        tone === 'success' && 'border-lime-400/50 bg-lime/15',
      )}
    >
      <p
        className={cn(
          'text-[11.5px] font-semibold',
          tone === 'info' && 'text-sky-800',
          tone === 'warning' && 'text-amber-800',
          tone === 'success' && 'text-midnight-900',
        )}
      >
        {title}
      </p>
      <div className="mt-0.5 text-[11px] leading-relaxed text-charcoal-500">{children}</div>
    </div>
  )
}

export function SelectFilter({
  value,
  onChange,
  options,
  label,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  label?: string
}) {
  return (
    <label className="inline-flex items-center gap-2">
      {label && <span className="hidden text-[10px] uppercase tracking-[0.12em] text-muted sm:inline">{label}</span>}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-xl border border-midnight-900/10 bg-white px-3 text-[12px] font-medium text-charcoal-700 outline-none transition focus:border-lime-500 focus:ring-2 focus:ring-lime/30"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
