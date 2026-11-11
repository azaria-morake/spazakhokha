import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatUBU(val, showUnit = true) {
  const num = Number(val || 0)
  const formatted = num.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return showUnit ? `${formatted} UBU` : formatted
}

export function formatZAR(val) {
  const num = Number(val || 0)
  return `R${num.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function sanitizeHandle(raw) {
  return String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
}

export function formatShortDate(dateStr) {
  if (!dateStr) return 'Just now'
  const parts = String(dateStr).split(' ')
  if (parts.length === 2) {
    const [d, t] = parts
    const [y, m, day] = d.split('-')
    if (y && m && day) {
      return `${day}/${m}/${y} · ${t.slice(0, 5)}`
    }
  }
  return String(dateStr)
}

export function roleDisplayLabel(role) {
  if (role === 'UNIT_OWNER') return 'Unit Owner'
  if (role === 'UNIT_CASHIER') return 'Unit Cashier'
  if (role === 'NETWORK_ADMIN') return 'Network Admin'
  return role || 'Staff'
}

