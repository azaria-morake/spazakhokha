import React, { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUpRight,
  Building2,
  Coins,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'
import { MiniSparkline, UbuFlowChart } from '../components/UbuFlowChart'
import { QuickChargeCard } from '../components/QuickChargeCard'
import { UnitNodeCard } from '../components/UnitNodeCard'
import { formatShortDate, formatUBU, formatZAR } from '../lib/utils'

export function OverviewView({
  overview,
  unitId,
  prefillHandle,
  onRefresh,
  showToast,
  onNavigateTab,
}) {
  const [activityFilter, setActivityFilter] = useState('ALL')

  const ledger = overview?.ledger || []
  const metrics = overview?.metrics || {}
  const unitBalance = Number(overview?.unit_ubu_balance || 0)

  const inflowTotal = useMemo(() => {
    const ledgerSum = ledger
      .filter((e) => e.event_type === 'COUNTER_SALE')
      .reduce((s, e) => s + Number(e.amount_ubu || 0), 0)
    return Math.max(Number(metrics.today_counter_volume_ubu || 0), ledgerSum)
  }, [ledger, metrics.today_counter_volume_ubu])

  const outflowTotal = useMemo(() => {
    const settlementSum = ledger
      .filter((e) => e.event_type === 'SETTLEMENT' || e.event_type === 'CHANGE_IN_UBU')
      .reduce((s, e) => s + Number(e.amount_ubu || 0), 0)
    return Math.max(Number(metrics.change_in_ubu_issued || 0), settlementSum)
  }, [ledger, metrics.change_in_ubu_issued])

  const filteredActivity = useMemo(() => {
    const base =
      activityFilter === 'ALL'
        ? ledger
        : ledger.filter((e) => e.event_type === activityFilter)
    return base.slice(0, 4)
  }, [ledger, activityFilter])

  const sparkValues = useMemo(() => {
    const vals = ledger
      .slice(0, 7)
      .reverse()
      .map((l) => Math.max(4, Number(l.amount_ubu || 1) * 4))
    return vals.length >= 4 ? vals : [14, 21, 17, 29, 24, 38, Math.max(18, inflowTotal * 5)]
  }, [ledger, inflowTotal])

  const getActivityVisual = (entry) => {
    if (entry.event_type === 'COUNTER_SALE') {
      return {
        icon: ShoppingBag,
        iconBg: 'bg-[#00A2E8]/15 text-[#38C3FF] border-[#00A2E8]/25',
        sign: '+',
        amountClass: 'text-[#38E4AE]',
        title: entry.from_username ? `@${entry.from_username} purchase` : 'Counter Sale',
      }
    }
    if (entry.event_type === 'CHANGE_IN_UBU') {
      return {
        icon: Coins,
        iconBg: 'bg-amber-500/15 text-amber-300 border-amber-400/25',
        sign: '-',
        amountClass: 'text-white',
        title: entry.to_username ? `Change -> @${entry.to_username}` : 'Change-in-UBU',
      }
    }
    return {
      icon: Building2,
      iconBg: 'bg-rose-500/15 text-[#F46B78] border-rose-400/25',
      sign: '-',
      amountClass: 'text-[#F46B78]',
      title: entry.to_username ? `Settled · ${entry.to_username}` : 'Settlement',
    }
  }

  return (
    <div className="space-y-5">
      {/* Row 1: Top 3 KPI Cards mirroring ubu-one-ui.jpeg */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Unit UBU Pool */}
        <div className="ubu-card-surface rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-medium text-[#9AA7C4]">Unit UBU Pool</div>
            <div className="text-2xl xl:text-[28px] font-bold text-white tracking-tight tabular-nums mt-1.5">
              {formatUBU(unitBalance, false)}{' '}
              <span className="text-sm font-semibold text-[#38C3FF]">UBU</span>
            </div>
            <div className="text-[11px] text-[#9AA7C4] mt-1">
              {formatZAR(unitBalance)} ZAR peg · R0 counter fee
            </div>
          </div>
          <MiniSparkline values={sparkValues} />
        </div>

        {/* Card 2: Counter Inflow */}
        <div className="ubu-card-surface rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#9AA7C4]">Counter Inflow</span>
            <span className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center text-[#38E4AE]">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-1.5">
            <div className="text-2xl xl:text-[28px] font-bold text-[#38E4AE] tracking-tight tabular-nums">
              +{formatUBU(inflowTotal, false)}{' '}
              <span className="text-sm font-semibold">UBU</span>
            </div>
            <div className="text-[11px] text-[#9AA7C4] mt-1">
              {metrics.counter_tx_count || 0} counter sales · {metrics.micro_under_10_count || 0} under R10
            </div>
          </div>
        </div>

        {/* Card 3: Change & Settled */}
        <div className="ubu-card-surface rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#9AA7C4]">Change &amp; Settled</span>
            <span className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-400/25 flex items-center justify-center text-[#F46B78]">
              <ArrowDown className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-1.5">
            <div className="text-2xl xl:text-[28px] font-bold text-white tracking-tight tabular-nums">
              -{formatUBU(outflowTotal, false)}{' '}
              <span className="text-sm font-semibold text-[#F46B78]">UBU</span>
            </div>
            <div className="text-[11px] text-[#9AA7C4] mt-1">
              Digital change issued &amp; wholesaler payouts
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Main Bento Grid (Left Spline Chart | Right Quick Till + Node Card + Recent Activity) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Left: UBU Flow History Spline Chart */}
        <div className="xl:col-span-6 flex flex-col">
          <UbuFlowChart ledger={ledger} />
        </div>

        {/* Right: Top Split (Quick Till + Node Card) + Bottom Recent UBU Activity */}
        <div className="xl:col-span-6 flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <QuickChargeCard
              unitId={unitId}
              prefillHandle={prefillHandle}
              onCompleted={onRefresh}
              showToast={showToast}
            />
            <UnitNodeCard
              unitId={overview?.unit_id || unitId}
              unitName={overview?.unit_name || 'Khumalo Spaza Store'}
              township={overview?.township || 'Soweto'}
              openPaymentsId={overview?.open_payments_id || '$spazauniti.org/unit-104'}
              broadcastEnabled={overview?.broadcast_enabled ?? true}
              onNavigateTab={onNavigateTab}
            />
          </div>

          {/* Recent Activity card matching bottom-right of ubu-one-ui.jpeg */}
          <div className="ubu-card-surface rounded-2xl p-5 flex-1">
            <div className="flex items-center justify-between gap-3 mb-3.5">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white tracking-tight">
                  Recent Activity
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('till')}
                  className="text-[11px] text-[#38C3FF] hover:underline font-medium cursor-pointer"
                >
                  View all
                </button>
              </div>

              <select
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value)}
                className="h-8 px-2.5 rounded-lg bg-[#1A264E] border border-white/10 text-xs text-[#D2D7DF] focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-[#0F1735]">All events</option>
                <option value="COUNTER_SALE" className="bg-[#0F1735]">Counter UBU</option>
                <option value="CHANGE_IN_UBU" className="bg-[#0F1735]">Change-in-UBU</option>
                <option value="SETTLEMENT" className="bg-[#0F1735]">Settlements</option>
              </select>
            </div>

            <div className="space-y-2.5">
              {filteredActivity.map((entry) => {
                const vis = getActivityVisual(entry)
                const Icon = vis.icon
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 py-2 px-2.5 rounded-xl hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 ${vis.iconBg}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {vis.title}
                        </div>
                        <div className="text-[11px] text-[#8E9BB8] truncate">
                          {entry.description}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className={`text-sm font-semibold tabular-nums ${vis.amountClass}`}>
                        {vis.sign}
                        {formatUBU(entry.amount_ubu, false)} UBU
                      </div>
                      <div className="text-[10px] text-[#7F8CAE] mt-0.5">
                        {formatShortDate(entry.created_at)}
                      </div>
                    </div>
                  </div>
                )
              })}

              {filteredActivity.length === 0 && (
                <div className="py-6 text-center text-xs text-[#9AA7C4] flex flex-col items-center gap-1.5">
                  <Sparkles className="w-5 h-5 text-[#00A2E8]" />
                  <span>No activity matches this filter yet. Try a R1 Counter Charge!</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

