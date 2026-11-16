import React, { useEffect, useState } from 'react'
import { Award, Plus, Radio, Tag, Trash2, Lock } from 'lucide-react'
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
import {
  createUnitLoyalty,
  createUnitPromo,
  deleteUnitLoyalty,
  deleteUnitPromo,
  fetchUnitLoyalty,
  fetchUnitPromotions,
  toggleUnitBroadcast,
  toggleUnitLoyalty,
} from '../lib/api'
import { formatZAR } from '../lib/utils'

export function PactsPromosView({ unitId, overview, staff, onRefresh, showToast }) {
  const canEdit = staff?.role === 'UNIT_OWNER' || staff?.role === 'NETWORK_ADMIN'

  const [loyaltyList, setLoyaltyList] = useState([])
  const [promos, setPromos] = useState([])
  const [loading, setLoading] = useState(true)

  const [loyaltyModal, setLoyaltyModal] = useState(false)
  const [promoModal, setPromoModal] = useState(false)

  // New Loyalty Pact Form
  const [lTitle, setLTitle] = useState('R1 Vetkoek & Tea Pact')
  const [lType, setLType] = useState('STAPLE_ACCUMULATOR')
  const [lPact, setLPact] = useState('Buy 8 Vetkoeks, get the 9th free in Ubuntu Tokens.')
  const [lItem, setLItem] = useState('Fresh Vetkoek')
  const [lPrice, setLPrice] = useState('5')
  const [lStamps, setLStamps] = useState('8')

  // New Promo Form
  const [pTitle, setPTitle] = useState('2L Cooking Oil Flash Special')
  const [pCategory, setPCategory] = useState('Essentials')
  const [pOrig, setPOrig] = useState('78')
  const [pSale, setPSale] = useState('64')
  const [pDays, setPDays] = useState('4')

  const loadData = async () => {
    setLoading(true)
    try {
      const [loy, pro] = await Promise.all([
        fetchUnitLoyalty(unitId),
        fetchUnitPromotions(unitId),
      ])
      setLoyaltyList(Array.isArray(loy) ? loy : [])
      setPromos(Array.isArray(pro) ? pro : [])
    } catch (err) {
      showToast?.(err.message || 'Could not load loyalty pacts', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [unitId])

  const handleToggleBroadcast = async (enabled) => {
    try {
      await toggleUnitBroadcast(unitId, enabled)
      showToast?.(
        `SpazaUniti Live Broadcast is now ${enabled ? 'ACTIVE' : 'PAUSED'}`,
        'success'
      )
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Permission denied', 'error')
    }
  }

  const handleCreateLoyalty = async (e) => {
    e.preventDefault()
    try {
      const priceNum = Number(lPrice || 10)
      const stampsNum = Math.max(1, Number(lStamps || 5))
      await createUnitLoyalty(unitId, {
        title: lTitle.trim(),
        program_type: lType,
        community_pact: lPact.trim(),
        target_item: lItem.trim(),
        item_price_zar: priceNum,
        reward_threshold_ubu: priceNum,
        token_rate_per_event: Number((priceNum / stampsNum).toFixed(2)),
        stamps_or_count: stampsNum,
        active: true,
      })
      showToast?.('Community Loyalty Pact published!', 'success')
      setLoyaltyModal(false)
      loadData()
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Failed to publish pact', 'error')
    }
  }

  const handleCreatePromo = async (e) => {
    e.preventDefault()
    try {
      await createUnitPromo(unitId, {
        title: pTitle.trim(),
        category: pCategory.trim(),
        original_price: Number(pOrig),
        promo_price: Number(pSale),
        days_left: Number(pDays),
      })
      showToast?.('Store special broadcast live!', 'success')
      setPromoModal(false)
      loadData()
      onRefresh?.()
    } catch (err) {
      showToast?.(err.message || 'Failed to add special', 'error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Live SpazaUniti Broadcast Banner */}
      <Card>
        <CardContent className="pt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#00A2E8]/15 border border-[#00A2E8]/35 flex items-center justify-center text-[#00A2E8]">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  SpazaUniti Discovery Broadcast
                </h2>
                <Badge variant={overview?.broadcast_enabled ? 'mint' : 'default'}>
                  {overview?.broadcast_enabled ? 'LIVE TO SHOPPERS' : 'PAUSED'}
                </Badge>
              </div>
              <p className="text-xs text-[#9AA7C4] mt-0.5">
                When enabled, nearby shoppers on SpazaUniti (Port 3001) immediately see your store specials &amp; Community Loyalty Pacts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!canEdit && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-300">
                <Lock className="w-3.5 h-3.5" /> Owner-only controls
              </span>
            )}
            <Switch
              checked={overview?.broadcast_enabled}
              disabled={!canEdit}
              onChange={handleToggleBroadcast}
              label="Toggle SpazaUniti Broadcast"
            />
          </div>
        </CardContent>
      </Card>

      {/* Two Sections: Community Loyalty Pacts + Store Flash Specials */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loyalty Pacts */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#00A2E8]" />
              <CardTitle>Community Loyalty Pacts ({loyaltyList.length})</CardTitle>
            </div>
            {canEdit && (
              <Button size="sm" onClick={() => setLoyaltyModal(true)}>
                <Plus className="w-3.5 h-3.5" />
                New Pact
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="text-xs text-[#9AA7C4] py-4">Loading pacts...</div>
            ) : (
              loyaltyList.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-xl bg-[#0F1735] border border-white/10 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-white">{p.title}</div>
                      <div className="text-[11px] text-[#38C3FF] font-medium mt-0.5">
                        {p.program_type} · {p.target_item}
                      </div>
                    </div>
                    <Badge variant={p.active ? 'mint' : 'default'}>
                      {p.active ? 'Active' : 'Paused'}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#D2D7DF]/85 leading-relaxed">
                    {p.community_pact}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[11px] text-[#9AA7C4]">
                    <span>
                      Reward: <strong className="text-white">{p.reward_threshold_ubu} UBU</strong> ({p.stamps_required || p.stamps_or_count} steps)
                    </span>
                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await toggleUnitLoyalty(unitId, p.id)
                            loadData()
                            onRefresh?.()
                          }}
                          className="text-[#38C3FF] hover:underline font-semibold cursor-pointer"
                        >
                          {p.active ? 'Pause' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteUnitLoyalty(unitId, p.id)
                            loadData()
                            onRefresh?.()
                          }}
                          className="text-[#F46B78] hover:text-rose-300 cursor-pointer"
                          title="Delete pact"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Flash Promotions */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#38E4AE]" />
              <CardTitle>Township Flash Specials ({promos.length})</CardTitle>
            </div>
            {canEdit && (
              <Button size="sm" onClick={() => setPromoModal(true)}>
                <Plus className="w-3.5 h-3.5" />
                Add Special
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="text-xs text-[#9AA7C4] py-4">Loading specials...</div>
            ) : (
              promos.map((pr) => (
                <div
                  key={pr.id}
                  className="p-4 rounded-xl bg-[#0F1735] border border-white/10 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{pr.title}</span>
                      <Badge variant="cyber">{pr.discount_pct}% OFF</Badge>
                    </div>
                    <div className="text-xs text-[#9AA7C4] mt-1">
                      {pr.category} · {pr.days_left} days left ·{' '}
                      <span className="line-through text-[#7F8CAE]">
                        {formatZAR(pr.original_price)}
                      </span>{' '}
                      <strong className="text-[#38E4AE]">
                        {formatZAR(pr.promo_price)}
                      </strong>
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteUnitPromo(unitId, pr.id)
                        loadData()
                        onRefresh?.()
                      }}
                      className="p-2 rounded-lg hover:bg-rose-500/15 text-[#F46B78] cursor-pointer"
                      title="Remove promo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Loyalty Modal */}
      <Dialog open={loyaltyModal} onOpenChange={setLoyaltyModal}>
        <DialogHeader
          title="Publish Community Loyalty Pact"
          subtitle="Customers earn Ubuntu Tokens automatically when checking out via UBU."
          onClose={() => setLoyaltyModal(false)}
        />
        <form onSubmit={handleCreateLoyalty} className="space-y-3.5">
          <div>
            <label className="block text-xs text-[#D2D7DF] mb-1">Pact Title</label>
            <Input value={lTitle} onChange={(e) => setLTitle(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#D2D7DF] mb-1">Program Type</label>
              <select
                value={lType}
                onChange={(e) => setLType(e.target.value)}
                className="w-full h-10 px-3 rounded-xl ubu-input-surface text-xs text-white"
              >
                <option value="STAPLE_ACCUMULATOR" className="bg-[#0F1735]">Staple Accumulator</option>
                <option value="MICRO_CASHBACK" className="bg-[#0F1735]">R1 Micro Cashback</option>
                <option value="PENSIONER_SASSA_PERK" className="bg-[#0F1735]">SASSA Goodwill Perk</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#D2D7DF] mb-1">Target Item</label>
              <Input value={lItem} onChange={(e) => setLItem(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#D2D7DF] mb-1">Reward Value (UBU / R)</label>
              <Input type="number" step="0.5" value={lPrice} onChange={(e) => setLPrice(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs text-[#D2D7DF] mb-1">Stamps / Purchases</label>
              <Input type="number" value={lStamps} onChange={(e) => setLStamps(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#D2D7DF] mb-1">Community Pact Message</label>
            <Input value={lPact} onChange={(e) => setLPact(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full">
            Publish to SpazaUniti
          </Button>
        </form>
      </Dialog>

      {/* Create Promo Modal */}
      <Dialog open={promoModal} onOpenChange={setPromoModal}>
        <DialogHeader
          title="Broadcast Store Special"
          subtitle="Appears live under nearby deals on SpazaUniti Customer App."
          onClose={() => setPromoModal(false)}
        />
        <form onSubmit={handleCreatePromo} className="space-y-3.5">
          <div>
            <label className="block text-xs text-[#D2D7DF] mb-1">Special Title</label>
            <Input value={pTitle} onChange={(e) => setPTitle(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#D2D7DF] mb-1">Category</label>
              <Input value={pCategory} onChange={(e) => setPCategory(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs text-[#D2D7DF] mb-1">Days Active</label>
              <Input type="number" value={pDays} onChange={(e) => setPDays(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#D2D7DF] mb-1">Original Price (R)</label>
              <Input type="number" step="0.5" value={pOrig} onChange={(e) => setPOrig(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs text-[#D2D7DF] mb-1">Promo Price (R)</label>
              <Input type="number" step="0.5" value={pSale} onChange={(e) => setPSale(e.target.value)} required />
            </div>
          </div>
          <Button type="submit" className="w-full">
            Publish Special Now
          </Button>
        </form>
      </Dialog>
    </div>
  )
}

