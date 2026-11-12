import React, { useState } from 'react'
import { Coins, Loader2, ShieldCheck, ShoppingBag, Store, Wallet } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '../components/ui/primitives'
import {
  cashoutConsumerTokens,
  fundConsumerUbuRBAC,
  fundFamilyPoolRBAC,
  payUnitFromConsumer,
} from '../lib/api'
import { OfflineConsumerPayBox } from '../components/OfflineKhokhaWidgets'
import { cn, formatUBU, formatZAR } from '../lib/utils'

const PRESET_ITEMS = [
  { label: 'R1 Lollipop', amount: 1 },
  { label: 'R5 Fresh Vetkoek', amount: 5 },
  { label: 'R16 Albany Bread', amount: 16 },
  { label: 'R42 Maize Meal 5kg', amount: 42 },
]

export function ConsumerPayUnitView({ actor, workspace, onRefresh, showToast }) {
  const units = workspace?.units || []
  const profile = workspace?.profile || {}
  const role = actor?.consumer_role || 'ADULT_INDIVIDUAL'

  const [selectedUnit, setSelectedUnit] = useState(units[0]?.id || 'unit-104')
  const [amount, setAmount] = useState('1')
  const [desc, setDesc] = useState('R1 Lollipop / Snack')
  const [sourceMode, setSourceMode] = useState(
    role === 'FAMILY_MEMBER' ? 'FAMILY_POOL' : 'AUTO'
  )
  const [busy, setBusy] = useState(false)
  const [offlineMode, setOfflineMode] = useState(false)

  const unit104Tokens = Number(profile.ubuntu_tokens?.['unit-104'] || 0)

  const handlePay = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await payUnitFromConsumer(actor.username, {
        unit_id: selectedUnit,
        amount_ubu: Number(amount),
        items_description: desc.trim() || 'Spaza Unit Purchase',
        source_mode: sourceMode,
        sponsor_username: actor.family_vault_username || undefined,
      })
      showToast?.(res.message, 'success')
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Unit payment declined', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleCashoutTokens = async () => {
    setBusy(true)
    try {
      const res = await cashoutConsumerTokens(actor.username, 'unit-104', 20.0)
      showToast?.(res.receipt_message || 'Cashed out 20 Ubuntu Tokens!', 'success')
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Cashout unavailable', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Participating Units List */}
      <Card className="lg:col-span-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-[#00A2E8]" />
            <CardTitle>Choose Participating Spaza Unit</CardTitle>
          </div>
          <Badge variant="mint">Zero Micro-Fees</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {units.map((u) => {
            const active = selectedUnit === u.id
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedUnit(u.id)}
                className={cn(
                  'w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3',
                  active
                    ? 'bg-[#00A2E8]/15 border-[#00A2E8]'
                    : 'bg-[#0F1735] border-white/10 hover:border-white/25'
                )}
              >
                <div>
                  <div className="text-sm font-bold text-white">{u.name}</div>
                  <div className="text-xs text-[#9AA7C4] mt-0.5">{u.tagline}</div>
                  <div className="text-[11px] text-[#38C3FF] font-mono-code mt-1">
                    {u.open_payments_id} · {u.township}
                  </div>
                </div>
                {active && <Badge variant="cyber">Selected</Badge>}
              </button>
            )
          })}
        </CardContent>
      </Card>

      {/* Right: Pay Store + Loyalty Cashout */}
      <div className="lg:col-span-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#38E4AE]" />
              <CardTitle>Pay Counter at {units.find((x) => x.id === selectedUnit)?.name || selectedUnit}</CardTitle>
            </div>
            <button type='button' onClick={() => setOfflineMode(!offlineMode)} className='px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#38E4AE]/20 border border-[#38E4AE]/50 text-[#38E4AE] cursor-pointer'>{offlineMode ? 'Switch to Online UBU' : 'Offline Khokha QR'}</button>
            <div className='hidden'>
            </div>
          </CardHeader>
          <CardContent>
            {offlineMode ? <OfflineConsumerPayBox actorHandle={actor?.username} unitId={selectedUnit} merchantWallet={units.find((x) => x.id === selectedUnit)?.wallet_address || "https://ilp.interledger-test.dev/spazakhokha-shop"} amount={amount} showToast={showToast} /> : <form onSubmit={handlePay} className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {PRESET_ITEMS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setAmount(String(item.amount))
                      setDesc(item.label)
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#18244B] hover:bg-[#00A2E8]/25 border border-white/10 text-xs font-semibold text-white cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#D2D7DF] mb-1">Amount (UBU)</label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="tabular-nums font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#D2D7DF] mb-1">Description</label>
                  <Input value={desc} onChange={(e) => setDesc(e.target.value)} required />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#D2D7DF] mb-1.5">Funding Source</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'AUTO', label: 'Smart Auto' },
                    { id: 'FAMILY_POOL', label: 'Family Pool' },
                    { id: 'PERSONAL_UBU', label: 'Personal UBU' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSourceMode(opt.id)}
                      className={cn(
                        'py-2 px-3 rounded-xl text-xs font-semibold border cursor-pointer',
                        sourceMode === opt.id
                          ? 'bg-[#00A2E8]/20 border-[#00A2E8] text-white'
                          : 'bg-[#17234B] border-white/10 text-[#9AA7C4]'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button type="submit" disabled={busy} className="w-full h-11">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Pay {formatUBU(amount)} (R0.00 Fee)
              </Button>
            </form>}
          </CardContent>
        </Card>

        {role !== 'FAMILY_MEMBER' && (
          <Card>
            <CardContent className="pt-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Coins className="w-4 h-4 text-[#38C3FF]" />
                  Ubuntu Loyalty Token Off-Ramp (Khumalo Spaza)
                </div>
                <div className="text-xs text-[#9AA7C4] mt-1">
                  Balance: <strong className="text-[#38E4AE]">{unit104Tokens.toFixed(2)} Tokens</strong> · Cash out at 20.00 UBU threshold for taxi/transport ZAR.
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || unit104Tokens < 20}
                onClick={handleCashoutTokens}
              >
                Cash Out 20 Tokens
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export function ConsumerLoadPoolView({ actor, familyOverview, workspace, onRefresh, showToast }) {
  const role = actor?.consumer_role || 'ADULT_INDIVIDUAL'
  const profile = workspace?.profile || {}
  const famVault = familyOverview?.family_vault || {}
  const targetHandle =
    role === 'FAMILY_ADMIN'
      ? actor?.family_vault_username || actor?.username
      : actor?.username

  const [amount, setAmount] = useState('100')
  const [source, setSource] = useState('OPEN_PAYMENTS')
  const [note, setNote] = useState('Single Open Payments UBU Load')
  const [busy, setBusy] = useState(false)
  const [offlineMode, setOfflineMode] = useState(false)

  const currentUbu =
    role === 'FAMILY_ADMIN' ? famVault.ubu_balance ?? profile.ubu_balance ?? 0 : profile.ubu_balance ?? 0
  const currentZar =
    role === 'FAMILY_ADMIN' ? famVault.zar_balance ?? profile.balance ?? 0 : profile.balance ?? 0

  const handleLoad = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const fn = role === 'FAMILY_ADMIN' ? fundFamilyPoolRBAC : fundConsumerUbuRBAC
      const res = await fn(targetHandle, {
        amount: Number(amount),
        source,
        note: note.trim(),
      })
      showToast?.(res.message || 'UBU pool funded!', 'success')
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Load failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#00A2E8]/15 border border-[#00A2E8]/35 flex items-center justify-center text-[#00A2E8]">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <CardTitle>
                {role === 'FAMILY_ADMIN'
                  ? `Load Family Pool (@${targetHandle})`
                  : `Load Adult UBU Wallet (@${targetHandle})`}
              </CardTitle>
              <p className="text-xs text-[#9AA7C4]">
                Make 1 Open Payments inflow once — spend R1 snacks and groceries across all Spaza Units at R0 per-transaction fees.
              </p>
            </div>
          </div>
          <Badge variant="mint">1 UBU = R1.00</Badge>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="p-4 rounded-xl bg-[#0F1735] border border-white/10">
              <div className="text-xs text-[#9AA7C4]">Current Spendable Pool</div>
              <div className="text-2xl font-bold text-[#38E4AE] mt-1 tabular-nums">
                {formatUBU(currentUbu)}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[#0F1735] border border-white/10">
              <div className="text-xs text-[#9AA7C4]">Open Payments ZAR Balance</div>
              <div className="text-2xl font-bold text-white mt-1 tabular-nums">
                {formatZAR(currentZar)}
              </div>
            </div>
          </div>

          <form onSubmit={handleLoad} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSource('OPEN_PAYMENTS')}
                className={cn(
                  'p-3.5 rounded-xl border text-left cursor-pointer',
                  source === 'OPEN_PAYMENTS'
                    ? 'bg-[#00A2E8]/15 border-[#00A2E8]'
                    : 'bg-[#0F1735] border-white/10'
                )}
              >
                <div className="text-xs font-bold text-white">External Open Payments Inflow</div>
                <div className="text-[11px] text-[#9AA7C4] mt-0.5">Bank / Capitec / Salary &rarr; UBU</div>
              </button>
              <button
                type="button"
                onClick={() => setSource('WALLET_BALANCE')}
                className={cn(
                  'p-3.5 rounded-xl border text-left cursor-pointer',
                  source === 'WALLET_BALANCE'
                    ? 'bg-[#00A2E8]/15 border-[#00A2E8]'
                    : 'bg-[#0F1735] border-white/10'
                )}
              >
                <div className="text-xs font-bold text-white">Convert My ZAR Wallet</div>
                <div className="text-[11px] text-[#9AA7C4] mt-0.5">Move ZAR into Spendable UBU</div>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#D2D7DF] mb-1">Amount (UBU / R)</label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="tabular-nums font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-[#D2D7DF] mb-1">Deposit Reference</label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>

            <Button type="submit" disabled={busy} className="w-full h-11">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Execute Single Open Payments Load (+{formatUBU(amount)})
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
