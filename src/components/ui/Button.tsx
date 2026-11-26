import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'dark' | 'outline' | 'ghost' | 'soft' | 'danger' | 'lime-outline'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const variants: Record<Variant, string> = {
  primary:
    'bg-lime text-midnight-900 hover:bg-lime-300 active:bg-lime-400 shadow-[0_8px_24px_-10px_rgba(139,197,33,0.7)]',
  dark: 'bg-midnight-900 text-white hover:bg-midnight-800 shadow-[0_8px_24px_-12px_rgba(7,27,34,0.5)]',
  outline: 'border border-midnight-900/15 bg-transparent text-midnight-900 hover:bg-midnight-900/[0.04]',
  ghost: 'bg-transparent text-charcoal-700 hover:bg-midnight-900/[0.05]',
  soft: 'bg-mint text-midnight-900 hover:bg-mint-200',
  danger: 'bg-red-500 text-white hover:bg-red-600',
  'lime-outline': 'border border-lime/40 bg-lime/[0.06] text-lime-200 hover:bg-lime/15',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13px] gap-1.5 rounded-lg',
  md: 'h-11 px-5 text-sm gap-2 rounded-xl',
  lg: 'h-[52px] px-7 text-[15px] gap-2.5 rounded-xl',
  icon: 'h-10 w-10 rounded-xl',
}

export function buttonVariants({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(
    'inline-flex select-none items-center justify-center whitespace-nowrap font-sans font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 active:scale-[0.985]',
    variants[variant],
    sizes[size],
    className,
  )
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonVariants({ variant, size, className })}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})
