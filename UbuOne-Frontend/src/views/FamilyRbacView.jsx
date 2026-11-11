import React, { useState } from 'react'
import {
  Lock,
  Plus,
  ShieldCheck,
  Snowflake,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogHeader,
  Input,
  Switch,
} from '../components/ui/primitives'
import { addFamilyMemberRBAC, updateFamilyMemberRBAC } from '../lib/api'
import { cn, formatUBU, roleDisplayLabel } from '../lib/utils'

export function FamilyRbacView({ actor, familyOverview, workspace, onRefresh, showToast }) {
  const isFamilyAdmin = actor?.consumer_role === 'FAMILY_ADMIN'
  const famHandle = actor?.family_vault_username || actor?.username
  const members = familyOverview?.family_members || []
  const myAlloc = familyOverview?.my_allocation || workspace?.my_family_link
  const vault = familyOverview?.family_vault || {}

  const [addOpen, setAddOpen] = useState(false)
  const [mHandle, setMHandle] = useState('')
  const [mName, setMName] = useState('')
  const [mRel, setMRel] = useState('Child')
  const [mRole, setMRole] = useState('FAMILY_MEMBER')
  const [mLimit, setMLimit] = useState('15')
  const [mPeriod, setMPeriod] = useState('DAILY')
  const [mCats, setMCats] = useState('Snacks & School Lunch')
  const [mPin, setMPin] = useState('1234')
  const [busyId, setBusyId] = useState('')

  // Inline limit editing state keyed by member_username
  const [limitEdits, setLimitEdits] = useState({})

  const handleAddMember = async (e) => {
    e.preventDefault()
    setBusyId('add')
    try {
      await addFamilyMemberRBAC(famHandle, {
        member_username: mHandle.trim(),
        full_name: mName.trim() || mHandle.trim(),
        pin: mPin.trim(),
        relationship_label: mRel.trim(),
        family_role: mRole,
        daily_limit_ubu: Number(mLimit || 10),
        period: mPeriod,
        allowed_categories: mCats.trim(),
      })
      showToast?.(`Added @${mHandle.trim().replace(/^@+/, '')} (${roleDisplayLabel(mRole)})`, 'success')
      setAddOpen(false)
      setMHandle('')
      setMName('')
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Could not add member', 'error')
    } finally {
      setBusyId('')
    }
  }

  const handleUpdate = async (memberUsername, patch, successMsg) => {
    setBusyId(memberUsername)
    try {
      await updateFamilyMemberRBAC(famHandle, memberUsername, patch)
      showToast?.(successMsg, 'success')
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'RBAC update denied', 'error')
    } finally {
      setBusyId('')
    }
  }

  if (!isFamilyAdmin) {
    // FAMILY_MEMBER restricted read-only allowance view
    const spent = Number(myAlloc?.spent_in_period_ubu || 0)
    const cap = Number(myAlloc?.allocation_limit_ubu || 0)
    const pct = cap > 0 ? Math.min(100, Math.round((spent / cap) * 100)) : 0

    return (
      <div className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/25 flex items-center justify-center text-amber-300">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <CardTitle>Restricted Family Member Scope</CardTitle>
                <p className="text-xs text-[#9AA7C4]">
                  Your spending cap &amp; store category guardrails are managed by @{famHandle} Family Admins.
                </p>
              </div>
            </div>
            <Badge variant="amber">FAMILY_MEMBER</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {myAlloc ? (
              <>
                <div className="p-4 rounded-2xl bg-[#0F1735] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#9AA7C4]">
                      {myAlloc.period} Spending Quota ({myAlloc.relationship_label})
                    </span>
                    <span className="font-bold text-white tabular-nums">
                      {formatUBU(myAlloc.remaining_in_period_ubu)} remaining of {formatUBU(cap)}
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-[#1C2852] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#00A2E8] to-[#38E4AE]"
                      style={{ width: `${Math.max(4, 100 - pct)}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                    <div className="p-3 rounded-xl bg-[#162146]">
                      <div className="text-[#9AA7C4]">Allowed Categories</div>
                      <div className="text-white font-semibold mt-0.5">{myAlloc.allowed_categories}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#162146]">
                      <div className="text-[#9AA7C4]">Vault Status</div>
                      <div className="text-[#38E4AE] font-semibold mt-0.5">{myAlloc.status}</div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-xs text-[#9AA7C4]">No active allowance link found.</div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Family Pool Admin Banner */}
      <Card>
        <CardContent className="pt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#00A2E8]/15 border border-[#00A2E8]/35 flex items-center justify-center text-[#00A2E8]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {vault.full_name || `@${famHandle}`} · Household RBAC Controls
                </h2>
                <Badge variant="mint">{formatUBU(vault.ubu_balance || 0)} Pool</Badge>
              </div>
              <p className="text-xs text-[#9AA7C4] mt-0.5">
                Promote adults to <strong className="text-white">Family Admin</strong>, set child daily UBU caps, or freeze compromised handles instantly.
              </p>
            </div>
          </div>

          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            Add Family Member
          </Button>
        </CardContent>
      </Card>

      {/* Member RBAC Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {members.map((m) => {
          const isSelf = m.member_username === actor?.username
          const isFrozen = m.status === 'FROZEN'
          const isCoAdmin = m.family_role === 'FAMILY_ADMIN'
          const spent = Number(m.spent_in_period_ubu || 0)
          const cap = Number(m.allocation_limit_ubu || 0)
          const pct = cap > 0 ? Math.min(100, Math.round((spent / cap) * 100)) : 0
          const draftCap = limitEdits[m.member_username] ?? String(cap)

          return (
            <Card key={m.link_id} className={isFrozen ? 'opacity-80 border-rose-500/35' : ''}>
              <CardHeader>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#1B2A5A] border border-[#00A2E8]/30 flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {(m.member_full_name || m.member_username).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-white truncate">
                        {m.member_full_name || `@${m.member_username}`}
                      </span>
                      <Badge variant={isCoAdmin ? 'cyber' : 'default'}>
                        {roleDisplayLabel(m.family_role || 'FAMILY_MEMBER')}
                      </Badge>
                      {isFrozen && (
                        <Badge variant="coral">
                          <Snowflake className="w-3 h-3" /> Frozen
                        </Badge>
                      )}
                      {isSelf && <Badge variant="mint">You</Badge>}
                    </div>
                    <div className="text-xs text-[#9AA7C4] font-mono-code mt-0.5">
                      @{m.member_username} · {m.relationship_label}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-[#9AA7C4]">
                    {isFrozen ? 'Frozen' : 'Active'}
                  </span>
                  <Switch
                    checked={!isFrozen}
                    disabled={isSelf || busyId === m.member_username}
                    onChange={(enabled) =>
                      handleUpdate(
                        m.member_username,
                        { status: enabled ? 'ACCEPTED' : 'FROZEN' },
                        `@${m.member_username} is now ${enabled ? 'ACTIVE' : 'FROZEN'}`
                      )
                    }
                    label="Freeze or Unfreeze Member"
                  />
                </div>
              </CardHeader>

              <CardContent className="space-y-4 text-xs">
                {/* Allowance Usage Bar */}
                <div className="p-3.5 rounded-xl bg-[#0F1735] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[#9AA7C4]">{m.period} Spend Progress</span>
                    <span className="font-bold text-white tabular-nums">
                      {formatUBU(spent, false)} / {formatUBU(cap)}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#1C2852] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#00A2E8]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-[#8E9BB8]">
                    Categories: <span className="text-[#D2D7DF]">{m.allowed_categories}</span>
                  </div>
                </div>

                {/* Inline RBAC Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#9AA7C4] mb-1">
                      Family RBAC Role
                    </label>
                    <select
                      value={m.family_role || 'FAMILY_MEMBER'}
                      disabled={isSelf || busyId === m.member_username}
                      onChange={(e) =>
                        handleUpdate(
                          m.member_username,
                          { family_role: e.target.value },
                          `Updated @${m.member_username} role to ${roleDisplayLabel(e.target.value)}`
                        )
                      }
                      className="w-full h-9 px-3 rounded-xl ubu-input-surface text-xs text-white disabled:opacity-50"
                    >
                      <option value="FAMILY_MEMBER" className="bg-[#0F1735]">
                        Family Member (Restricted)
                      </option>
                      <option value="FAMILY_ADMIN" className="bg-[#0F1735]">
                        Family Admin (Full Control)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#9AA7C4] mb-1">
                      Reset Period
                    </label>
                    <select
                      value={m.period}
                      disabled={busyId === m.member_username}
                      onChange={(e) =>
                        handleUpdate(
                          m.member_username,
                          { period: e.target.value },
                          `Set @${m.member_username} cap period to ${e.target.value}`
                        )
                      }
                      className="w-full h-9 px-3 rounded-xl ubu-input-surface text-xs text-white"
                    >
                      <option value="DAILY" className="bg-[#0F1735]">DAILY</option>
                      <option value="WEEKLY" className="bg-[#0F1735]">WEEKLY</option>
                      <option value="MONTHLY" className="bg-[#0F1735]">MONTHLY</option>
                    </select>
                  </div>
                </div>

                {/* Cap Update Row */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      value={draftCap}
                      onChange={(e) =>
                        setLimitEdits((prev) => ({
                          ...prev,
                          [m.member_username]: e.target.value,
                        }))
                      }
                      className="h-9 text-xs tabular-nums pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#9AA7C4]">
                      UBU
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busyId === m.member_username}
                    onClick={() =>
                      handleUpdate(
                        m.member_username,
                        { allocation_limit_ubu: Number(draftCap || 0) },
                        `Updated @${m.member_username} cap to ${Number(draftCap || 0).toFixed(2)} UBU`
                      )
                    }
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#38E4AE]" />
                    Update Cap
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Add Family Member Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogHeader
          title="Add Family Member Under Vault"
          subtitle={`Provision a child or household member linked to @${famHandle}.`}
          onClose={() => setAddOpen(false)}
        />
        <form onSubmit={handleAddMember} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#D2D7DF] mb-1">Member @handle</label>
              <Input
                value={mHandle}
                onChange={(e) => setMHandle(e.target.value)}
                placeholder="e.g. kgosimorake"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#D2D7DF] mb-1">Full Name</label>
              <Input
                value={mName}
                onChange={(e) => setMName(e.target.value)}
                placeholder="e.g. Kgosi Morake"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#D2D7DF] mb-1">RBAC Role</label>
              <select
                value={mRole}
                onChange={(e) => setMRole(e.target.value)}
                className="w-full h-10 px-3 rounded-xl ubu-input-surface text-xs text-white"
              >
                <option value="FAMILY_MEMBER" className="bg-[#0F1735]">Family Member (Restricted)</option>
                <option value="FAMILY_ADMIN" className="bg-[#0F1735]">Family Admin (Co-Manager)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#D2D7DF] mb-1">Relationship</label>
              <Input value={mRel} onChange={(e) => setMRel(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[#D2D7DF] mb-1">UBU Cap</label>
              <Input type="number" step="1" value={mLimit} onChange={(e) => setMLimit(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs text-[#D2D7DF] mb-1">Period</label>
              <select
                value={mPeriod}
                onChange={(e) => setMPeriod(e.target.value)}
                className="w-full h-10 px-3 rounded-xl ubu-input-surface text-xs text-white"
              >
                <option value="DAILY" className="bg-[#0F1735]">DAILY</option>
                <option value="WEEKLY" className="bg-[#0F1735]">WEEKLY</option>
                <option value="MONTHLY" className="bg-[#0F1735]">MONTHLY</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#D2D7DF] mb-1">4-Digit PIN</label>
              <Input
                type="password"
                maxLength={4}
                value={mPin}
                onChange={(e) => setMPin(e.target.value)}
                className="font-mono-code"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#D2D7DF] mb-1">Allowed Categories</label>
            <Input value={mCats} onChange={(e) => setMCats(e.target.value)} required />
          </div>

          <Button type="submit" disabled={busyId === 'add'} className="w-full">
            <UserPlus className="w-4 h-4" />
            {busyId === 'add' ? 'Provisioning Member...' : 'Provision Family Member'}
          </Button>
        </form>
      </Dialog>
    </div>
  )
}
