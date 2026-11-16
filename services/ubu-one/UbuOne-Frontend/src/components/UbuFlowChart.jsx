import React, { useMemo, useState } from 'react'
import { cn, formatUBU } from '../lib/utils'

/**
 * Computes smooth Catmull-Rom cubic Bezier SVG path through an array of { x, y } points.
 */
function buildSmoothSpline(points, tension = 0.22) {
  if (!points.length) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1]

    const cp1x = p1.x + (p2.x - p0.x) * tension
    const cp1y = p1.y + (p2.y - p0.y) * tension
    const cp2x = p2.x - (p3.x - p1.x) * tension
    const cp2y = p2.y - (p3.y - p1.y) * tension

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}

/**
 * Compact glowing Cyber Blue sparkline used inside the "Unit UBU Pool" top KPI card.
 */
export function MiniSparkline({ values = [14, 22, 18, 29, 24, 38, 34] }) {
  const width = 104
  const height = 42
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = Math.max(max - min, 1)

  const pts = values.map((v, i) => ({
    x: (i / Math.max(values.length - 1, 1)) * (width - 8) + 4,
    y: height - 6 - ((v - min) / range) * (height - 14),
  }))

  const linePath = buildSmoothSpline(pts, 0.2)
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(2)} ${height} L ${pts[0].x.toFixed(2)} ${height} Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-24 h-10 shrink-0 overflow-visible">
      <defs>
        <linearGradient id="ubuMiniGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00A2E8" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#00A2E8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#ubuMiniGrad)" />
      <path
        d={linePath}
        fill="none"
        stroke="#00A2E8"
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ filter: 'drop-shadow(0 0 6px rgba(0, 162, 232, 0.6))' }}
      />
    </svg>
  )
}

/**
 * Interactive dual-series smooth spline chart modeled faithfully on ubu-one-ui.jpeg.
 * Series A (Cyber Blue): Counter Inflow (UBU R1 micro-payments)
 * Series B (Digital Silver): Change-in-UBU & Settlements
 */
export function UbuFlowChart({
  ledger = [],
  title = 'UBU Flow History',
  seriesALabel = 'Counter UBU Inflow',
  seriesBLabel = 'Change & Settlements',
}) {
  const [rangeMode, setRangeMode] = useState('today')
  const [hoverIdx, setHoverIdx] = useState(null)

  const seriesData = useMemo(() => {
    const counterEvents = ledger.filter(
      (e) => e.event_type === 'COUNTER_SALE' || e.event_type === 'UBU_DEPOSIT'
    )
    const outEvents = ledger.filter(
      (e) =>
        e.event_type === 'CHANGE_IN_UBU' ||
        e.event_type === 'SETTLEMENT' ||
        e.event_type === 'BENEFICIARY_TRANSFER'
    )

    const liveCounterSum = counterEvents.reduce((s, e) => s + Number(e.amount_ubu || 0), 0)
    const liveOutSum = outEvents.reduce((s, e) => s + Number(e.amount_ubu || 0), 0)

    if (rangeMode === 'today') {
      const baseLabels = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00', 'Now']
      const inflowBase = [12, 28, 22, 41, 34, 46, Math.max(18, Math.round(liveCounterSum * 3 + 22))]
      const changeBase = [8, 14, 24, 19, 31, 23, Math.max(10, Math.round(liveOutSum * 2 + 16))]
      return baseLabels.map((label, idx) => ({
        label,
        inflow: inflowBase[idx],
        outflow: changeBase[idx],
      }))
    }

    const histLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const inflowHist = [110, 185, 160, 290, 245, 320, Math.max(210, Math.round(liveCounterSum * 12 + 280))]
    const changeHist = [65, 92, 130, 155, 195, 168, Math.max(120, Math.round(liveOutSum * 8 + 180))]
    return histLabels.map((label, idx) => ({
      label,
      inflow: inflowHist[idx],
      outflow: changeHist[idx],
    }))
  }, [ledger, rangeMode])

  const W = 560
  const H = 220
  const padL = 36
  const padR = 14
  const padT = 18
  const padB = 28
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const rawMax = Math.max(
    ...seriesData.map((d) => Math.max(d.inflow, d.outflow)),
    50
  )
  const yMax = Math.ceil(rawMax / 10) * 10

  const getCoords = (key) =>
    seriesData.map((d, i) => ({
      x: padL + (i / Math.max(seriesData.length - 1, 1)) * plotW,
      y: padT + plotH - (d[key] / yMax) * plotH,
    }))

  const inflowPts = getCoords('inflow')
  const outflowPts = getCoords('outflow')

  const inflowLine = buildSmoothSpline(inflowPts, 0.22)
  const outflowLine = buildSmoothSpline(outflowPts, 0.22)

  const inflowArea = `${inflowLine} L ${inflowPts[inflowPts.length - 1].x.toFixed(2)} ${padT + plotH} L ${inflowPts[0].x.toFixed(2)} ${padT + plotH} Z`
  const outflowArea = `${outflowLine} L ${outflowPts[outflowPts.length - 1].x.toFixed(2)} ${padT + plotH} L ${outflowPts[0].x.toFixed(2)} ${padT + plotH} Z`

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    val: Math.round(yMax * f),
    y: padT + plotH - f * plotH,
  }))

  const hovered = hoverIdx !== null ? seriesData[hoverIdx] : null

  return (
    <div className="ubu-card-surface rounded-2xl p-5 flex flex-col justify-between h-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-base font-semibold text-white tracking-tight">
            {title}
          </h3>
          <div className="flex items-center gap-4 mt-1 text-[11px] text-[#9AA7C4]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00A2E8] shadow-[0_0_8px_#00A2E8]" />
              {seriesALabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D2D7DF]" />
              {seriesBLabel}
            </span>
          </div>
        </div>

        <div className="inline-flex items-center p-1 rounded-xl bg-[#1A264E] border border-white/10">
          <button
            type="button"
            onClick={() => setRangeMode('today')}
            className={cn(
              'px-3.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              rangeMode === 'today'
                ? 'bg-[#00A2E8] text-white shadow-[0_4px_12px_rgba(0,162,232,0.4)]'
                : 'text-[#9AA7C4] hover:text-white'
            )}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setRangeMode('history')}
            className={cn(
              'px-3.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              rangeMode === 'history'
                ? 'bg-[#00A2E8] text-white shadow-[0_4px_12px_rgba(0,162,232,0.4)]'
                : 'text-[#9AA7C4] hover:text-white'
            )}
          >
            History
          </button>
        </div>
      </div>

      <div className="relative w-full flex-1 flex items-center mt-1 min-h-[250px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full min-h-[240px] max-h-[340px] overflow-visible select-none">
          <defs>
            <linearGradient id="cyberArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00A2E8" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#00A2E8" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="silverArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D2D7DF" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#D2D7DF" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal Y gridlines */}
          {ticks.map((t) => (
            <g key={t.val}>
              <line
                x1={padL}
                y1={t.y}
                x2={W - padR}
                y2={t.y}
                stroke="rgba(210, 215, 223, 0.08)"
                strokeWidth="1"
              />
              <text
                x={padL - 8}
                y={t.y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#7F8CAE"
                className="tabular-nums"
              >
                {t.val}
              </text>
            </g>
          ))}

          {/* Secondary Curve (Silver) */}
          <path d={outflowArea} fill="url(#silverArea)" />
          <path
            d={outflowLine}
            fill="none"
            stroke="#D2D7DF"
            strokeOpacity="0.82"
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Primary Curve (Cyber Blue) */}
          <path d={inflowArea} fill="url(#cyberArea)" />
          <path
            d={inflowLine}
            fill="none"
            stroke="#00A2E8"
            strokeWidth="2.8"
            strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 8px rgba(0, 162, 232, 0.5))' }}
          />

          {/* Interactive vertical hover band & dots */}
          {seriesData.map((d, i) => {
            const cx = inflowPts[i].x
            const cyIn = inflowPts[i].y
            const cyOut = outflowPts[i].y
            const isHovered = hoverIdx === i
            return (
              <g key={d.label}>
                {isHovered && (
                  <>
                    <line
                      x1={cx}
                      y1={padT}
                      x2={cx}
                      y2={padT + plotH}
                      stroke="rgba(0, 162, 232, 0.4)"
                      strokeDasharray="3 3"
                    />
                    <circle cx={cx} cy={cyOut} r="4.5" fill="#D2D7DF" stroke="#0F1735" strokeWidth="2" />
                    <circle cx={cx} cy={cyIn} r="5.5" fill="#00A2E8" stroke="#FFFFFF" strokeWidth="2" />
                  </>
                )}

                <text
                  x={cx}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill={isHovered ? '#FFFFFF' : '#7F8CAE'}
                  fontWeight={isHovered ? '600' : '400'}
                >
                  {d.label}
                </text>

                {/* Invisible wide hit zone */}
                <rect
                  x={cx - plotW / (seriesData.length * 2)}
                  y={padT}
                  width={plotW / seriesData.length}
                  height={plotH + padB}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                  className="cursor-crosshair"
                />
              </g>
            )
          })}
        </svg>

        {hovered && (
          <div className="absolute top-1 right-2 px-3 py-2 rounded-xl bg-[#0B1128]/95 border border-[#00A2E8]/35 shadow-xl text-[11px] pointer-events-none">
            <div className="font-semibold text-white mb-1">{hovered.label} Snapshot</div>
            <div className="flex items-center justify-between gap-4 text-[#38C3FF] tabular-nums">
              <span>{seriesALabel}</span>
              <span className="font-bold">{formatUBU(hovered.inflow)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-[#D2D7DF] tabular-nums mt-0.5">
              <span>{seriesBLabel}</span>
              <span className="font-bold">{formatUBU(hovered.outflow)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

