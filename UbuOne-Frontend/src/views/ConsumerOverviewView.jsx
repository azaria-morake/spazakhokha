import React, { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUpRight,
  Coins,
  HeartHandshake,
  Loader2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import { MiniSparkline, UbuFlowChart } from '../components/UbuFlowChart'
import { UnitNodeCard } from '../components/UnitNodeCard'
import { Badge, Button, Input } from '../components/ui/primitives'
import {
  allocateBeneficiaryRBAC,
  fundFamilyPoolRBAC,
  payUnitFromConsumer,
} from '../lib/api'
import { cn, formatShortDate, formatUBU, formatZAR } from '../lib/utils'

export function ConsumerOverviewView({
  actor,
  workspace,
  familyOverview,
  onRefresh,
  showToast,
  onNavigateTab,
}) {
  const role = actor?.consumer_role || 'ADULT_INDIVIDUAL'
  const profile = workspace?.profile || {}
  const units = workspace?.units || []
  const myFamilyLink = familyOverview?.my_allocation || workspace?.my_family_link

  const ledger =
    role === 'FAMILY_ADMIN'
      ? familyOverview?.ledger || workspace?.ledger || []
      : workspace?.ledger || []

  // Quick Card Mode
  const [quickMode, setQuickMode] = useState('pay') // 'pay' | 'fund' | 'send'
  const [selectedUnit, setSelectedUnit] = useState(units[0]?.id || 'unit-104')
  const [amount, setAmount] = useState('1')
  const [itemDesc, setItemDesc] = useState('R1 Lollipop / Counter Snack')
  const [selectedBenLink, setSelectedBenLink] = useState(
    profile?.beneficiaries?.find((b) => b.status === 'ACCEPTED')?.link_id || ''
  )
  const [submitting, setSubmitting] = useState(false)
  const [activityFilter, setActivityFilter] = useState('ALL')

  const acceptedBeneficiaries = useMemo(
    () => (profile?.beneficiaries || []).filter((b) => b.status === 'ACCEPTED'),
    [profile?.beneficiaries]
  )

  // KPI calculations tailored to Role
  const famVault = familyOverview?.family_vault || {}
  const primaryPoolUbu =
    role === 'FAMILY_ADMIN'
      ? Number(famVault.ubu_balance ?? profile.ubu_balance ?? 0)
      : role === 'FAMILY_MEMBER'
        ? Number(myFamilyLink?.remaining_in_period_ubu ?? 0)
        : Number(profile.ubu_balance ?? 0)

  const totalIncomingUbu = useMemo(() => {
    const dep = ledger
      .filter((e) => e.event_type === 'UBU_DEPOSIT' || e.event_type === 'CHANGE_IN_UBU' || e.event_type === 'BENEFICIARY_TRANSFER')
      .filter((e) => role === 'FAMILY_ADMIN' || e.to_username === actor?.username)
      .reduce((s, e) => s + Number(e.amount_ubu || 0), 0)
    return dep
  }, [ledger, role, actor?.username])

  const totalOutgoingUbu = useMemo(() => {
    return ledger
      .filter((e) => e.event_type === 'COUNTER_SALE' || e.event_type === 'BENEFICIARY_TRANSFER')
      .filter((e) => role === 'FAMILY_ADMIN' || e.from_username === actor?.username)
      .reduce((s, e) => s + Number(e.amount_ubu || 0), 0)
  }, [ledger, role, actor?.username])

  const filteredActivity = useMemo(() => {
    const list =
      activityFilter === 'ALL'
        ? ledger
        : ledger.filter((e) => e.event_type === activityFilter)
    return list.slice(0, 4)
  }, [ledger, activityFilter])

  const sparkValues = useMemo(() => {
    const vals = ledger
      .slice(0, 7)
      .reverse()
      .map((l) => Math.max(5, Number(l.amount_ubu || 1) * 4))
    return vals.length >= 4 ? vals : [18, 25, 20, 32, 28, 40, Math.max(20, primaryPoolUbu * 0.2)]
  }, [ledger, primaryPoolUbu])

  const handleQuickPay = async (e) => {
    e.preventDefault()
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      showToast?.('Enter a valid UBU amount', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await payUnitFromConsumer(actor.username, {
        unit_id: selectedUnit || 'unit-104',
        amount_ubu: amt,
        items_description: itemDesc.trim() || `${amt} UBU Purchase`,
        source_mode: role === 'FAMILY_MEMBER' ? 'FAMILY_POOL' : 'AUTO',
        sponsor_username: actor.family_vault_username || undefined,
      })
      showToast?.(res.message || 'Paid at R0.00 fee!', 'success')
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Payment declined', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleQuickFund = async (e) => {
    e.preventDefault()
    const amt = Number(amount)
    const famHandle = actor?.family_vault_username || actor?.username
    if (!amt || amt <= 0) return
    setSubmitting(true)
    try {
      const res = await fundFamilyPoolRBAC(famHandle, {
        amount: amt,
        source: 'OPEN_PAYMENTS',
        note: 'Quick Open Payments Family Pool Load',
      })
      showToast?.(res.message || `Funded +${amt} UBU into @${famHandle}`, 'success')
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Funding denied', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleQuickSendBeneficiary = async (e) => {
    e.preventDefault()
    const linkId = selectedBenLink || acceptedBeneficiaries[0]?.link_id
    if (!linkId) {
      showToast?.('Add or accept a beneficiary first under Beneficiaries', 'error')
      return
    }
    const amt = Number(amount)
    setSubmitting(true)
    try {
      const res = await allocateBeneficiaryRBAC(actor.username, linkId, {
        amount_ubu: amt,
        mode: 'TRANSFER',
        note: 'Quick UBU Beneficiary Send',
      })
      showToast?.(res.message || `Sent ${amt} UBU cleanly!`, 'success')
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Transfer failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const getActivityVisual = (entry) => {
    if (entry.event_type === 'UBU_DEPOSIT' || entry.event_type === 'CHANGE_IN_UBU') {
      return {
        icon: Wallet,
        iconBg: 'bg-emerald-500/15 text-[#38E4AE] border-emerald-400/25',
        sign: '+',
        amountClass: 'text-[#38E4AE]',
        title: entry.event_type === 'UBU_DEPOSIT' ? 'Open Payments Load' : `Change -> @${entry.to_username}`,
      }
    }
    if (entry.event_type === 'BENEFICIARY_TRANSFER') {
      const incoming = entry.to_username === actor?.username
      return {
        icon: HeartHandshake,
        iconBg: 'bg-[#00A2E8]/15 text-[#38C3FF] border-[#00A2E8]/25',
        sign: incoming ? '+' : '-',
        amountClass: incoming ? 'text-[#38E4AE]' : 'text-[#F46B78]',
        title: incoming ? `From @${entry.from_username}` : `Sent -> @${entry.to_username}`,
      }
    }
    return {
      icon: ShoppingBag,
      iconBg: 'bg-rose-500/15 text-[#F46B78] border-rose-400/25',
      sign: '-',
      amountClass: 'text-[#F46B78]',
      title: `@${entry.from_username} -> ${entry.to_username}`,
    }
  }

  const cardHolderHandle =
    role === 'FAMILY_ADMIN'
      ? famVault.username || actor.family_vault_username || actor.username
      : actor?.username

  const cardHolderName =
    role === 'FAMILY_ADMIN'
      ? famVault.full_name || 'Morake Household Vault'
      : profile.full_name || actor?.full_name

  return (
    <div className="space-y-5">
      {/* Row 1: Top 3 KPI Cards mirroring ubu-one-ui.jpeg */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* KPI 1 */}
        <div className="ubu-card-surface rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-medium text-[#9AA7C4]">
              {role === 'FAMILY_ADMIN'
                ? 'Family UBU Pool'
                : role === 'FAMILY_MEMBER'
                  ? `Remaining ${myFamilyLink?.period || 'Daily'} Allowance`
                  : 'My Spendable UBU'}
            </div>
            <div className="text-2xl xl:text-[28px] font-bold text-white tracking-tight tabular-nums mt-1.5">
              {formatUBU(primaryPoolUbu, false)}{' '}
              <span className="text-sm font-semibold text-[#38C3FF]">UBU</span>
            </div>
            <div className="text-[11px] text-[#9AA7C4] mt-1">
              {role === 'FAMILY_ADMIN'
                ? `Bank/OP Reserve: ${formatZAR(famVault.zar_balance ?? profile.balance ?? 0)}`
                : role === 'FAMILY_MEMBER'
                  ? `Cap: ${formatUBU(myFamilyLink?.allocation_limit_ubu || 0)} · Pool @${actor.family_vault_username}`
                  : `Open Payments Reserve: ${formatZAR(profile.balance || 0)}`}
            </div>
          </div>
          <MiniSparkline values={sparkValues} />
        </div>

        {/* KPI 2 */}
        <div className="ubu-card-surface rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#9AA7C4]">
              {role === 'FAMILY_MEMBER'
                ? 'Personal UBU & Rewards'
                : role === 'FAMILY_ADMIN'
                  ? 'Vault Funded / Loaded'
                  : 'Deposits & Change-in-UBU'}
            </span>
            <span className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center text-[#38E4AE]">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-1.5">
            <div className="text-2xl xl:text-[28px] font-bold text-[#38E4AE] tracking-tight tabular-nums">
              +{formatUBU(role === 'FAMILY_MEMBER' ? (profile.ubu_balance || 0) : totalIncomingUbu, false)}{' '}
              <span className="text-sm font-semibold">UBU</span>
            </div>
            <div className="text-[11px] text-[#9AA7C4] mt-1">
              {role === 'FAMILY_MEMBER'
                ? `Ubuntu Loyalty Tokens: ${Number(profile.total_ubuntu_tokens || 0).toFixed(2)} UBU`
                : `R0.00 fee · Ubuntu Tokens: ${Number(profile.total_ubuntu_tokens || 0).toFixed(2)}`}
            </div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="ubu-card-surface rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#9AA7C4]">
              {role === 'FAMILY_ADMIN'
                ? 'Family Counter Spend'
                : role === 'FAMILY_MEMBER'
                  ? 'Spent This Period'
                  : 'Spend & Beneficiary Gifts'}
            </span>
            <span className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-400/25 flex items-center justify-center text-[#F46B78]">
              <ArrowDown className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-1.5">
            <div className="text-2xl xl:text-[28px] font-bold text-white tracking-tight tabular-nums">
              -{formatUBU(role === 'FAMILY_MEMBER' ? (myFamilyLink?.spent_in_period_ubu || 0) : totalOutgoingUbu, false)}{' '}
              <span className="text-sm font-semibold text-[#F46B78]">UBU</span>
            </div>
            <div className="text-[11px] text-[#9AA7C4] mt-1">
              {role === 'FAMILY_ADMIN'
                ? `${familyOverview?.metrics?.member_count || 0} linked members · ${familyOverview?.metrics?.admin_count || 1} admins`
                : role === 'FAMILY_MEMBER'
                  ? `Categories: ${myFamilyLink?.allowed_categories || 'Spaza Goods'}`
                  : `${acceptedBeneficiaries.length} active beneficiaries · ${profile.pending_invitations_count || 0} pending invites`}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Main Bento matching ubu-one-ui.jpeg */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        <div className="xl:col-span-6 flex flex-col">
          <UbuFlowChart
            ledger={ledger}
            title={role === 'FAMILY_ADMIN' ? 'Family Vault Flow' : 'Personal UBU Flow'}
            seriesALabel="Funded & Received (UBU)"
            seriesBLabel="R1 Moments & Gifts"
          />
        </div>

        <div className="xl:col-span-6 flex flex-col gap-5">
          {/* Quick Action + Pass Card Split */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Quick Action Card */}
            <div className="ubu-card-surface rounded-2xl p-5 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-base font-semibold text-white tracking-tight">
                    {quickMode === 'fund'
                      ? 'Fund Family Pool'
                      : quickMode === 'send'
                        ? 'Send Beneficiary'
                        : 'Quick Pay Unit'}
                  </h3>

                  {role === 'FAMILY_ADMIN' && (
                    <div className="inline-flex p-0.5 rounded-lg bg-[#1A264E] border border-white/10">
                      <button
                        type="button"
                        onClick={() => setQuickMode('pay')}
                        className={cn(
                          'px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer',
                          quickMode === 'pay' ? 'bg-[#00A2E8] text-white' : 'text-[#9AA7C4]'
                        )}
                      >
                        Pay
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickMode('fund')}
                        className={cn(
                          'px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer',
                          quickMode === 'fund' ? 'bg-[#00A2E8] text-white' : 'text-[#9AA7C4]'
                        )}
                      >
                        Load
                      </button>
                    </div>
                  )}

                  {role === 'ADULT_INDIVIDUAL' && (
                    <div className="inline-flex p-0.5 rounded-lg bg-[#1A264E] border border-white/10">
                      <button
                        type="button"
                        onClick={() => setQuickMode('pay')}
                        className={cn(
                          'px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer',
                          quickMode === 'pay' ? 'bg-[#00A2E8] text-white' : 'text-[#9AA7C4]'
                        )}
                      >
                        Pay
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickMode('send')}
                        className={cn(
                          'px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer',
                          quickMode === 'send' ? 'bg-[#00A2E8] text-white' : 'text-[#9AA7C4]'
                        )}
                      >
                        Send
                      </button>
                    </div>
                  )}
                </div>

                {quickMode === 'fund' ? (
                  <form onSubmit={handleQuickFund} className="space-y-2.5">
                    <div className="p-2.5 rounded-xl bg-[#0F1735] border border-white/10 text-[11px] text-[#8AD9FF]">
                      Single Open Payments deposit into{' '}
                      <strong className="text-white">@{actor.family_vault_username || actor.username}</strong>
                    </div>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Amount UBU / R"
                      className="h-9 text-xs tabular-nums font-bold"
                    />
                    <div className="flex gap-1.5">
                      {[50, 100, 200, 500].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setAmount(String(v))}
                          className="px-2 py-0.5 rounded bg-[#1A254B] text-[10px] font-semibold text-[#D2D7DF] hover:text-white cursor-pointer"
                        >
                          R{v}
                        </button>
                      ))}
                    </div>
                    <Button type="submit" disabled={submitting} className="w-full h-10 mt-1">
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                      Load +{Number(amount || 0).toFixed(0)} UBU
                    </Button>
                  </form>
                ) : quickMode === 'send' ? (
                  <form onSubmit={handleQuickSendBeneficiary} className="space-y-2.5">
                    <select
                      value={selectedBenLink}
                      onChange={(e) => setSelectedBenLink(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl ubu-input-surface text-xs text-white"
                    >
                      {acceptedBeneficiaries.length === 0 ? (
                        <option value="" className="bg-[#0F1735]">No accepted beneficiaries yet</option>
                      ) : (
                        acceptedBeneficiaries.map((b) => (
                          <option key={b.link_id} value={b.link_id} className="bg-[#0F1735]">
                            @{b.member_username} ({b.relationship_label})
                          </option>
                        ))
                      )}
                    </select>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Amount UBU"
                      className="h-9 text-xs tabular-nums font-bold"
                    />
                    <Button
                      type="submit"
                      disabled={submitting || acceptedBeneficiaries.length === 0}
                      className="w-full h-10"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <HeartHandshake className="w-4 h-4" />}
                      Send {Number(amount || 0).toFixed(2)} UBU
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleQuickPay} className="space-y-2.5">
                    <select
                      value={selectedUnit}
                      onChange={(e) => setSelectedUnit(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl ubu-input-surface text-xs text-white"
                    >
                      {units.map((u) => (
                        <option key={u.id} value={u.id} className="bg-[#0F1735]">
                          {u.name} ({u.township})
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        step="0.5"
                        min="0.5"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="UBU"
                        className="h-9 text-xs tabular-nums font-bold"
                      />
                      <Input
                        value={itemDesc}
                        onChange={(e) => setItemDesc(e.target.value)}
                        placeholder="Item note"
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <div className="flex gap-1">
                        {[1, 2, 5, 10].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setAmount(String(v))}
                            className={cn(
                              'px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer',
                              Number(amount) === v
                                ? 'bg-[#00A2E8]/25 text-white border border-[#00A2E8]/40'
                                : 'bg-[#1A254B] text-[#9AA7C4]'
                            )}
                          >
                            R{v}
                          </button>
                        ))}
                      </div>
                      <Badge variant="mint" className="text-[10px]">
                        <ShieldCheck className="w-3 h-3" /> R0 Fee
                      </Badge>
                    </div>

                    <Button type="submit" disabled={submitting} className="w-full h-10">
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
                      Pay {Number(amount || 0).toFixed(2)} UBU
                    </Button>
                  </form>
                )}
              </div>
            </div>

            {/* Pass Card matching "My Cards" */}
            <UnitNodeCard
              unitId={cardHolderHandle}
              unitName={cardHolderName}
              township={role === 'FAMILY_MEMBER' ? 'Family Allowance Pass' : role === 'FAMILY_ADMIN' ? 'Family Vault Pass' : 'Personal UBU Pass'}
              openPaymentsId={`$spazauniti.org/${cardHolderHandle}`}
              broadcastEnabled={true}
              statusLabel={role === 'FAMILY_ADMIN' ? 'FAMILY ADMIN' : role === 'FAMILY_MEMBER' ? 'MEMBER CAP' : 'ADULT WALLET'}
              cardHeading="UbuOne Pass"
              modalTitle="Open Payments Wallet Pass"
              modalSubtitle="Show at any Spaza Unit counter or share to receive zero-fee UBU allocations."
              footerCta="Wallet QR"
              onNavigateTab={onNavigateTab}
              ctaTab={role === 'ADULT_INDIVIDUAL' ? 'beneficiaries' : 'family_rbac'}
              ctaLabel={role === 'ADULT_INDIVIDUAL' ? 'Beneficiaries' : 'Manage RBAC'}
            />
          </div>

          {/* Recent Activity */}
          <div className="ubu-card-surface rounded-2xl p-5 flex-1">
            <div className="flex items-center justify-between gap-3 mb-3.5">
              <h3 className="text-base font-semibold text-white tracking-tight">
                Recent Activity
              </h3>

              <select
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value)}
                className="h-8 px-2.5 rounded-lg bg-[#1A264E] border border-white/10 text-xs text-[#D2D7DF] focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-[#0F1735]">All events</option>
                <option value="COUNTER_SALE" className="bg-[#0F1735]">Store Purchases</option>
                <option value="UBU_DEPOSIT" className="bg-[#0F1735]">Deposits</option>
                <option value="BENEFICIARY_TRANSFER" className="bg-[#0F1735]">Beneficiary P2P</option>
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
                      <div className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 ${vis.iconBg}`}>
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
                  <span>No activity yet. Try a quick R1 payment at a Spaza Unit above!</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
