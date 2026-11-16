import React from 'react'
import { KeyRound, LogOut, ShieldCheck, Store, Users, Wallet } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader } from '../components/ui/primitives'
import { UbuOneLogo } from '../components/UbuOneBrand'
import { getStoredToken } from '../lib/api'
import { roleDisplayLabel } from '../lib/utils'

export function SettingsView({ sessionType, actor, overview, workspace, unitId, onLogout }) {
  const token = getStoredToken()
  const activeRole = sessionType === 'STAFF' ? actor?.role : actor?.consumer_role
  const profile = workspace?.profile || {}

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <UbuOneLogo size="md" />
          <Badge variant="cyber">{roleDisplayLabel(activeRole)}</Badge>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#0F1735] border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                {sessionType === 'STAFF' ? (
                  <Store className="w-4 h-4 text-[#00A2E8]" />
                ) : actor?.family_vault_username ? (
                  <Users className="w-4 h-4 text-[#00A2E8]" />
                ) : (
                  <Wallet className="w-4 h-4 text-[#00A2E8]" />
                )}
                {sessionType === 'STAFF'
                  ? 'Active Unit Configuration'
                  : actor?.family_vault_username
                    ? 'Family Vault Binding'
                    : 'Adult Wallet Profile'}
              </div>
              {sessionType === 'STAFF' ? (
                <>
                  <div className="text-[#D2D7DF]">Store: {overview?.unit_name}</div>
                  <div className="text-[#9AA7C4]">Unit ID: {overview?.unit_id || unitId}</div>
                  <div className="text-[#38C3FF] font-mono-code">
                    Pointer: {overview?.open_payments_id}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[#D2D7DF]">
                    Handle: @{actor?.username} ({actor?.full_name})
                  </div>
                  <div className="text-[#9AA7C4]">
                    Class: {profile.account_type || actor?.account_type}
                    {actor?.family_vault_username ? ` · Linked Vault @${actor.family_vault_username}` : ''}
                  </div>
                  <div className="text-[#38C3FF] font-mono-code">
                    Pointer: {profile.open_payments_id || `$spazauniti.org/${actor?.username}`}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[#0F1735] border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <KeyRound className="w-4 h-4 text-[#38E4AE]" />
                Active RBAC Session
              </div>
              <div className="text-[#D2D7DF]">
                Account: {actor?.full_name} (@{actor?.username})
              </div>
              <div className="text-[#9AA7C4]">Role: {activeRole}</div>
              <div className="text-[#8E9BB8] font-mono-code truncate">
                X-UbuOne-Token: {token ? `${token.slice(0, 14)}...` : 'None'}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0F1735] border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <ShieldCheck className="w-4 h-4 text-[#00A2E8]" />
              Unified UbuOne RBAC Architecture
            </div>
            <ul className="space-y-1.5 text-[#9AA7C4] list-disc pl-5">
              <li>
                <strong className="text-white">Family Admin</strong>: Fund the Family UBU Pool, onboard members under `@morake_ext_5`, assign co-admins, adjust caps/categories, and freeze access.
              </li>
              <li>
                <strong className="text-white">Family Member</strong>: Spend up to daily/weekly limits at participating Spaza Units; strictly blocked from modifying limits or draining pools.
              </li>
              <li>
                <strong className="text-white">Adult Account</strong>: Autonomous UBU wallet with single Open Payments loads, loyalty cashouts, and Search-Invite-Allocate beneficiary sponsorship.
              </li>
              <li>
                <strong className="text-white">Unit Staff RBAC</strong>: Cashiers operate counter R1 charges &amp; Change-in-UBU; Owners unlock Settlements, Broadcast switches, and Team RBAC.
              </li>
            </ul>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="danger" onClick={onLogout}>
              <LogOut className="w-4 h-4" />
              Sign Out &amp; Switch Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
