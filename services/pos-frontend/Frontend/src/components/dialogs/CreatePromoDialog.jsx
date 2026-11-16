import React, { useState } from 'react';
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
import { Tag, Check } from 'lucide-react';
import { createPromotion } from '../../services/api';

export default function CreatePromoDialog({ 
  open, 
  onOpenChange, 
  onCreated, 
  showToast 
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Bakery');
  const [originalPrice, setOriginalPrice] = useState('19.50');
  const [promoPrice, setPromoPrice] = useState('16.00');
  const [days, setDays] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    const orig = Number(originalPrice) || 20;
    const promo = Number(promoPrice) || 16;
    const discountPct = Math.round(((orig - promo) / orig) * 100);

    const newPromo = {
      title: title.trim(),
      category,
      original_price: orig,
      promo_price: promo,
      discount_pct: discountPct > 0 ? discountPct : 15,
      days_left: Number(days) || 3,
      active: true,
    };

    try {
      await createPromotion(newPromo);
      showToast?.(`Promotion "${title}" broadcast to Spaza Uniti!`, 'success');
      onCreated?.();
      onOpenChange(false);
      setTitle('');
    } catch (err) {
      console.warn("Failed to create promotion:", err);
      showToast?.("Failed to create promotion", "destructive");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-300">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Broadcast New Special</DialogTitle>
              <DialogDescription className="text-xs">
                Publish a grocery discount to nearby shoppers on Spaza Uniti within 350m radius.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Promotion Title
            </label>
            <Input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              required 
              placeholder="e.g. Weekend Albany Superior Special" 
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600"
            >
              <option value="Bakery">Bakery & Bread</option>
              <option value="Staples">Staples & Maize</option>
              <option value="Beverages">Beverages & Cold Drinks</option>
              <option value="Dairy">Dairy & Milk</option>
              <option value="Snacks">Snacks & Sweets</option>
              <option value="Household">Household & Cleaning</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Normal (R)
              </label>
              <Input 
                type="number" 
                step="0.50" 
                value={originalPrice} 
                onChange={(e) => setOriginalPrice(e.target.value)} 
                required 
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Promo (R)
              </label>
              <Input 
                type="number" 
                step="0.50" 
                value={promoPrice} 
                onChange={(e) => setPromoPrice(e.target.value)} 
                required 
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Days
              </label>
              <Input 
                type="number" 
                min={1} 
                max={30} 
                value={days} 
                onChange={(e) => setDays(e.target.value)} 
                required 
              />
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
              <span>{submitting ? 'Broadcasting...' : 'Broadcast to Spaza Uniti'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
