import React from 'react'
import {
  ArrowLeftRight,
  Globe,
  HeartHandshake,
  LayoutGrid,
  LogOut,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import { UbuOneLogo } from './UbuOneBrand'
import { cn, roleDisplayLabel } from '../lib/utils'

/**
 * Unified RBAC Sidebar supporting Unit Staff, Family RBAC (Admin/Member), and Adult Accounts.
 */
export function Sidebar({
  activeTab,
  onSelectTab,
  sessionType, // 'STAFF' | 'CONSUMER'
  actor,
  contextTitle,
  contextSub,
  pendingInvitesCount = 0,
  onLogout,
  mobileOpen,
  onCloseMobile,
}) {
  let navItems = []

  if (sessionType === 'STAFF') {
    const isOwnerOrAdmin =
      actor?.role === 'UNIT_OWNER' || actor?.role === 'NETWORK_ADMIN'
    const isAdmin = actor?.role === 'NETWORK_ADMIN'
    navItems = [
      { id: 'overview', label: 'Overview', icon: LayoutGrid, show: true },
      { id: 'till', label: 'Counter Till', icon: ArrowLeftRight, show: true },
      { id: 'pacts', label: 'Pacts & Promos', icon: Sparkles, show: true },
      { id: 'settlements', label: 'Settlements', icon: Wallet, show: isOwnerOrAdmin },
      { id: 'team', label: 'Team & RBAC', icon: Users, show: isOwnerOrAdmin },
      { id: 'network', label: 'Network Hub', icon: Globe, show: isAdmin },
      { id: 'settings', label: 'Node Settings', icon: Settings, show: true },
    ].filter((x) => x.show)
  } else {
    const cRole = actor?.consumer_role || 'ADULT_INDIVIDUAL'
    if (cRole === 'FAMILY_ADMIN') {
      navItems = [
        { id: 'overview', label: 'Overview', icon: LayoutGrid },
        { id: 'pay', label: 'Pay Spaza Unit', icon: ShoppingBag },
        { id: 'family_rbac', label: 'Members & RBAC', icon: Users },
        { id: 'load', label: 'Load Family Pool', icon: Wallet },
        { id: 'settings', label: 'Account Settings', icon: Settings },
      ]
    } else if (cRole === 'FAMILY_MEMBER') {
      navItems = [
        { id: 'overview', label: 'Overview', icon: LayoutGrid },
        { id: 'pay', label: 'Pay Spaza Unit', icon: ShoppingBag },
        { id: 'family_rbac', label: 'My Allowance', icon: ShieldCheck },
        { id: 'settings', label: 'Account Settings', icon: Settings },
      ]
    } else {
      // ADULT_INDIVIDUAL
      navItems = [
        { id: 'overview', label: 'Overview', icon: LayoutGrid },
        { id: 'pay', label: 'Pay Spaza Unit', icon: ShoppingBag },
        {
          id: 'beneficiaries',
          label: 'Beneficiaries',
          icon: HeartHandshake,
          badge: pendingInvitesCount > 0 ? pendingInvitesCount : null,
        },
        { id: 'load', label: 'Load & Rewards', icon: Wallet },
        { id: 'settings', label: 'Account Settings', icon: Settings },
      ]
    }
  }

  const activeRole =
    sessionType === 'STAFF' ? actor?.role : actor?.consumer_role

  const content = (
    <aside className="w-[238px] shrink-0 h-full bg-[#0C132D] border-r border-white/[0.07] flex flex-col justify-between p-5 select-none">
      <div>
        <div className="px-1 pt-1 pb-7">
          <UbuOneLogo size="md" />
        </div>

        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id)
                  onCloseMobile?.()
                }}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer relative',
                  active
                    ? 'bg-gradient-to-r from-[#00A2E8]/20 to-[#1B2956]/75 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] border border-[#00A2E8]/25'
                    : 'text-[#9AA7C4] hover:text-white hover:bg-white/[0.04] border border-transparent'
                )}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={cn(
                      'w-[18px] h-[18px] shrink-0',
                      active ? 'text-[#00A2E8]' : 'text-[#7F8CAE]'
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#00A2E8] text-white text-[10px] font-bold">
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="space-y-2.5 pt-4 border-t border-white/[0.07]">
        <div className="p-3 rounded-xl bg-[#131D40] border border-white/[0.07]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#38C3FF]">
              {roleDisplayLabel(activeRole)}
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-[#38E4AE]" />
          </div>
          <div className="text-xs font-semibold text-white truncate">
            {contextTitle}
          </div>
          <div className="text-[10px] text-[#8E9BB8] font-mono-code mt-0.5 truncate">
            {contextSub}
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#9AA7C4] hover:text-[#F46B78] hover:bg-rose-500/10 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )

  return (
    <>
      <div className="hidden lg:block h-screen sticky top-0">{content}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  )
}
