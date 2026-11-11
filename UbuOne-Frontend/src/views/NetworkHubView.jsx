import React from 'react'
import { ArrowRight, Building2, Globe, Radio, Users, Wallet } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '../components/ui/primitives'
import { formatUBU } from '../lib/utils'

export function NetworkHubView({ adminOverview, currentUnitId, onSelectUnit }) {
  const units = adminOverview?.units || []

  return (
    <div className="space-y-6">
      {/* Ecosystem Float Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-xs text-[#9AA7C4]">
              <span>Registered Units</span>
              <Building2 className="w-4 h-4 text-[#00A2E8]" />
            </div>
            <div className="text-2xl font-bold text-white mt-2 tabular-nums">
              {adminOverview?.total_units ?? units.length}
            </div>
            <div className="text-[11px] text-[#9AA7C4] mt-1">Active SpazaUniti nodes</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-xs text-[#9AA7C4]">
              <span>Consumer Accounts</span>
              <Users className="w-4 h-4 text-[#38C3FF]" />
            </div>
            <div className="text-2xl font-bold text-white mt-2 tabular-nums">
              {adminOverview?.total_consumers ?? 0}
            </div>
            <div className="text-[11px] text-[#9AA7C4] mt-1">
              Families &amp; Individual wallets
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-xs text-[#9AA7C4]">
              <span>Consumer UBU Float</span>
              <Wallet className="w-4 h-4 text-[#38E4AE]" />
            </div>
            <div className="text-2xl font-bold text-[#38E4AE] mt-2 tabular-nums">
              {formatUBU(adminOverview?.total_consumer_ubu_float || 0)}
            </div>
            <div className="text-[11px] text-[#9AA7C4] mt-1">Pre-loaded R1 spending pool</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-xs text-[#9AA7C4]">
              <span>Unit Treasury Float</span>
              <Globe className="w-4 h-4 text-[#D2D7DF]" />
            </div>
            <div className="text-2xl font-bold text-white mt-2 tabular-nums">
              {formatUBU(adminOverview?.total_unit_ubu_float || 0)}
            </div>
            <div className="text-[11px] text-[#9AA7C4] mt-1">
              {adminOverview?.counter_sales_count || 0} counter sales routed
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Network Units List */}
      <Card>
        <CardHeader>
          <CardTitle>SpazaUniti Participating Merchant Nodes</CardTitle>
          <Badge variant="cyber">Network Admin Scope</Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {units.map((u) => {
            const active = u.id === currentUnitId
            return (
              <div
                key={u.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                  active
                    ? 'bg-[#00A2E8]/12 border-[#00A2E8]/55'
                    : 'bg-[#0F1735] border-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{u.name}</span>
                      {active && <Badge variant="cyber">Selected</Badge>}
                    </div>
                    <div className="text-xs text-[#9AA7C4] mt-0.5">
                      {u.owner_name} · {u.township}
                    </div>
                    <div className="text-[11px] text-[#38C3FF] font-mono-code mt-1">
                      {u.open_payments_id}
                    </div>
                  </div>
                  <Badge variant={u.broadcast_enabled ? 'mint' : 'default'}>
                    <Radio className="w-3 h-3" />
                    {u.broadcast_enabled ? 'Live' : 'Paused'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                  <div>
                    <div className="text-[10px] text-[#9AA7C4] uppercase tracking-wider">
                      Unit Balance
                    </div>
                    <div className="text-base font-bold text-white tabular-nums">
                      {formatUBU(u.ubu_balance)}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={active ? 'secondary' : 'primary'}
                    onClick={() => onSelectUnit?.(u.id, true)}
                  >
                    {active ? 'Viewing Node' : 'Inspect Unit'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

