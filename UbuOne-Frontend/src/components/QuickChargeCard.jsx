import React, { useEffect, useState } from 'react'
import { ArrowRightLeft, Coins, Loader2, ShieldCheck, Users } from 'lucide-react'
import { Button, Input, Badge } from './ui/primitives'
import {
  fetchConsumerProfile,
  postChangeInUbu,
  postCounterCharge,
  searchConsumers,
} from '../lib/api'
import { cn, formatUBU, sanitizeHandle } from '../lib/utils'

const QUICK_HANDLES = ['lethabomorake', 'azariamorake', 'sipho', 'mannini']
const QUICK_AMOUNTS = [1, 2, 5, 10]

export function QuickChargeCard({ unitId, onCompleted, showToast, prefillHandle }) {
  const [mode, setMode] = useState('charge') // 'charge' | 'change'
  const [handle, setHandle] = useState('lethabomorake')
  const [amount, setAmount] = useState('1')
  const [pin, setPin] = useState('1234')
  const [note, setNote] = useState('R1 Snack / Daily Essentials')

  const [cashReceived, setCashReceived] = useState('50')
  const [saleTotal, setSaleTotal] = useState('43')

  const [suggestions, setSuggestions] = useState([])
  const [resolvedProfile, setResolvedProfile] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (prefillHandle) {
      setHandle(sanitizeHandle(prefillHandle))
    }
  }, [prefillHandle])

  // Lookup resolved consumer handle softly when handle looks complete
  useEffect(() => {
    const clean = sanitizeHandle(handle)
    if (clean.length < 3) {
      setResolvedProfile(null)
      setSuggestions([])
      return
    }
    let active = true
    const t = setTimeout(async () => {
      try {
        const results = await searchConsumers(clean)
        if (active && Array.isArray(results)) {
          setSuggestions(results.slice(0, 4))
        }
        const prof = await fetchConsumerProfile(clean).catch(() => null)
        if (active) setResolvedProfile(prof)
      } catch {
        if (active) setResolvedProfile(null)
      }
    }, 220)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [handle])

  const familySponsor =
    resolvedProfile?.family_parent_username ||
    resolvedProfile?.incoming_allocations?.find((l) => l.status === 'ACTIVE')?.sponsor_username

  const computedChange = Math.max(
    0,
    Number(cashReceived || 0) - Number(saleTotal || 0)
  )

  const handleChargeSubmit = async (e) => {
    e.preventDefault()
    const clean = sanitizeHandle(handle)
    const amt = Number(amount)
    if (!clean) {
      showToast?.('Enter a customer @handle first', 'error')
      return
    }
    if (!amt || amt <= 0) {
      showToast?.('Enter a valid UBU amount', 'error')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        customer_username: clean,
        pin: pin.trim(),
        amount_ubu: amt,
        items_description: note.trim() || `${amt} UBU Counter Purchase`,
        source_mode: resolvedProfile?.family_parent_username ? 'FAMILY_VAULT' : 'AUTO',
        sponsor_username: familySponsor || undefined,
      }
      const res = await postCounterCharge(unitId, payload)
      showToast?.(
        res.message || `Charged ${formatUBU(amt)} from @${clean} (R0.00 fee)`,
        'success'
      )
      onCompleted?.()
    } catch (err) {
      showToast?.(err.message || 'Counter charge failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleChangeSubmit = async (e) => {
    e.preventDefault()
    const clean = sanitizeHandle(handle)
    if (!clean) {
      showToast?.('Enter customer @handle to receive UBU change', 'error')
      return
    }
    if (computedChange <= 0) {
      showToast?.('Cash received must exceed sale total', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await postChangeInUbu(unitId, {
        customer_username: clean,
        cash_received: Number(cashReceived),
        sale_total: Number(saleTotal),
        note: `Cash R${cashReceived} for R${saleTotal} -> ${computedChange.toFixed(2)} UBU change`,
      })
      showToast?.(
        res.message || `Issued ${formatUBU(computedChange)} change to @${clean}`,
        'success'
      )
      onCompleted?.()
    } catch (err) {
      showToast?.(err.message || 'Change-in-UBU failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="ubu-card-surface rounded-2xl p-5 flex flex-col justify-between h-full">
      <div>
        {/* Header matching "Quick Transfer" visual alignment */}
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <h3 className="text-base font-semibold text-white tracking-tight">
            Quick Counter Till
          </h3>
          <div className="inline-flex items-center p-0.5 rounded-lg bg-[#1A264E] border border-white/10">
            <button
              type="button"
              onClick={() => setMode('charge')}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer',
                mode === 'charge'
                  ? 'bg-[#00A2E8] text-white'
                  : 'text-[#9AA7C4] hover:text-white'
              )}
            >
              Charge
            </button>
            <button
              type="button"
              onClick={() => setMode('change')}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer',
                mode === 'change'
                  ? 'bg-[#00A2E8] text-white'
                  : 'text-[#9AA7C4] hover:text-white'
              )}
            >
              Change
            </button>
          </div>
        </div>

        {/* Quick tap consumer chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {QUICK_HANDLES.map((h) => {
            const active = sanitizeHandle(handle) === h
            return (
              <button
                key={h}
                type="button"
                onClick={() => setHandle(h)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors cursor-pointer',
                  active
                    ? 'bg-[#00A2E8]/20 border-[#00A2E8]/60 text-[#38C3FF]'
                    : 'bg-[#1A254B] border-white/8 text-[#9AA7C4] hover:text-white'
                )}
              >
                @{h}
              </button>
            )
          })}
        </div>

        {mode === 'charge' ? (
          <form onSubmit={handleChargeSubmit} className="space-y-2.5">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#38C3FF] pointer-events-none">
                @
              </span>
              <Input
                value={handle}
                onChange={(e) => setHandle(e.target.value.replace(/^@+/, ''))}
                placeholder="customer_handle"
                aria-label="Customer handle"
                className="h-9 text-xs font-medium pl-7 pr-24"
              />
              {resolvedProfile && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#38E4AE]">
                  {formatUBU(resolvedProfile.ubu_balance, false)} UBU
                </span>
              )}
            </div>

            {resolvedProfile && familySponsor && (
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#00A2E8]/10 border border-[#00A2E8]/25 text-[10px] text-[#8AD9FF]">
                <span className="inline-flex items-center gap-1 truncate">
                  <Users className="w-3 h-3 shrink-0" />
                  Pool: @{familySponsor}
                </span>
                <span className="font-semibold text-[#38E4AE] shrink-0">R0 Fee</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="UBU"
                  aria-label="Amount UBU"
                  className="h-9 text-xs tabular-nums"
                />
              </div>
              <div>
                <Input
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="PIN"
                  aria-label="Customer PIN"
                  className="h-9 text-xs font-mono-code tracking-widest"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-1.5 pt-0.5">
              <div className="flex items-center gap-1">
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmount(String(q))}
                    className={cn(
                      'px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer',
                      Number(amount) === q
                        ? 'bg-[#00A2E8]/25 text-white border border-[#00A2E8]/40'
                        : 'bg-[#1A254B] text-[#9AA7C4] hover:text-white'
                    )}
                  >
                    R{q}
                  </button>
                ))}
              </div>
              <Badge variant="mint" className="text-[10px] px-2 py-0">
                <ShieldCheck className="w-3 h-3" />
                {Number(amount || 0).toFixed(0)} UBU
              </Badge>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-10 mt-1 rounded-xl text-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Settling...
                </>
              ) : (
                <>
                  <Coins className="w-4 h-4" />
                  Charge {Number(amount || 0).toFixed(2)} UBU
                </>
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleChangeSubmit} className="space-y-2.5">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#38C3FF] pointer-events-none">
                @
              </span>
              <Input
                value={handle}
                onChange={(e) => setHandle(e.target.value.replace(/^@+/, ''))}
                placeholder="customer_handle"
                className="h-9 text-xs font-medium pl-7"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                step="0.5"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="Cash R"
                title="Cash handed by customer"
                className="h-9 text-xs tabular-nums"
              />
              <Input
                type="number"
                step="0.5"
                value={saleTotal}
                onChange={(e) => setSaleTotal(e.target.value)}
                placeholder="Sale R"
                title="Total basket price"
                className="h-9 text-xs tabular-nums"
              />
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#1A264E] text-[11px]">
              <span className="text-[#9AA7C4]">Change to Wallet</span>
              <span className="font-bold text-[#38E4AE] tabular-nums">
                +{computedChange.toFixed(2)} UBU
              </span>
            </div>
            <Button
              type="submit"
              disabled={submitting || computedChange <= 0}
              className="w-full h-10 mt-1 rounded-xl text-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Issuing...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4" />
                  Issue Change UBU
                </>
              )}
            </Button>
          </form>
        )}
      </div>

      {/* Silent search match indicator if user typed a prefix */}
      {suggestions.length > 0 && !resolvedProfile && (
        <div className="mt-2 flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <button
              key={s.username}
              type="button"
              onClick={() => setHandle(s.username)}
              className="text-[10px] px-2 py-0.5 rounded bg-[#1C2852] text-[#8AD9FF] hover:text-white cursor-pointer"
            >
              @{s.username} ({s.full_name.split(' ')[0]})
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

