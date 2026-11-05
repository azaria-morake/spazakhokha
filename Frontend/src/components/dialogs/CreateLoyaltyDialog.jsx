import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Handshake, Sparkles, Check, Car } from 'lucide-react';
import { createLoyaltyProgram } from '../../services/api';

export default function CreateLoyaltyDialog({ 
  open, 
  onOpenChange, 
  onCreated, 
  showToast 
}) {
  const [title, setTitle] = useState('Daily Bread Stamp Club');
  const [programType, setProgramType] = useState('STAPLE_ACCUMULATOR');
  const [communityPact, setCommunityPact] = useState(
    'Buy 9 loaves of Albany bread, get the 10th loaf FREE! Tracked automatically as Ubuntu Tokens.'
  );
  const [targetItem, setTargetItem] = useState('Albany Superior White Bread');
  const [shelfPrice, setShelfPrice] = useState(16.0);
  const [stampsCount, setStampsCount] = useState(9);
  const [submitting, setSubmitting] = useState(false);

  // Real-time Ubuntu Token Economics
  const price = Number(shelfPrice) || 16.0;
  const count = Number(stampsCount) || 9;
  const earnRate = (price / Math.max(1, count)).toFixed(2);
  const milestoneUbu = price.toFixed(2);

  const applyPreset = (preset) => {
    if (preset === 'bread') {
      setTitle('Daily Bread Stamp Club');
      setProgramType('STAPLE_ACCUMULATOR');
      setCommunityPact('Buy 9 loaves of Albany bread, get the 10th loaf FREE! Tracked automatically as Ubuntu Tokens.');
      setTargetItem('Albany Superior White Bread');
      setShelfPrice(16.0);
      setStampsCount(9);
    } else if (preset === 'sassa') {
      setTitle('SASSA Pensioner Goodwill Perk');
      setProgramType('PENSIONER_SASSA_PERK');
      setCommunityPact('Every pensioner shopping on SASSA payout day receives 15.00 Ubuntu Tokens for a free 500g sugar pack or tea.');
      setTargetItem('500g Sugar Pack or Glen Tea');
      setShelfPrice(15.0);
      setStampsCount(1);
    } else if (preset === 'tab') {
      setTitle('Tab Settlement Hero');
      setProgramType('TAB_REPAYMENT_BONUS');
      setCommunityPact('Settle your outstanding credit tab within 7 days, get 10.00 Ubuntu Tokens (R10 airtime allowance on the house).');
      setTargetItem('Vodacom / MTN R10 Airtime Voucher');
      setShelfPrice(10.0);
      setStampsCount(1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const newProg = {
      title,
      program_type: programType,
      community_pact: communityPact,
      target_item: targetItem,
      item_price_zar: price,
      reward_threshold_ubu: price,
      token_rate_per_event: Number(earnRate),
      stamps_or_count: count,
      reward_description: `${communityPact} (${price.toFixed(2)} UBU Reward)`,
      active: true,
    };

    try {
      await createLoyaltyProgram(newProg);
      showToast?.(`Pact "${title}" published and live on Spaza Uniti!`, 'success');
      onCreated?.();
      onOpenChange(false);
    } catch (err) {
      console.warn("Failed to create loyalty program:", err);
      showToast?.("Failed to create program on server", "destructive");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-300">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Create Community Loyalty Pact</DialogTitle>
              <DialogDescription className="text-xs">
                Configure an informal reciprocity pact. Mkhulu maps your target product to Ubuntu Tokens (1 UBU = R1.00 ZAR).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Templates bar */}
        <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">
            Templates:
          </span>
          <button
            type="button"
            onClick={() => applyPreset('bread')}
            className="text-xs font-medium px-2.5 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 border border-slate-200 hover:border-emerald-300 rounded-full cursor-pointer transition-colors"
          >
            Daily Bread Club
          </button>
          <button
            type="button"
            onClick={() => applyPreset('sassa')}
            className="text-xs font-medium px-2.5 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 border border-slate-200 hover:border-emerald-300 rounded-full cursor-pointer transition-colors"
          >
            SASSA Pensioner Perk
          </button>
          <button
            type="button"
            onClick={() => applyPreset('tab')}
            className="text-xs font-medium px-2.5 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 border border-slate-200 hover:border-emerald-300 rounded-full cursor-pointer transition-colors"
          >
            Tab Settlement Hero
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Pact Name
              </label>
              <Input 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                required 
                placeholder="e.g. Daily Bread Stamp Club" 
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Pact Archetype
              </label>
              <select
                value={programType}
                onChange={(e) => setProgramType(e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600"
              >
                <option value="STAPLE_ACCUMULATOR">Staple Frequency (e.g. 9 bread = 10th free)</option>
                <option value="PENSIONER_SASSA_PERK">SASSA Pensioner Goodwill (Sugar, tea perk)</option>
                <option value="TAB_REPAYMENT_BONUS">Tab Repayment Hero (Cashback / Airtime)</option>
                <option value="CUSTOM_UBUNTU">Custom Ubuntu Community Pact</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Community Promise (Display Quote)
            </label>
            <Textarea
              value={communityPact}
              onChange={(e) => setCommunityPact(e.target.value)}
              rows={2}
              required
              placeholder="e.g. Buy 9 loaves of Albany bread, get the 10th loaf FREE!"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Target Product
              </label>
              <Input 
                value={targetItem} 
                onChange={(e) => setTargetItem(e.target.value)} 
                required 
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Shelf Price (ZAR)
              </label>
              <Input 
                type="number" 
                step="0.50" 
                value={shelfPrice} 
                onChange={(e) => setShelfPrice(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Purchases / Milestones Required
            </label>
            <Input 
              type="number" 
              min={1} 
              max={50} 
              value={stampsCount} 
              onChange={(e) => setStampsCount(e.target.value)} 
              required 
            />
          </div>

          {/* Real-Time Economics Breakdown */}
          <div className="grid grid-cols-3 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Earn Rate</span>
              <strong className="text-sm font-bold text-emerald-700">+{earnRate} UBU</strong>
              <small className="text-[10px] text-slate-500">per purchase</small>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reward Milestone</span>
              <strong className="text-sm font-bold text-purple-700">{milestoneUbu} UBU</strong>
              <small className="text-[10px] text-slate-500">100% item value</small>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Off-Ramp Rule</span>
              <strong className="text-sm font-bold text-amber-700">R20 Taxi Fare</strong>
              <small className="text-[10px] text-slate-500">&ge; 20 UBU cash-out</small>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={submitting} 
              className="bg-emerald-700 hover:bg-emerald-800 text-white gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{submitting ? 'Activating...' : 'Activate on Spaza Uniti'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
