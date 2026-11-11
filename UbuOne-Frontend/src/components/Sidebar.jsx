import React from 'react'
import {
  ArrowLeftRight,
  Globe,
  LayoutGrid,
  LogOut,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import { UbuOneLogo } from './UbuOneBrand'
import { cn, roleDisplayLabel } from '../lib/utils'

/**
 * Navigation mapped to ubu-one-ui.jpeg visual rhythm & gated by live UbuOne RBAC roles.
 */
export function Sidebar({
  activeTab,
  onSelectTab,
  staff,
  unitName,
  unitId,
  onLogout,
  mobileOpen,
  onCloseMobile,
}) {
  const isOwnerOrAdmin =
    staff?.role === 'UNIT_OWNER' || staff?.role === 'NETWORK_ADMIN'
  const isAdmin = staff?.role === 'NETWORK_ADMIN'

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid, show: true },
    { id: 'till', label: 'Counter Till', icon: ArrowLeftRight, show: true },
    { id: 'pacts', label: 'Pacts & Promos', icon: Sparkles, show: true },
    { id: 'settlements', label: 'Settlements', icon: Wallet, show: isOwnerOrAdmin },
    { id: 'team', label: 'Team & RBAC', icon: Users, show: isOwnerOrAdmin },
    { id: 'network', label: 'Network Hub', icon: Globe, show: isAdmin },
    { id: 'settings', label: 'Node Settings', icon: Settings, show: true },
  ].filter((item) => item.show)

  const content = (
    <aside className="w-[238px] shrink-0 h-full bg-[#0C132D] border-r border-white/[0.07] flex flex-col justify-between p-5 select-none">
      <div>
        {/* Brand Header matching ubu-one-ui.jpeg */}
        <div className="px-1 pt-1 pb-7">
          <UbuOneLogo size="md" />
        </div>

        {/* Navigation Links */}
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
                  'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer relative',
                  active
                    ? 'bg-gradient-to-r from-[#00A2E8]/20 to-[#1B2956]/75 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] border border-[#00A2E8]/25'
                    : 'text-[#9AA7C4] hover:text-white hover:bg-white/[0.04] border border-transparent'
                )}
              >
                <Icon
                  className={cn(
                    'w-[18px] h-[18px] shrink-0',
                    active ? 'text-[#00A2E8]' : 'text-[#7F8CAE]'
                  )}
                />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Bottom Active Unit & RBAC Status Card */}
      <div className="space-y-2.5 pt-4 border-t border-white/[0.07]">
        <div className="p-3 rounded-xl bg-[#131D40] border border-white/[0.07]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#38C3FF]">
              {roleDisplayLabel(staff?.role)}
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-[#38E4AE]" />
          </div>
          <div className="text-xs font-semibold text-white truncate">
            {unitName || 'Spaza Unit'}
          </div>
          <div className="text-[10px] text-[#8E9BB8] font-mono-code mt-0.5">
            Node: {unitId}
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
      {/* Desktop persistent sidebar */}
      <div className="hidden lg:block h-screen sticky top-0">{content}</div>

      {/* Mobile drawer */}
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

