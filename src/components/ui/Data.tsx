import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from './Feedback'

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  eyebrow?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        {eyebrow && <p className="eyebrow mb-2 text-lime-700">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-midnight-900 sm:text-[30px]">
          {title}
        </h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({
  label,
  value,
  icon,
  hint,
  trend,
  tone = 'default',
  mono = true,
  className,
}: {
  label: string
  value: string | number
  icon?: ReactNode
  hint?: string
  trend?: { value: string; positive?: boolean }
  tone?: 'default' | 'lime' | 'dark'
  mono?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-5',
        tone === 'default' && 'border-midnight-900/[0.07] bg-white shadow-card',
        tone === 'lime' && 'border-lime-400/40 bg-lime/20',
        tone === 'dark' && 'border-midnight-800 bg-midnight-900 text-white',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={cn('text-[12px] font-semibold uppercase tracking-[0.1em]', tone === 'dark' ? 'text-white/50' : 'text-muted')}>
          {label}
        </p>
        {icon && (
          <span
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
              tone === 'default' && 'bg-mint text-midnight-800',
              tone === 'lime' && 'bg-lime text-midnight-900',
              tone === 'dark' && 'bg-white/10 text-lime',
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p
        className={cn(
          'mt-3 text-[26px] font-semibold leading-none tracking-tight',
          mono && 'font-mono text-[24px]',
          tone === 'dark' ? 'text-white' : 'text-midnight-900',
        )}
      >
        {value}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {trend && (
          <span
            className={cn(
              'font-mono text-[11px] font-medium',
              trend.positive === false ? 'text-red-500' : 'text-emerald-600',
              tone === 'dark' && 'text-lime',
            )}
          >
            {trend.value}
          </span>
        )}
        {hint && <span className={cn('text-[11px]', tone === 'dark' ? 'text-white/40' : 'text-muted')}>{hint}</span>}
      </div>
      {tone === 'dark' && <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-lime/10 blur-2xl" />}
    </div>
  )
}

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
  headerClassName?: string
}

export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  loading,
  empty,
  onRowClick,
  mobileRender,
  className,
  minWidth = 720,
}: {
  columns: Column<T>[]
  rows: T[]
  loading?: boolean
  empty?: ReactNode
  onRowClick?: (row: T) => void
  mobileRender?: (row: T) => ReactNode
  className?: string
  minWidth?: number
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    )
  }
  if (!rows.length) return <>{empty}</>

  return (
    <>
      {mobileRender && (
        <div className="space-y-3 md:hidden">
          {rows.map((row, index) => (
            <div
              key={row.id ?? index}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'rounded-2xl border border-midnight-900/[0.07] bg-white p-4 shadow-card',
                onRowClick && 'cursor-pointer active:scale-[0.995]',
              )}
            >
              {mobileRender(row)}
            </div>
          ))}
        </div>
      )}
      <div className={cn('overflow-x-auto rounded-2xl border border-midnight-900/[0.07] bg-white shadow-card', mobileRender && 'hidden md:block', className)}>
        <table className="w-full border-collapse text-left" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-midnight-900/[0.07] bg-charcoal-50/60">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'whitespace-nowrap px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted',
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.id ?? index}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'border-b border-midnight-900/[0.05] last:border-0',
                  onRowClick && 'cursor-pointer transition hover:bg-mint-50',
                )}
              >
                {columns.map((column) => (
                  <td key={column.key} className={cn('px-4 py-3.5 text-[13px] text-charcoal-700', column.className)}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function Pagination({
  page,
  pageCount,
  onChange,
  total,
  pageSize,
}: {
  page: number
  pageCount: number
  onChange: (page: number) => void
  total?: number
  pageSize?: number
}) {
  if (pageCount <= 1) return null
  return (
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted">
        {total !== undefined && pageSize ? (
          <>
            Showing <span className="font-mono text-charcoal-700">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</span> of{' '}
            <span className="font-mono text-charcoal-700">{total}</span>
          </>
        ) : (
          <>Page {page} of {pageCount}</>
        )}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="grid h-8 w-8 place-items-center rounded-lg border border-midnight-900/10 bg-white text-charcoal-600 transition hover:bg-charcoal-50 disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {Array.from({ length: Math.min(5, pageCount) }).map((_, index) => {
          const start = Math.max(1, Math.min(page - 2, pageCount - 4))
          const value = start + index
          return (
            <button
              key={value}
              onClick={() => onChange(value)}
              className={cn(
                'h-8 min-w-8 rounded-lg px-2 font-mono text-xs transition',
                value === page
                  ? 'bg-midnight-900 text-lime'
                  : 'border border-midnight-900/10 bg-white text-charcoal-600 hover:bg-charcoal-50',
              )}
            >
              {value}
            </button>
          )
        })}
        <button
          onClick={() => onChange(Math.min(pageCount, page + 1))}
          disabled={page === pageCount}
          className="grid h-8 w-8 place-items-center rounded-lg border border-midnight-900/10 bg-white text-charcoal-600 transition hover:bg-charcoal-50 disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: string; count?: number }[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cn('hide-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-charcoal-50 p-1', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition',
            tab.value === value
              ? 'bg-white text-midnight-900 shadow-sm'
              : 'text-muted hover:text-charcoal-700',
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 font-mono text-[10px]',
                tab.value === value ? 'bg-lime text-midnight-900' : 'bg-charcoal-200 text-charcoal-600',
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  padded = true,
}: {
  title?: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section className={cn('rounded-3xl border border-midnight-900/[0.07] bg-white shadow-card', className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-midnight-900/[0.06] px-5 py-4 sm:px-6">
          <div>
            {title && <h2 className="font-display text-base font-semibold text-midnight-900">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn(padded && 'p-5 sm:p-6')}>{children}</div>
    </section>
  )
}
