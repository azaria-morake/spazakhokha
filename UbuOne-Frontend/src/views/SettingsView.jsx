import React from 'react'
import { KeyRound, LogOut, ShieldCheck, Store } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '../components/ui/primitives'
import { UbuOneLogo } from '../components/UbuOneBrand'
import { getStoredToken } from '../lib/api'
import { roleDisplayLabel } from '../lib/utils'

export function SettingsView({ staff, overview, unitId, onLogout }) {
  const token = getStoredToken()

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <UbuOneLogo size="md" />
          <Badge variant="cyber">{roleDisplayLabel(staff?.role)}</Badge>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#0F1735] border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Store className="w-4 h-4 text-[#00A2E8]" />
                Active Unit Configuration
              </div>
              <div className="text-[#D2D7DF]">Store: {overview?.unit_name}</div>
              <div className="text-[#9AA7C4]">Unit ID: {overview?.unit_id || unitId}</div>
              <div className="text-[#38C3FF] font-mono-code">
                Pointer: {overview?.open_payments_id}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0F1735] border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <KeyRound className="w-4 h-4 text-[#38E4AE]" />
                Active RBAC Session
              </div>
              <div className="text-[#D2D7DF]">
                Staff: {staff?.full_name} (@{staff?.username})
              </div>
              <div className="text-[#9AA7C4]">Role: {staff?.role}</div>
              <div className="text-[#8E9BB8] font-mono-code truncate">
                X-UbuOne-Token: {token ? `${token.slice(0, 14)}...` : 'None'}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0F1735] border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <ShieldCheck className="w-4 h-4 text-[#00A2E8]" />
              RBAC Scope Summary
            </div>
            <ul className="space-y-1.5 text-[#9AA7C4] list-disc pl-5">
              <li>
                <strong className="text-white">Unit Cashier</strong>: Counter UBU Till (R1 moments &amp; Family Pool deductions), Change-in-UBU, read unit pacts &amp; specials.
              </li>
              <li>
                <strong className="text-white">Unit Owner</strong>: Full counter access plus Wholesaler Open Payments &amp; Batched EFT settlements, Store Broadcast switch, Loyalty/Promo publishing, and Staff RBAC management.
              </li>
              <li>
                <strong className="text-white">Network Admin</strong>: Ecosystem explorer across all SpazaUniti nodes with unit switching.
              </li>
            </ul>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="danger" onClick={onLogout}>
              <LogOut className="w-4 h-4" />
              Sign Out &amp; Switch Role
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

