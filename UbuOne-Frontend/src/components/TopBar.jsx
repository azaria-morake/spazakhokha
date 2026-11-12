import React, { useEffect, useState } from 'react'
import {
  Bell,
  ChevronDown,
  ExternalLink,
  LogOut,
  Menu,
  MessageSquare,
  Radio,
  Search,
  User,
} from 'lucide-react'
import { CUSTOMER_APP_URL, searchConsumers } from '../lib/api'
import { formatUBU, roleDisplayLabel } from '../lib/utils'

const TAB_TITLES = {
  overview: 'Overview',
  till: 'Counter Till & Ledger',
  pacts: 'Loyalty Pacts & Specials',
  settlements: 'Settlements & Wholesalers',
  team: 'Personnel & RBAC',
  network: 'SpazaUniti Network Hub',
  pay: 'Pay Spaza Unit',
  family_rbac: 'Family RBAC & Allowances',
  beneficiaries: 'Beneficiaries & Invitations',
  load: 'Load UBU & Rewards',
  settings: 'Account & Node Settings',
}

export function TopBar({
  activeTab,
  sessionType,
  actor,
  contextLabel,
  unitId,
  broadcastEnabled,
  ledger = [],
  availableUnits = [],
  pendingInvitesCount = 0,
  onSelectUnit,
  onSelectConsumerHandle,
  onSelectTab,
  onLogout,
  onOpenMobileMenu,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [showSync, setShowSync] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  useEffect(() => {
    const clean = searchQuery.replace(/^@+/, '').trim()
    if (clean.length < 2) {
      setSearchResults([])
      return
    }
    let active = true
    const t = setTimeout(async () => {
      try {
        const res = await searchConsumers(clean, actor?.username || '')
        if (active && Array.isArray(res)) setSearchResults(res.slice(0, 5))
      } catch {
        if (active) setSearchResults([])
      }
    }, 200)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [searchQuery, actor?.username])

  const displayName = actor?.full_name || 'User'
  const activeRole =
    sessionType === 'STAFF' ? actor?.role : actor?.consumer_role
  const initials = displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const searchPlaceholder =
    sessionType === 'STAFF'
      ? 'Search @handle for Counter Till...'
      : activeRole === 'ADULT_INDIVIDUAL'
        ? 'Search @handle to invite...'
        : 'Search @handle across SpazaUniti...'

  return (
    <header className="sticky top-0 z-30 bg-[#0F1735]/90 backdrop-blur-md border-b border-white/[0.06] px-5 md:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl bg-[#18244B] border border-white/10 text-white cursor-pointer"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            {TAB_TITLES[activeTab] || 'Overview'}
          </h1>

          {sessionType === 'STAFF' && actor?.role === 'NETWORK_ADMIN' && availableUnits.length > 0 ? (
            <select
              value={unitId}
              onChange={(e) => onSelectUnit?.(e.target.value)}
              className="h-8 px-3 rounded-full bg-[#18244B] border border-[#00A2E8]/35 text-xs font-semibold text-[#38C3FF] focus:outline-none cursor-pointer"
            >
              {availableUnits.map((u) => (
                <option key={u.id} value={u.id} className="bg-[#0F1735] text-white">
                  {u.name} ({u.id})
                </option>
              ))}
            </select>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#18244B] border border-white/10 text-xs font-medium text-[#D2D7DF]">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  broadcastEnabled !== false ? 'bg-[#38E4AE]' : 'bg-[#9AA7C4]'
                }`}
              />
              {contextLabel}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 md:gap-3.5 relative">
        <div className="relative hidden md:block w-60 lg:w-72">
          <Search className="w-4 h-4 text-[#7F8CAE] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-[#18244B] border border-white/[0.08] text-xs text-white placeholder:text-[#7F8CAE] focus:outline-none focus:border-[#00A2E8]/60"
          />

          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 rounded-xl bg-[#111B3D] border border-white/15 shadow-2xl overflow-hidden z-50">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#9AA7C4] bg-[#0B1128]">
                {sessionType === 'STAFF' ? 'Load into Counter Till' : 'Select @Handle'}
              </div>
              {searchResults.map((c) => (
                <button
                  key={c.username}
                  type="button"
                  onClick={() => {
                    onSelectConsumerHandle?.(c.username)
                    setSearchQuery('')
                    setSearchResults([])
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-white/[0.06] flex items-center justify-between gap-2 text-xs cursor-pointer"
                >
                  <div>
                    <div className="font-semibold text-white">@{c.username}</div>
                    <div className="text-[10px] text-[#9AA7C4]">{c.full_name}</div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00A2E8]/15 text-[#38C3FF] font-semibold">
                    {c.account_type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowNotifs(!showNotifs)
              setShowSync(false)
              setShowProfileMenu(false)
            }}
            className="relative w-9 h-9 rounded-xl bg-[#18244B]/80 hover:bg-[#1E2E5E] border border-white/[0.08] flex items-center justify-center text-[#D2D7DF] hover:text-white transition-colors cursor-pointer"
            title="Recent Activity & Invites"
          >
            <Bell className="w-4 h-4" />
            {(ledger.length > 0 || pendingInvitesCount > 0) && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#F46B78] ring-2 ring-[#0F1735]" />
            )}
          </button>

          {showNotifs && (
            <div className="fixed inset-x-3 top-28 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 rounded-2xl bg-[#111B3D] border border-white/15 shadow-2xl p-3 z-50">
              <div className="flex items-center justify-between px-1 pb-2 mb-2 border-b border-white/10">
                <span className="text-xs font-bold text-white">Recent UbuOne Activity</span>
                {pendingInvitesCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifs(false)
                      onSelectTab?.('beneficiaries')
                    }}
                    className="text-[10px] font-bold text-[#00A2E8] hover:underline cursor-pointer"
                  >
                    {pendingInvitesCount} Invite Pending
                  </button>
                )}
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {ledger.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-xl bg-[#17234B]/80 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">
                        {item.description}
                      </div>
                      <div className="text-[10px] text-[#9AA7C4] mt-0.5">
                        {item.event_type} · {item.created_at}
                      </div>
                    </div>
                    <span className="font-bold text-[#38E4AE] tabular-nums shrink-0">
                      {formatUBU(item.amount_ubu, false)}
                    </span>
                  </div>
                ))}
                {ledger.length === 0 && (
                  <div className="text-xs text-[#9AA7C4] py-4 text-center">
                    No activity recorded yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Network Status */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowSync(!showSync)
              setShowNotifs(false)
              setShowProfileMenu(false)
            }}
            className="relative w-9 h-9 rounded-xl bg-[#18244B]/80 hover:bg-[#1E2E5E] border border-white/[0.08] flex items-center justify-center text-[#D2D7DF] hover:text-white transition-colors cursor-pointer"
            title="Open Payments Network Status"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full ring-2 ring-[#0F1735] bg-[#00A2E8]" />
          </button>

          {showSync && (
            <div className="fixed inset-x-3 top-28 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72 rounded-2xl bg-[#111B3D] border border-white/15 shadow-2xl p-3.5 z-50 space-y-2.5 text-xs">
              <div className="flex items-center gap-2 font-bold text-white">
                <Radio className="w-4 h-4 text-[#00A2E8]" />
                SpazaUniti Ecosystem Connected
              </div>
              <p className="text-[#9AA7C4] leading-relaxed">
                Signed in under <strong className="text-white">{roleDisplayLabel(activeRole)}</strong>. All UBU transactions settle at R0.00 counter fees across Port 8001.
              </p>
              <a
                href={CUSTOMER_APP_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[#38C3FF] font-semibold hover:underline"
              >
                Open SpazaUniti Shopper App
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Profile Pill */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowProfileMenu(!showProfileMenu)
              setShowNotifs(false)
              setShowSync(false)
            }}
            className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 rounded-full hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00A2E8] to-[#1E3A8A] border border-white/25 flex items-center justify-center text-xs font-bold text-white shadow">
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-white leading-tight">
                {displayName}
              </div>
              <div className="text-[10px] text-[#9AA7C4] leading-tight">
                {roleDisplayLabel(activeRole)}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#9AA7C4]" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#111B3D] border border-white/15 shadow-2xl p-2 z-50 text-xs">
              <div className="px-2.5 py-2 border-b border-white/10 mb-1">
                <div className="font-semibold text-white">{displayName}</div>
                <div className="text-[10px] text-[#38C3FF] font-mono-code">
                  @{actor?.username}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false)
                  onSelectTab?.('settings')
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[#D2D7DF] hover:text-white hover:bg-white/[0.06] cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                Account &amp; RBAC Settings
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false)
                  onLogout?.()
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[#F46B78] hover:bg-rose-500/10 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out / Switch Role
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
