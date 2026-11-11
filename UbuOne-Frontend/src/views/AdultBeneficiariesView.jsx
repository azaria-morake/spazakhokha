import React, { useEffect, useState } from 'react'
import {
  Check,
  HeartHandshake,
  MailCheck,
  Search,
  Send,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from '../components/ui/primitives'
import {
  allocateBeneficiaryRBAC,
  inviteBeneficiaryRBAC,
  removeBeneficiaryRBAC,
  respondInvitationRBAC,
  searchConsumers,
} from '../lib/api'
import { formatUBU } from '../lib/utils'

export function AdultBeneficiariesView({ actor, workspace, prefillHandle, onRefresh, showToast }) {
  const profile = workspace?.profile || {}
  const beneficiaries = profile.beneficiaries || []
  const incomingAllocs = profile.incoming_allocations || []
  const pendingInvites = incomingAllocs.filter((i) => i.status === 'PENDING')
  const acceptedIncoming = incomingAllocs.filter((i) => i.status === 'ACCEPTED')

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [inviteUser, setInviteUser] = useState('')
  const [inviteRel, setInviteRel] = useState('Girlfriend')
  const [inviteCap, setInviteCap] = useState('80')
  const [invitePeriod, setInvitePeriod] = useState('WEEKLY')
  const [inviteCats, setInviteCats] = useState('Groceries & Essentials')

  const [giftAmounts, setGiftAmounts] = useState({})
  const [busy, setBusy] = useState('')

  useEffect(() => {
    if (prefillHandle) {
      setInviteUser(prefillHandle)
    }
  }, [prefillHandle])

  useEffect(() => {
    const clean = query.replace(/^@+/, '').trim()
    if (clean.length < 2) {
      setSearchResults([])
      return
    }
    let active = true
    const t = setTimeout(async () => {
      try {
        const res = await searchConsumers(clean, actor.username)
        if (active && Array.isArray(res)) setSearchResults(res.slice(0, 6))
      } catch {
        if (active) setSearchResults([])
      }
    }, 200)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [query, actor.username])

  const handleInvite = async (e) => {
    e.preventDefault()
    const clean = inviteUser.trim().replace(/^@+/, '').toLowerCase()
    if (!clean) {
      showToast?.('Select or enter a beneficiary @handle first', 'error')
      return
    }
    setBusy('invite')
    try {
      await inviteBeneficiaryRBAC(actor.username, {
        beneficiary_username: clean,
        relationship_label: inviteRel.trim(),
        allowance_limit_ubu: Number(inviteCap || 50),
        period: invitePeriod,
        allowed_categories: inviteCats.trim(),
      })
      showToast?.(`Invitation sent to @${clean}! They can accept inside their Adult Account.`, 'success')
      setInviteUser('')
      setQuery('')
      setSearchResults([])
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Could not send invite', 'error')
    } finally {
      setBusy('')
    }
  }

  const handleRespond = async (linkId, action) => {
    setBusy(linkId)
    try {
      await respondInvitationRBAC(linkId, action)
      showToast?.(
        action === 'ACCEPT' ? 'Beneficiary invitation accepted!' : 'Invitation declined',
        'success'
      )
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Failed to respond', 'error')
    } finally {
      setBusy('')
    }
  }

  const handleSendGift = async (ben) => {
    const amt = Number(giftAmounts[ben.link_id] || 20)
    if (!amt || amt <= 0) return
    setBusy(ben.link_id)
    try {
      const res = await allocateBeneficiaryRBAC(actor.username, ben.link_id, {
        amount_ubu: amt,
        mode: 'TRANSFER',
        note: `Zero-fee UBU allocation (${ben.relationship_label})`,
      })
      showToast?.(res.message || `Sent ${amt} UBU to @${ben.member_username}!`, 'success')
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Transfer failed', 'error')
    } finally {
      setBusy('')
    }
  }

  const handleRevoke = async (linkId, otherHandle) => {
    setBusy(linkId)
    try {
      await removeBeneficiaryRBAC(actor.username, linkId)
      showToast?.(`Removed beneficiary link with @${otherHandle}`, 'info')
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Failed to remove link', 'error')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="space-y-6">
      {/* Pending Incoming Invitations */}
      {pendingInvites.length > 0 && (
        <Card className="border-[#00A2E8]/45">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MailCheck className="w-5 h-5 text-[#00A2E8]" />
              <CardTitle>Pending Beneficiary Invitations ({pendingInvites.length})</CardTitle>
            </div>
            <Badge variant="cyber">Action Required</Badge>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingInvites.map((inv) => (
              <div
                key={inv.link_id}
                className="p-4 rounded-2xl bg-[#0F1735] border border-[#00A2E8]/35 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white">
                      {inv.sponsor_full_name || `@${inv.sponsor_username}`}
                    </span>
                    <Badge variant="cyber">{inv.relationship_label}</Badge>
                  </div>
                  <div className="text-xs text-[#9AA7C4] mt-1">
                    Offering up to{' '}
                    <strong className="text-[#38E4AE]">
                      {formatUBU(inv.allocation_limit_ubu)} / {inv.period}
                    </strong>{' '}
                    for {inv.allowed_categories}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={busy === inv.link_id}
                    onClick={() => handleRespond(inv.link_id, 'ACCEPT')}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Accept Invite
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy === inv.link_id}
                    onClick={() => handleRespond(inv.link_id, 'DECLINE')}
                  >
                    <X className="w-3.5 h-3.5" />
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Search Existing Accounts & Send Beneficiary Invite */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#00A2E8]" />
              <CardTitle>Search &amp; Invite Beneficiary</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#D2D7DF]">
                Search Registered SpazaUniti Handles
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#7F8CAE] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type lerato, sipho, thandi..."
                  className="pl-10"
                />
              </div>

              {searchResults.length > 0 && (
                <div className="rounded-xl bg-[#0F1735] border border-white/10 divide-y divide-white/[0.06] overflow-hidden">
                  {searchResults.map((c) => (
                    <button
                      key={c.username}
                      type="button"
                      onClick={() => {
                        setInviteUser(c.username)
                        setQuery(c.username)
                        setSearchResults([])
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-white/[0.05] flex items-center justify-between text-xs cursor-pointer"
                    >
                      <span>
                        <strong className="text-white">@{c.username}</strong>{' '}
                        <span className="text-[#9AA7C4]">({c.full_name})</span>
                      </span>
                      <Badge variant="cyber">Select</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleInvite} className="space-y-3 pt-2 border-t border-white/10">
              <div>
                <label className="block text-xs text-[#D2D7DF] mb-1">Selected @Handle</label>
                <Input
                  value={inviteUser}
                  onChange={(e) => setInviteUser(e.target.value)}
                  placeholder="e.g. lerato"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#D2D7DF] mb-1">Relationship</label>
                  <Input
                    value={inviteRel}
                    onChange={(e) => setInviteRel(e.target.value)}
                    placeholder="Girlfriend / Sister"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#D2D7DF] mb-1">Allowance Cap (UBU)</label>
                  <Input
                    type="number"
                    step="1"
                    value={inviteCap}
                    onChange={(e) => setInviteCap(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#D2D7DF] mb-1">Period</label>
                  <select
                    value={invitePeriod}
                    onChange={(e) => setInvitePeriod(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl ubu-input-surface text-xs text-white"
                  >
                    <option value="DAILY" className="bg-[#0F1735]">DAILY</option>
                    <option value="WEEKLY" className="bg-[#0F1735]">WEEKLY</option>
                    <option value="MONTHLY" className="bg-[#0F1735]">MONTHLY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#D2D7DF] mb-1">Categories</label>
                  <Input value={inviteCats} onChange={(e) => setInviteCats(e.target.value)} required />
                </div>
              </div>

              <Button type="submit" disabled={busy === 'invite'} className="w-full">
                <Send className="w-4 h-4" />
                {busy === 'invite' ? 'Sending Invite...' : 'Send Beneficiary Invitation'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right: Sponsored Beneficiaries & Incoming Allowances */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-[#38E4AE]" />
                <CardTitle>People You Sponsor ({beneficiaries.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {beneficiaries.map((b) => (
                <div
                  key={b.link_id}
                  className="p-4 rounded-xl bg-[#0F1735] border border-white/10 space-y-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          {b.member_full_name || `@${b.member_username}`}
                        </span>
                        <Badge variant={b.status === 'ACCEPTED' ? 'mint' : 'amber'}>
                          {b.status}
                        </Badge>
                      </div>
                      <div className="text-[#9AA7C4] mt-0.5">
                        @{b.member_username} · {b.relationship_label} · Cap {formatUBU(b.allocation_limit_ubu)} / {b.period}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRevoke(b.link_id, b.member_username)}
                      className="p-2 rounded-lg text-[#F46B78] hover:bg-rose-500/15 cursor-pointer"
                      title="Remove link"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {b.status === 'ACCEPTED' && (
                    <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        value={giftAmounts[b.link_id] ?? '20'}
                        onChange={(e) =>
                          setGiftAmounts((p) => ({ ...p, [b.link_id]: e.target.value }))
                        }
                        className="h-9 text-xs tabular-nums max-w-[140px]"
                      />
                      <Button
                        size="sm"
                        disabled={busy === b.link_id}
                        onClick={() => handleSendGift(b)}
                      >
                        Send Instant UBU (R0 Fee)
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {beneficiaries.length === 0 && (
                <div className="py-8 text-center text-xs text-[#9AA7C4]">
                  No beneficiaries added yet. Search any registered user on the left to invite your girlfriend, sibling, or parent.
                </div>
              )}
            </CardContent>
          </Card>

          {acceptedIncoming.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Active Allowances Available to You ({acceptedIncoming.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {acceptedIncoming.map((inc) => (
                  <div
                    key={inc.link_id}
                    className="p-3.5 rounded-xl bg-[#0F1735] border border-emerald-400/20 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">
                        Sponsored by @{inc.sponsor_username} ({inc.relationship_label})
                      </div>
                      <div className="text-[#9AA7C4] mt-0.5">{inc.allowed_categories}</div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className="font-bold text-[#38E4AE]">
                        {formatUBU(inc.remaining_in_period_ubu)} left
                      </div>
                      <div className="text-[10px] text-[#9AA7C4]">
                        of {formatUBU(inc.allocation_limit_ubu)} / {inc.period}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
