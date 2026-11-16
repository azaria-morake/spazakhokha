import React from 'react'
import { cn } from '../lib/utils'

/**
 * Vector Orbital Globe mark matching the official UbuOne Brand Identity Guide.
 */
export function UbuOneOrbitalMark({
  className = 'w-8 h-8',
  primaryColor = '#00A2E8',
  secondaryColor = '#D2D7DF',
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <circle
        cx="32"
        cy="32"
        r="24"
        stroke={primaryColor}
        strokeWidth="3.6"
      />
      <ellipse
        cx="32"
        cy="32"
        rx="25"
        ry="11.5"
        transform="rotate(-42 32 32)"
        stroke={secondaryColor}
        strokeOpacity="0.9"
        strokeWidth="3.2"
      />
      <ellipse
        cx="32"
        cy="32"
        rx="25"
        ry="11.5"
        transform="rotate(42 32 32)"
        stroke={primaryColor}
        strokeWidth="3.4"
      />
      <circle cx="22.5" cy="32" r="4" fill={primaryColor} />
      <circle cx="41.5" cy="32" r="4" fill={secondaryColor} />
    </svg>
  )
}

/**
 * Official UbuOne wordmark lockup: bold geometric "Ubu" + Cyber Blue pill "One" + Orbital mark.
 */
export function UbuOneLogo({ size = 'md', showMark = true, className }) {
  const sizes = {
    sm: {
      ubu: 'text-lg',
      onePill: 'px-2.5 py-0.5 text-sm',
      mark: 'w-6 h-6',
      gap: 'gap-1.5',
    },
    md: {
      ubu: 'text-[22px]',
      onePill: 'px-3 py-0.5 text-[18px]',
      mark: 'w-7 h-7',
      gap: 'gap-2',
    },
    lg: {
      ubu: 'text-3xl',
      onePill: 'px-4 py-1 text-2xl',
      mark: 'w-10 h-10',
      gap: 'gap-2.5',
    },
  }
  const s = sizes[size] || sizes.md

  return (
    <div className={cn('inline-flex items-center select-none', s.gap, className)}>
      <div className="inline-flex items-center gap-1.5 leading-none font-display font-extrabold tracking-tight">
        <span className={cn('text-white', s.ubu)}>Ubu</span>
        <span
          className={cn(
            'rounded-full bg-[#00A2E8] text-white font-bold inline-flex items-center justify-center leading-none shadow-[0_4px_14px_rgba(0,162,232,0.45)]',
            s.onePill
          )}
        >
          One
        </span>
      </div>
      {showMark && <UbuOneOrbitalMark className={s.mark} />}
    </div>
  )
}

/**
 * Crisp deterministic SVG matrix QR badge seeded from a pointer URI (e.g. $spazauniti.org/unit-104).
 */
export function DeterministicQrSvg({ value = '$spazauniti.org/unit-104', size = 160 }) {
  const cells = 21
  const seed = Array.from(String(value)).reduce((acc, ch, i) => acc + ch.charCodeAt(0) * (i + 7), 19)

  const isFinder = (r, c) =>
    (r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7)

  const squares = []
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if (isFinder(r, c)) continue
      if (r === 6 || c === 6) {
        if ((r + c) % 2 === 0) squares.push([r, c])
        continue
      }
      const h = ((r * 31 + c * 17 + seed) * 2654435761) >>> 0
      if (h % 2 === 0) squares.push([r, c])
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${cells + 2} ${cells + 2}`}
      className="rounded-xl bg-white p-2"
      role="img"
      aria-label={`QR code for ${value}`}
    >
      <rect width={cells + 2} height={cells + 2} fill="#FFFFFF" />
      {/* Top-Left Finder */}
      <rect x="1" y="1" width="7" height="7" rx="1.2" fill="#0F1735" />
      <rect x="2" y="2" width="5" height="5" rx="0.7" fill="#FFFFFF" />
      <rect x="3" y="3" width="3" height="3" rx="0.5" fill="#00A2E8" />
      {/* Top-Right Finder */}
      <rect x={cells - 6} y="1" width="7" height="7" rx="1.2" fill="#0F1735" />
      <rect x={cells - 5} y="2" width="5" height="5" rx="0.7" fill="#FFFFFF" />
      <rect x={cells - 4} y="3" width="3" height="3" rx="0.5" fill="#00A2E8" />
      {/* Bottom-Left Finder */}
      <rect x="1" y={cells - 6} width="7" height="7" rx="1.2" fill="#0F1735" />
      <rect x="2" y={cells - 5} width="5" height="5" rx="0.7" fill="#FFFFFF" />
      <rect x="3" y={cells - 4} width="3" height="3" rx="0.5" fill="#00A2E8" />
      {/* Data modules */}
      {squares.map(([r, c]) => (
        <rect
          key={`${r}-${c}`}
          x={c + 1}
          y={r + 1}
          width="0.92"
          height="0.92"
          rx="0.2"
          fill="#0F1735"
        />
      ))}
    </svg>
  )
}

