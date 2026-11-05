import React, { useState } from 'react';
import { 
  Sparkles, 
  Handshake, 
  Tag, 
  Radio, 
  Coins, 
  Plus, 
  Search, 
  Pause, 
  Play, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  MapPin,
  ChevronRight
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableFooter, 
  TableHead, 
  TableRow, 
  TableCell 
} from '../ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toggleLoyaltyProgram, deleteLoyaltyProgram, deletePromotion } from '../../services/api';

export default function OfferingsView({
  loyaltyPrograms = [],
  promotions = [],
  broadcastActive,
  onToggleBroadcast,
  onOpenCreateLoyalty,
  onOpenCreatePromo,
  onRefreshData,
  showToast
}) {
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Filter loyalty pacts
  const filteredLoyalty = loyaltyPrograms.filter((p) => {
    if (statusFilter === 'active' && !p.active) return false;
    if (statusFilter === 'paused' && p.active) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match = (p.title || '').toLowerCase().includes(q) ||
                    (p.target_item || '').toLowerCase().includes(q) ||
                    (p.community_pact || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Filter promotions
  const filteredPromos = promotions.filter((p) => {
    if (statusFilter === 'active' && !p.active) return false;
    if (statusFilter === 'paused' && p.active) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match = (p.title || '').toLowerCase().includes(q) ||
                    (p.category || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const activePactsCount = loyaltyPrograms.filter(p => p.active).length;
  const activePromosCount = promotions.filter(p => p.active).length;

  const handleToggleLoyalty = async (id, title, currentStatus) => {
    try {
      await toggleLoyaltyProgram(id);
      showToast?.(`${title} is now ${!currentStatus ? 'Active' : 'Paused'} on Spaza Uniti!`, 'info');
      onRefreshData?.();
    } catch (err) {
      console.warn("Toggle loyalty failed:", err);
      showToast?.("Failed to toggle program status", "destructive");
    }
  };

  const handleDeleteLoyalty = async (id, title) => {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await deleteLoyaltyProgram(id);
      showToast?.("Program deleted.", "info");
      onRefreshData?.();
    } catch (err) {
      console.warn("Delete loyalty failed:", err);
      showToast?.("Failed to delete program", "destructive");
    }
  };

  const handleDeletePromo = async (id, title) => {
    if (!confirm(`Delete promotion "${title}"?`)) return;
    try {
      await deletePromotion(id);
      showToast?.("Promotion deleted.", "info");
      onRefreshData?.();
    } catch (err) {
      console.warn("Delete promo failed:", err);
      showToast?.("Failed to delete promotion", "destructive");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            <span>SPAZA UNITI ECOSYSTEM</span>
            <span>/</span>
            <span>NODE #104 MEADOWLANDS</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Unit Offerings & Community Pacts
          </h2>
          <p className="text-xs text-slate-500">
            Manage community loyalty contracts, grocery specials, and live broadcast parameters for nearby township shoppers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button 
            variant="outline" 
            onClick={onOpenCreatePromo} 
            className="gap-2 border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <Tag className="w-4 h-4 text-amber-600" />
            <span>+ New Special</span>
          </Button>

          <Button 
            onClick={onOpenCreateLoyalty} 
            className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            <Handshake className="w-4 h-4" />
            <span>+ New Community Pact</span>
          </Button>
        </div>
      </div>

      {/* 4 ShadCN KPI Cards (Geckoboard / Monday Pattern) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:border-slate-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Loyalty Pacts
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Handshake className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-2xl font-bold text-slate-900">{activePactsCount} Active</h3>
              <Badge variant="emerald">Live on Uniti</Badge>
            </div>
            <p className="text-xs text-slate-500">Unit-scoped token contracts</p>
          </CardContent>
        </Card>

        <Card className="hover:border-slate-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Ubuntu Token Parity
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-2xl font-bold text-slate-900">1 UBU = R1.00</h3>
              <Badge variant="purple">Pegged 1:1</Badge>
            </div>
            <p className="text-xs text-slate-500">Min. R20 taxi off-ramp enabled</p>
          </CardContent>
        </Card>

        <Card className="hover:border-slate-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Live Specials Broadcast
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-2xl font-bold text-slate-900">{activePromosCount} Specials</h3>
              <Badge variant="amber">Up to 18% Off</Badge>
            </div>
            <p className="text-xs text-slate-500">Broadcasted to nearby shoppers</p>
          </CardContent>
        </Card>

        <Card className="hover:border-slate-300 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Broadcast Beacon
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-2xl font-bold text-slate-900">
                {broadcastActive ? 'Node Active' : 'Paused'}
              </h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={broadcastActive} 
                  onChange={(e) => onToggleBroadcast?.(e.target.checked)} 
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
            <p className="text-xs text-slate-500">Meadowlands Zone 2 • 350m radius</p>
          </CardContent>
        </Card>
      </div>

      {/* Official ShadCN Tabs & Filter Toolbar */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3">
          <TabsList className="bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="all" className="gap-2 rounded-lg data-[state=active]:bg-white">
              <span>All Offerings</span>
            </TabsTrigger>
            <TabsTrigger value="loyalty" className="gap-2 rounded-lg data-[state=active]:bg-white">
              <span>Loyalty Pacts</span>
              <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
                {loyaltyPrograms.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="promotions" className="gap-2 rounded-lg data-[state=active]:bg-white">
              <span>Specials & Promos</span>
              <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
                {promotions.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2 rounded-lg data-[state=active]:bg-white">
              <span>Storefront Preview</span>
            </TabsTrigger>
          </TabsList>

          {/* Search & Status Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search pacts, items, categories..."
                className="pl-9 h-9 text-xs rounded-lg bg-white border-slate-200"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="paused">Paused Only</option>
            </select>
          </div>
        </div>

        {/* Tab 1: ALL OFFERINGS (Unified Monday.com-style Groups) */}
        <TabsContent value="all" className="space-y-6 mt-0">
          {/* GROUP 1: COMMUNITY LOYALTY PACTS */}
          <Card className="overflow-hidden border border-slate-200 shadow-sm">
            <div className="px-5 py-3.5 bg-slate-50/75 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-5 rounded-full bg-emerald-600"></span>
                <h3 className="text-sm font-bold text-slate-900">Community Loyalty Pacts</h3>
                <Badge variant="emerald">{activePactsCount} Active</Badge>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                  Templates:
                </span>
                <button
                  type="button"
                  onClick={onOpenCreateLoyalty}
                  className="text-xs bg-white hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 border border-slate-200 rounded-full px-2.5 py-0.5 cursor-pointer transition-colors font-medium"
                >
                  Daily Bread Club
                </button>
                <button
                  type="button"
                  onClick={onOpenCreateLoyalty}
                  className="text-xs bg-white hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 border border-slate-200 rounded-full px-2.5 py-0.5 cursor-pointer transition-colors font-medium"
                >
                  SASSA Pensioner Perk
                </button>
                <button
                  type="button"
                  onClick={onOpenCreateLoyalty}
                  className="text-xs bg-white hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 border border-slate-200 rounded-full px-2.5 py-0.5 cursor-pointer transition-colors font-medium"
                >
                  Tab Settlement Hero
                </button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Pact Name & Community Promise</TableHead>
                  <TableHead className="w-[18%]">Target Product</TableHead>
                  <TableHead className="w-[14%]">Milestone Reward</TableHead>
                  <TableHead className="w-[12%]">Earn Rate</TableHead>
                  <TableHead className="w-[12%]">Required</TableHead>
                  <TableHead className="w-[8%]">Status</TableHead>
                  <TableHead className="w-[6%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoyalty.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500 text-xs">
                      No community loyalty pacts match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLoyalty.map((prog) => {
                    const priceZar = Number(prog.item_price_zar || 16.0).toFixed(2);
                    const rewardUbu = Number(prog.reward_threshold_ubu || 16.0).toFixed(2);
                    const rate = Number(prog.token_rate_per_event || 1.78).toFixed(2);
                    const countReq = prog.stamps_or_count || 9;

                    return (
                      <TableRow key={prog.id} className={!prog.active ? 'opacity-65 bg-slate-50/50' : ''}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 text-xs">{prog.title}</span>
                              <Badge variant="amber" className="text-[10px]">
                                {(prog.program_type || 'COMMUNITY_PACT').replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500 italic line-clamp-1">
                              "{prog.community_pact || prog.reward_description}"
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-medium text-slate-900">{prog.target_item || 'Staples'}</div>
                          <div className="text-[11px] text-slate-500">R{priceZar} shelf</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="purple" className="gap-1 font-semibold text-xs">
                            <Coins className="w-3 h-3 text-purple-700" />
                            {rewardUbu} UBU
                          </Badge>
                          <div className="text-[10px] text-slate-400 mt-0.5">R{rewardUbu} free milestone</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="emerald" className="font-semibold text-xs">
                            +{rate} UBU
                          </Badge>
                          <div className="text-[10px] text-slate-400 mt-0.5">per purchase</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {countReq} {countReq === 1 ? 'event' : 'purchases'}
                          </Badge>
                          <div className="text-[10px] text-amber-700 font-medium mt-0.5 flex items-center gap-1">
                            &ge; R20 Taxi Off-Ramp
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                            prog.active ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${prog.active ? 'bg-emerald-600' : 'bg-slate-400'}`}></span>
                            {prog.active ? 'Active' : 'Paused'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleLoyalty(prog.id, prog.title, prog.active)}
                              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer"
                              title={prog.active ? "Pause program" : "Resume program"}
                            >
                              {prog.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLoyalty(prog.id, prog.title)}
                              className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Delete program"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={7} className="text-xs text-slate-500 font-normal flex justify-between py-2.5">
                    <span>Showing {filteredLoyalty.length} of {loyaltyPrograms.length} community loyalty contracts</span>
                    <span>Pegged at 1 UBU = R1.00 ZAR • Unit-Scoped</span>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Card>

          {/* GROUP 2: LIVE SPECIALS & PROMOTIONS */}
          <Card className="overflow-hidden border border-slate-200 shadow-sm">
            <div className="px-5 py-3.5 bg-slate-50/75 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-5 rounded-full bg-amber-500"></span>
                <h3 className="text-sm font-bold text-slate-900">Live Specials & Discount Promotions</h3>
                <Badge variant="amber">{activePromosCount} Active</Badge>
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={onOpenCreatePromo}
                className="text-xs h-8 gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Special</span>
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[32%]">Special Title & Category</TableHead>
                  <TableHead className="w-[14%]">Normal Price</TableHead>
                  <TableHead className="w-[14%]">Special Price</TableHead>
                  <TableHead className="w-[12%]">Discount</TableHead>
                  <TableHead className="w-[12%]">Duration</TableHead>
                  <TableHead className="w-[10%]">Network</TableHead>
                  <TableHead className="w-[6%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPromos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500 text-xs">
                      No promotions match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPromos.map((promo) => (
                    <TableRow key={promo.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-xs">{promo.title}</span>
                          <Badge variant="blue" className="text-[10px]">
                            {promo.category || 'Bakery'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="line-through text-slate-400 text-xs">
                          R{Number(promo.original_price || 20).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-slate-900 text-xs">
                          R{Number(promo.promo_price || 16).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="font-bold text-xs">
                          -{promo.discount_pct || 15}% OFF
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{promo.days_left || 3}d left</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="emerald" className="text-[10px]">
                          Live on Uniti
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          onClick={() => handleDeletePromo(promo.id, promo.title)}
                          className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Delete promotion"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={7} className="text-xs text-slate-500 font-normal flex justify-between py-2.5">
                    <span>Showing {filteredPromos.length} of {promotions.length} specials</span>
                    <span>Visible to shoppers within 350m radius</span>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Card>
        </TabsContent>

        {/* Tab 2: FOCUSED LOYALTY PACTS */}
        <TabsContent value="loyalty" className="mt-0">
          <Card className="overflow-hidden border border-slate-200 shadow-sm">
            <div className="px-5 py-3.5 bg-slate-50/75 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-5 rounded-full bg-emerald-600"></span>
                <h3 className="text-sm font-bold text-slate-900">Community Loyalty Contracts</h3>
                <Badge variant="emerald">{activePactsCount} Active</Badge>
              </div>
              <Button onClick={onOpenCreateLoyalty} size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Community Pact</span>
              </Button>
            </div>
            {/* Same structured Table component */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Pact Name & Community Promise</TableHead>
                  <TableHead className="w-[18%]">Target Product</TableHead>
                  <TableHead className="w-[14%]">Milestone Reward</TableHead>
                  <TableHead className="w-[12%]">Earn Rate</TableHead>
                  <TableHead className="w-[12%]">Required</TableHead>
                  <TableHead className="w-[8%]">Status</TableHead>
                  <TableHead className="w-[6%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoyalty.map((prog) => (
                  <TableRow key={prog.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-slate-900 text-xs">{prog.title}</span>
                        <p className="text-xs text-slate-500 italic">"{prog.community_pact}"</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{prog.target_item}</TableCell>
                    <TableCell>
                      <Badge variant="purple" className="text-xs">
                        {Number(prog.reward_threshold_ubu || 16.0).toFixed(2)} UBU
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="emerald" className="text-xs">
                        +{Number(prog.token_rate_per_event || 1.78).toFixed(2)} UBU
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{prog.stamps_or_count || 9} purchases</TableCell>
                    <TableCell>
                      <Badge variant={prog.active ? "emerald" : "secondary"}>
                        {prog.active ? "Active" : "Paused"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleToggleLoyalty(prog.id, prog.title, prog.active)} className="p-1 hover:bg-slate-100 rounded">
                          {prog.active ? <Pause className="w-3.5 h-3.5 text-slate-500" /> : <Play className="w-3.5 h-3.5 text-slate-500" />}
                        </button>
                        <button onClick={() => handleDeleteLoyalty(prog.id, prog.title)} className="p-1 hover:bg-rose-50 rounded">
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Tab 3: FOCUSED SPECIALS & PROMOS */}
        <TabsContent value="promotions" className="mt-0">
          <Card className="overflow-hidden border border-slate-200 shadow-sm">
            <div className="px-5 py-3.5 bg-slate-50/75 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-5 rounded-full bg-amber-500"></span>
                <h3 className="text-sm font-bold text-slate-900">Grocery Specials & Discounts</h3>
                <Badge variant="amber">{activePromosCount} Active</Badge>
              </div>
              <Button onClick={onOpenCreatePromo} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Special</span>
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Special Title & Category</TableHead>
                  <TableHead>Normal Price</TableHead>
                  <TableHead>Special Price</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPromos.map((promo) => (
                  <TableRow key={promo.id}>
                    <TableCell className="font-medium text-xs">{promo.title}</TableCell>
                    <TableCell className="text-xs line-through text-slate-400">R{Number(promo.original_price || 20).toFixed(2)}</TableCell>
                    <TableCell className="text-xs font-bold text-slate-900">R{Number(promo.promo_price || 16).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="destructive">-{promo.discount_pct || 15}% OFF</Badge></TableCell>
                    <TableCell className="text-xs">{promo.days_left || 3}d left</TableCell>
                    <TableCell className="text-right">
                      <button onClick={() => handleDeletePromo(promo.id, promo.title)} className="p-1 hover:bg-rose-50 rounded">
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Tab 4: STOREFRONT PREVIEW PANEL */}
        <TabsContent value="preview" className="mt-0">
          <Card className="border border-slate-200 shadow-sm p-6 max-w-xl mx-auto">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Customer Discovery App Mockup (Spaza Uniti React)</span>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Here is how your spaza store card renders for township patrons searching within 350m on the Spaza Uniti Customer Marketplace:
            </p>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-emerald-500 transition-all">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Unit #104 — Mama Zola Spaza</h4>
                  <p className="text-xs text-slate-500 italic mt-0.5">
                    "Meadowlands Zone 2 • Accepts Open Payments & ILP Wallets"
                  </p>
                </div>
                <Badge variant="secondary" className="gap-1 text-slate-700">
                  <MapPin className="w-3 h-3 text-emerald-600" />
                  350m away
                </Badge>
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100 mt-3">
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  15% off Albany Bread
                </span>
                <span className="text-[11px] font-semibold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                  <Handshake className="w-3 h-3" />
                  Daily Bread Stamp Club
                </span>
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                  <Coins className="w-3 h-3" />
                  SASSA Pensioner Perk
                </span>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
