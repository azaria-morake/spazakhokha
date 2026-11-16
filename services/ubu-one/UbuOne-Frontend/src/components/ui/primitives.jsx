import React from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        'ubu-card-surface rounded-2xl transition-colors duration-200',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children }) {
  return (
    <div className={cn('px-5 pt-5 pb-3 flex items-center justify-between gap-3', className)}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children }) {
  return (
    <h3 className={cn('text-base font-semibold tracking-tight text-white', className)}>
      {children}
    </h3>
  )
}

export function CardContent({ className, children }) {
  return <div className={cn('px-5 pb-5', className)}>{children}</div>
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  disabled,
  ...props
}) {
  const variants = {
    primary: 'ubu-btn-cyber text-white font-semibold',
    secondary:
      'bg-[#1D2A57] hover:bg-[#24346A] text-white border border-white/10 font-medium',
    ghost:
      'bg-transparent hover:bg-white/[0.06] text-[#D2D7DF] hover:text-white font-medium',
    danger:
      'bg-rose-500/15 hover:bg-rose-500/25 text-[#F46B78] border border-rose-500/25 font-medium',
    outline:
      'bg-transparent hover:bg-white/[0.04] text-white border border-white/12 font-medium',
  }

  const sizes = {
    sm: 'h-8 px-3 text-xs rounded-lg',
    md: 'h-10 px-4 text-sm rounded-xl',
    lg: 'h-11 px-5 text-sm rounded-xl',
    icon: 'h-9 w-9 p-0 rounded-xl',
  }

  return (
    <button
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none',
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'w-full h-10 px-3.5 rounded-xl ubu-input-surface text-sm text-white placeholder:text-[#8E9BB8] focus:outline-none focus:border-[#00A2E8]/70 focus:ring-2 focus:ring-[#00A2E8]/20 transition-all',
        className
      )}
      {...props}
    />
  )
}

export function Badge({ variant = 'default', className, children }) {
  const styles = {
    default: 'bg-[#1D2B59] text-[#D2D7DF] border border-white/10',
    cyber: 'bg-[#00A2E8]/15 text-[#38C3FF] border border-[#00A2E8]/30',
    mint: 'bg-emerald-500/15 text-[#38E4AE] border border-emerald-400/25',
    coral: 'bg-rose-500/15 text-[#F46B78] border border-rose-400/25',
    amber: 'bg-amber-500/15 text-amber-300 border border-amber-400/25',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide',
        styles[variant] || styles.default,
        className
      )}
    >
      {children}
    </span>
  )
}

export function Dialog({ open, onOpenChange, children, maxWidth = 'max-w-lg' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060A18]/75 backdrop-blur-sm">
      <div
        className="fixed inset-0"
        onClick={() => onOpenChange?.(false)}
        aria-hidden="true"
      />
      <div
        className={cn(
          'relative z-10 w-full ubu-card-surface rounded-2xl p-6 shadow-2xl border border-white/12',
          maxWidth
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ title, subtitle, onClose }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-[#9AA7C4] mt-1">{subtitle}</p>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#9AA7C4] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

export function Switch({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
        checked ? 'bg-[#00A2E8]' : 'bg-[#223060]'
      )}
      title={label}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  )
}

