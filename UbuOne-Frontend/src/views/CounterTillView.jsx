import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowRightLeft,
  Coins,
  Filter,
  Loader2,
  Search,
  ShieldCheck,
  ShoppingBag,
  Users,
  Wallet,
} from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '../components/ui/primitives'
import {
  fetchConsumerProfile,
  postChangeInUbu,
  postCounterCharge,
  searchConsumers,
} from '../lib/api'
import { OfflineMerchantTillBox } from '../components/OfflineKhokhaWidgets'
import { cn, formatShortDate, formatUBU, formatZAR, sanitizeHandle } from '../lib/utils'

const DEMO_HANDLES = [
  { handle: 'lethabomorake', label: 'Lethabo (School Child · PIN 1234)' },
  { handle: 'azariamorake', label: 'Azaria (Family Member · PIN 1234)' },
  { handle: 'mannini', label: 'Mannini (Individual · PIN 1234)' },
  { handle: 'sipho', label: 'Sipho (Individual · PIN 1234)' },
]

export function CounterTillView({ unitId, overview, prefillHandle, onRefresh, showToast }) {
  const [customerHandle, setCustomerHandle] = useState('lethabomorake')
  const [searchResults, setSearchResults] = useState([])
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)

  // Charge form state
  const [amount, setAmount] = useState('1')
  const [pin, setPin] = useState('1234')
  const [itemsDesc, setItemsDesc] = useState('R1 Lollipop & School Snack')
  const [sourceMode, setSourceMode] = useState('AUTO') // AUTO | FAMILY_VAULT | PERSONAL
  const [submittingCharge, setSubmittingCharge] = useState(false)
  const [offlineTill, setOfflineTill] = useState(false)

  // Change-in-UBU form state
  const [cashReceived, setCashReceived] = useState('50')
  const [saleTotal, setSaleTotal] = useState('43')
  const [changeNote, setChangeNote] = useState('Physical cash change settled in UBU')
  const [submittingChange, setSubmittingChange] = useState(false)

  // Ledger filter
  const [ledgerFilter, setLedgerFilter] = useState('ALL')
  const [ledgerSearch, setLedgerSearch] = useState('')

  useEffect(() => {
    if (prefillHandle) setCustomerHandle(sanitizeHandle(prefillHandle))
  }, [prefillHandle])

  useEffect(() => {
    const clean = sanitizeHandle(customerHandle)
    if (clean.length < 2) {
      setProfile(null)
      setSearchResults([])
      return
    }
    let active = true
    const t = setTimeout(async () => {
      setLoadingProfile(true)
      try {
        const list = await searchConsumers(clean)
        if (active && Array.isArray(list)) setSearchResults(list.slice(0, 5))
        const prof = await fetchConsumerProfile(clean).catch(() => null)
        if (active) setProfile(prof)
      } finally {
        if (active) setLoadingProfile(false)
      }
    }, 220)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [customerHandle])

  const activeLink = useMemo(() => {
    if (!profile) return null
    const incoming = profile.incoming_allocations || []
    return incoming.find((l) => l.status === 'ACTIVE') || incoming[0] || null
  }, [profile])

  const calculatedChange = Math.max(0, Number(cashReceived || 0) - Number(saleTotal || 0))

  const handleCounterCharge = async (e) => {
    e.preventDefault()
    const clean = sanitizeHandle(customerHandle)
    const amt = Number(amount)
    if (!clean || !amt || amt <= 0) {
      showToast?.('Enter valid @handle and UBU amount', 'error')
      return
    }
    setSubmittingCharge(true)
    try {
      const res = await postCounterCharge(unitId, {
        customer_username: clean,
        pin: pin.trim(),
        amount_ubu: amt,
        items_description: itemsDesc.trim() || `${amt} UBU Purchase`,
        source_mode: sourceMode,
        sponsor_username: activeLink?.sponsor_username || profile?.family_parent_username || undefined,
      })
      showToast?.(res.message || `Charged ${formatUBU(amt)} from @${clean}`, 'success')
      const updatedProf = await fetchConsumerProfile(clean).catch(() => null)
      if (updatedProf) setProfile(updatedProf)
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Counter charge rejected', 'error')
    } finally {
      setSubmittingCharge(false)
    }
  }

  const handleIssueChange = async (e) => {
    e.preventDefault()
    const clean = sanitizeHandle(customerHandle)
    if (!clean || calculatedChange <= 0) {
      showToast?.('Cash received must exceed sale total and @handle must be valid', 'error')
      return
    }
    setSubmittingChange(true)
    try {
      const res = await postChangeInUbu(unitId, {
        customer_username: clean,
        cash_received: Number(cashReceived),
        sale_total: Number(saleTotal),
        note: changeNote.trim(),
      })
      showToast?.(
        res.message || `Issued +${formatUBU(calculatedChange)} change to @${clean}`,
        'success'
      )
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Change-in-UBU failed', 'error')
    } finally {
      setSubmittingChange(false)
    }
  }

  const filteredLedger = useMemo(() => {
    return (overview?.ledger || []).filter((item) => {
      if (ledgerFilter !== 'ALL' && item.event_type !== ledgerFilter) return false
      if (ledgerSearch.trim()) {
        const q = ledgerSearch.toLowerCase()
        const hay = `${item.description} ${item.from_username || ''} ${item.to_username || ''} ${item.source_bucket}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [overview?.ledger, ledgerFilter, ledgerSearch])

  return (
    <div className="space-y-6">
      {/* Customer Handle Resolver Strip */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            <div className="lg:col-span-6 space-y-2">
              <label className="text-xs font-semibold text-[#D2D7DF] uppercase tracking-wider">
                Customer Wallet Handle
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#7F8CAE] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <span className="text-sm font-bold text-[#38C3FF] absolute left-9 top-1/2 -translate-y-1/2 pointer-events-none">
                  @
                </span>
                <Input
                  value={customerHandle}
                  onChange={(e) => setCustomerHandle(e.target.value.replace(/^@+/, ''))}
                  placeholder="lethabomorake or sipho"
                  className="pl-13"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {DEMO_HANDLES.map((d) => (
                  <button
                    key={d.handle}
                    type="button"
                    onClick={() => setCustomerHandle(d.handle)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all cursor-pointer',
                      sanitizeHandle(customerHandle) === d.handle
                        ? 'bg-[#00A2E8]/20 border-[#00A2E8]/55 text-[#38C3FF]'
                        : 'bg-[#1A254B] border-white/10 text-[#9AA7C4] hover:text-white'
                    )}
                  >
                    @{d.handle}
                  </button>
                ))}
              </div>
              {searchResults.length > 1 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {searchResults.map((r) => (
                    <button
                      key={r.username}
                      type="button"
                      onClick={() => setCustomerHandle(r.username)}
                      className="text-[11px] text-[#9AA7C4] hover:text-white underline cursor-pointer"
                    >
                      {r.full_name} (@{r.username})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Live Consumer & Family Pool Context Box */}
            <div className="lg:col-span-6">
              {loadingProfile && !profile ? (
                <div className="p-4 rounded-xl bg-[#10193A] border border-white/10 text-xs text-[#9AA7C4] flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#00A2E8]" />
                  Resolving Open Payments &amp; Family Vault permissions...
                </div>
              ) : profile ? (
                <div className="p-4 rounded-xl bg-[#0F1735] border border-[#00A2E8]/30 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        {profile.full_name}
                        <Badge variant="cyber">{profile.account_type}</Badge>
                      </div>
                      <div className="text-xs text-[#9AA7C4] font-mono-code">
                        @{profile.username} · {profile.open_payments_id}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-[#38E4AE] tabular-nums">
                        {formatUBU(profile.ubu_balance)}
                      </div>
                      <div className="text-[10px] text-[#9AA7C4]">Personal UBU</div>
                    </div>
                  </div>

                  {activeLink && (
                    <div className="p-2.5 rounded-lg bg-[#17234B] border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 text-[#8AD9FF]">
                        <Users className="w-3.5 h-3.5" />
                        Funded by <strong className="text-white">@{activeLink.sponsor_username}</strong> ({activeLink.relationship_label})
                      </span>
                      <span className="font-semibold text-[#38E4AE] tabular-nums">
                        {formatUBU(activeLink.remaining_in_period_ubu, false)} /{' '}
                        {formatUBU(activeLink.allocation_limit_ubu, false)} UBU ({activeLink.period})
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#10193A] border border-white/10 text-xs text-[#9AA7C4]">
                  Type any registered SpazaUniti customer handle to view their personal UBU balance and family/beneficiary allowance.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two Till Workbench Cards: Left = Charge UBU | Right = Cash Change-in-UBU */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Counter Charge Terminal */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#00A2E8]/15 border border-[#00A2E8]/30 flex items-center justify-center text-[#00A2E8]">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <CardTitle>Counter UBU Charge (R1 Moments)</CardTitle>
                <p className="text-xs text-[#9AA7C4]">
                  Instant R0.00 fee deduction from Family Vault or Personal Wallet
                </p>
              </div>
            </div>
            <button type='button' onClick={() => setOfflineTill(!offlineTill)} className='px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#38E4AE]/20 border border-[#38E4AE]/50 text-[#38E4AE] cursor-pointer'>{offlineTill ? 'Online Till' : 'Offline Khokha Till'}</button>
          </CardHeader>
          <CardContent>
            {offlineTill ? <OfflineMerchantTillBox unitId={unitId} merchantWallet={overview?.wallet_address || "https://ilp.interledger-test.dev/spazakhokha-shop"} showToast={showToast} /> : <form onSubmit={handleCounterCharge} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#D2D7DF] mb-1.5 font-medium">
                    Amount (UBU)
                  </label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="tabular-nums font-bold"
                  />
                  <div className="flex gap-1.5 mt-2">
                    {[1, 2, 5, 10, 20].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAmount(String(v))}
                        className="px-2 py-0.5 rounded bg-[#1B2854] hover:bg-[#00A2E8]/25 text-[11px] font-semibold text-[#D2D7DF] hover:text-white cursor-pointer"
                      >
                        R{v}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#D2D7DF] mb-1.5 font-medium">
                    Customer PIN
                  </label>
                  <Input
                    type="password"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="font-mono-code tracking-widest"
                  />
                  <p className="text-[10px] text-[#8E9BB8] mt-2">
                    Demo accounts use PIN 1234
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#D2D7DF] mb-1.5 font-medium">
                  Basket / Items Description
                </label>
                <Input
                  value={itemsDesc}
                  onChange={(e) => setItemsDesc(e.target.value)}
                  placeholder="e.g. R1 Lollipop, Albany Bread, Simba Chips"
                />
              </div>

              <div>
                <label className="block text-xs text-[#D2D7DF] mb-1.5 font-medium">
                  Debit Source Routing
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'AUTO', label: 'Smart Auto' },
                    { id: 'FAMILY_VAULT', label: 'Family Pool' },
                    { id: 'PERSONAL', label: 'Personal Wallet' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSourceMode(opt.id)}
                      className={cn(
                        'py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer',
                        sourceMode === opt.id
                          ? 'bg-[#00A2E8]/20 border-[#00A2E8] text-white'
                          : 'bg-[#17234B] border-white/10 text-[#9AA7C4] hover:text-white'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button type="submit" disabled={submittingCharge} className="w-full h-11">
                {submittingCharge ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing Open Payments Edge Debit...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Approve Counter Sale ({formatUBU(amount)})
                  </>
                )}
              </Button>
            </form>}
          </CardContent>
        </Card>

        {/* Cash Change-in-UBU Converter */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center text-[#38E4AE]">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
              <div>
                <CardTitle>Cash Change-in-UBU Drawer</CardTitle>
                <p className="text-xs text-[#9AA7C4]">
                  No coins at the till? Issue exact change digitally into customer UBU
                </p>
              </div>
            </div>
            <Badge variant="cyber">No Coin Friction</Badge>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleIssueChange} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#D2D7DF] mb-1.5 font-medium">
                    Cash Tendered (R)
                  </label>
                  <Input
                    type="number"
                    step="0.5"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="tabular-nums font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#D2D7DF] mb-1.5 font-medium">
                    Sale Total (R)
                  </label>
                  <Input
                    type="number"
                    step="0.5"
                    value={saleTotal}
                    onChange={(e) => setSaleTotal(e.target.value)}
                    className="tabular-nums font-bold"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0F1735] border border-emerald-400/25 flex items-center justify-between">
                <div>
                  <div className="text-xs text-[#9AA7C4]">Digital Change Credited to @{sanitizeHandle(customerHandle)}</div>
                  <div className="text-[11px] text-[#38E4AE] mt-0.5">Added straight to SpazaUniti wallet</div>
                </div>
                <div className="text-2xl font-bold text-[#38E4AE] tabular-nums">
                  +{formatUBU(calculatedChange, false)} <span className="text-xs">UBU</span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#D2D7DF] mb-1.5 font-medium">
                  Till Note
                </label>
                <Input
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                disabled={submittingChange || calculatedChange <= 0}
                className="w-full h-11"
              >
                {submittingChange ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Issuing Change UBU...
                  </>
                ) : (
                  <>
                    <Coins className="w-4 h-4" />
                    Issue {formatUBU(calculatedChange)} Change
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Full Unit Micro-Ledger Table */}
      <Card>
        <CardHeader className="flex-wrap">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#00A2E8]" />
            <CardTitle>Live Unit Micro-Ledger ({filteredLedger.length})</CardTitle>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-52">
              <Filter className="w-3.5 h-3.5 text-[#7F8CAE] absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="Filter handle or note..."
                className="h-8 pl-8 text-xs"
              />
            </div>

            <select
              value={ledgerFilter}
              onChange={(e) => setLedgerFilter(e.target.value)}
              className="h-8 px-2.5 rounded-lg bg-[#1A264E] border border-white/10 text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-[#0F1735]">All Event Types</option>
              <option value="COUNTER_SALE" className="bg-[#0F1735]">Counter Sales</option>
              <option value="CHANGE_IN_UBU" className="bg-[#0F1735]">Change-in-UBU</option>
              <option value="SETTLEMENT" className="bg-[#0F1735]">Settlements</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[#9AA7C4] uppercase tracking-wider text-[10px]">
                <th className="py-3 pr-4">Event / Ref</th>
                <th className="py-3 pr-4">Handle / Counterparty</th>
                <th className="py-3 pr-4">Source Rail</th>
                <th className="py-3 pr-4">Description</th>
                <th className="py-3 pr-4 text-right">Fee</th>
                <th className="py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filteredLedger.map((row) => (
                <tr key={row.id} className="hover:bg-white/[0.02]">
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <div className="font-semibold text-white">{row.event_type}</div>
                    <div className="text-[10px] text-[#7F8CAE] font-mono-code">
                      {row.id} · {formatShortDate(row.created_at)}
                    </div>
                  </td>
                  <td className="py-3 pr-4 font-mono-code text-[#38C3FF]">
                    {row.event_type === 'COUNTER_SALE'
                      ? `@${row.from_username}`
                      : row.event_type === 'CHANGE_IN_UBU'
                        ? `-> @${row.to_username}`
                        : row.to_username}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant={row.source_bucket === 'FAMILY_POOL' ? 'cyber' : 'default'}>
                      {row.source_bucket}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 text-[#D2D7DF] max-w-xs truncate">
                    {row.description}
                  </td>
                  <td className="py-3 pr-4 text-right text-[#38E4AE] font-semibold tabular-nums">
                    {formatZAR(row.fee_zar)}
                  </td>
                  <td className="py-3 text-right font-bold tabular-nums">
                    <span
                      className={
                        row.event_type === 'COUNTER_SALE'
                          ? 'text-[#38E4AE]'
                          : row.event_type === 'SETTLEMENT'
                            ? 'text-[#F46B78]'
                            : 'text-white'
                      }
                    >
                      {row.event_type === 'COUNTER_SALE' ? '+' : '-'}
                      {formatUBU(row.amount_ubu)}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredLedger.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-[#9AA7C4]">
                    No ledger rows match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

