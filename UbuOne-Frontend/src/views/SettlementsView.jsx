import React, { useMemo, useState } from 'react'
import { Building2, CheckCircle2, Landmark, Loader2, ShieldCheck, Truck } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '../components/ui/primitives'
import { postUnitSettlement } from '../lib/api'
import { OfflineBatchSyncBanner } from '../components/OfflineKhokhaWidgets'
import { cn, formatShortDate, formatUBU, formatZAR } from '../lib/utils'

const WHOLESALER_PRESETS = [
  { name: 'Makro Wholesale ZA', pointer: '$ilp.interledger-test.dev/makro_za' },
  { name: 'Jumbo Cash & Carry', pointer: '$ilp.interledger-test.dev/jumbo_soweto' },
  { name: 'Tiger Brands Direct', pointer: '$ilp.interledger-test.dev/tiger_brands' },
]

export function SettlementsView({ unitId, overview, onRefresh, showToast }) {
  const [settlementType, setSettlementType] = useState('WHOLESALER_OPEN_PAYMENTS')
  const [amount, setAmount] = useState('100')
  const [pointer, setPointer] = useState('$ilp.interledger-test.dev/makro_za')
  const [submitting, setSubmitting] = useState(false)

  const unitBalance = Number(overview?.unit_ubu_balance || 0)
  const settlements = useMemo(
    () => (overview?.ledger || []).filter((e) => e.event_type === 'SETTLEMENT'),
    [overview?.ledger]
  )

  const estimatedFee = settlementType === 'WHOLESALER_OPEN_PAYMENTS' ? 0 : 2.5

  const handleSettle = async (e) => {
    e.preventDefault()
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      showToast?.('Enter a valid UBU settlement amount', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await postUnitSettlement(unitId, {
        amount_ubu: amt,
        settlement_type: settlementType,
        destination_pointer: pointer.trim(),
      })
      showToast?.(
        res.message || `Settled ${formatUBU(amt)} cleanly`,
        'success'
      )
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Settlement failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <OfflineBatchSyncBanner unitId={unitId} merchantWallet={overview?.wallet_address || "https://ilp.interledger-test.dev/spazakhokha-shop"} onRefresh={onRefresh} showToast={showToast} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: UBU-to-Fiat & Wholesaler Payout Form */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <div>
              <CardTitle>Settle Unit Float to Stock or Fiat</CardTitle>
              <p className="text-xs text-[#9AA7C4] mt-1">
                Instead of paying bank fees on every R1 lollipop, settle accumulated Unit UBU directly to wholesalers at R0 fee or batch once per day to EFT.
              </p>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSettle} className="space-y-5">
              {/* Two Rail Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSettlementType('WHOLESALER_OPEN_PAYMENTS')
                    setPointer('$ilp.interledger-test.dev/makro_za')
                  }}
                  className={cn(
                    'text-left p-4 rounded-2xl border transition-all cursor-pointer',
                    settlementType === 'WHOLESALER_OPEN_PAYMENTS'
                      ? 'bg-[#00A2E8]/15 border-[#00A2E8] shadow-[0_0_24px_rgba(0,162,232,0.18)]'
                      : 'bg-[#0F1735] border-white/10 hover:border-white/25'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Truck className="w-5 h-5 text-[#00A2E8]" />
                    <Badge variant="mint">R0.00 Fee</Badge>
                  </div>
                  <div className="text-sm font-bold text-white">Wholesaler Open Payments</div>
                  <div className="text-[11px] text-[#9AA7C4] mt-1">
                    Restock bread, sugar, snacks via instant ILP wallet transfer
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSettlementType('BATCHED_BANK_EFT')
                    setPointer('Capitec Business Acc · 1490882104')
                  }}
                  className={cn(
                    'text-left p-4 rounded-2xl border transition-all cursor-pointer',
                    settlementType === 'BATCHED_BANK_EFT'
                      ? 'bg-[#00A2E8]/15 border-[#00A2E8] shadow-[0_0_24px_rgba(0,162,232,0.18)]'
                      : 'bg-[#0F1735] border-white/10 hover:border-white/25'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Landmark className="w-5 h-5 text-[#D2D7DF]" />
                    <Badge variant="cyber">R2.50 Batched</Badge>
                  </div>
                  <div className="text-sm font-bold text-white">Batched Bank EFT Payout</div>
                  <div className="text-[11px] text-[#9AA7C4] mt-1">
                    End-of-day bulk sweep to your South African business account
                  </div>
                </button>
              </div>

              {settlementType === 'WHOLESALER_OPEN_PAYMENTS' && (
                <div>
                  <div className="text-[11px] font-semibold text-[#9AA7C4] uppercase tracking-wider mb-2">
                    Verified Township Suppliers
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {WHOLESALER_PRESETS.map((w) => (
                      <button
                        key={w.pointer}
                        type="button"
                        onClick={() => setPointer(w.pointer)}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer',
                          pointer === w.pointer
                            ? 'bg-[#00A2E8]/20 border-[#00A2E8] text-white'
                            : 'bg-[#17234B] border-white/10 text-[#9AA7C4] hover:text-white'
                        )}
                      >
                        {w.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#D2D7DF] mb-1.5">
                    Amount to Settle (UBU)
                  </label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    max={unitBalance}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="tabular-nums font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#D2D7DF] mb-1.5">
                    Destination ILP Pointer / Bank Account
                  </label>
                  <Input
                    value={pointer}
                    onChange={(e) => setPointer(e.target.value)}
                    className="font-mono-code text-xs"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0F1735] border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div className="text-[#9AA7C4]">Available Unit Float</div>
                  <div className="text-base font-bold text-white tabular-nums">
                    {formatUBU(unitBalance)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[#9AA7C4]">Estimated Rail Fee</div>
                  <div className="text-base font-bold text-[#38E4AE] tabular-nums">
                    {formatZAR(estimatedFee)}
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting || Number(amount) > unitBalance}
                className="w-full h-11"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Executing Settlement...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Execute {formatUBU(amount)} Settlement
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right: Settlement Ledger */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#00A2E8]" />
              <CardTitle>Completed Settlements</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {settlements.map((s) => (
              <div
                key={s.id}
                className="p-3.5 rounded-xl bg-[#0F1735] border border-white/10 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white truncate">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#38E4AE] shrink-0" />
                    {s.to_username}
                  </div>
                  <div className="text-[11px] text-[#9AA7C4] truncate mt-0.5">
                    {s.description}
                  </div>
                  <div className="text-[10px] text-[#7F8CAE] mt-0.5">
                    {formatShortDate(s.created_at)} · Fee {formatZAR(s.fee_zar)}
                  </div>
                </div>
                <div className="text-sm font-bold text-[#F46B78] tabular-nums shrink-0">
                  -{formatUBU(s.amount_ubu)}
                </div>
              </div>
            ))}
            {settlements.length === 0 && (
              <div className="py-10 text-center text-xs text-[#9AA7C4]">
                No settlements executed yet. Keep UBU in the pool or sweep to a wholesaler above.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

