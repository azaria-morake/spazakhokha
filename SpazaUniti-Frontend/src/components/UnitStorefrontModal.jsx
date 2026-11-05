import React, { useState, useEffect } from 'react';
import { 
  Store, 
  MapPin, 
  Clock, 
  Star, 
  ShieldCheck, 
  X, 
  Plus, 
  Trophy, 
  Briefcase, 
  Info,
  CheckCircle2,
  MessageCircle
} from 'lucide-react';
import { fetchUnitDetail } from '../services/api';

export default function UnitStorefrontModal({
  isOpen,
  onClose,
  shop,
  onAddToCart,
  currentCustomer
}) {
  const [activeTab, setActiveTab] = useState('specials');
  const [liveDetails, setLiveDetails] = useState(null);

  useEffect(() => {
    if (!isOpen || !shop) return;
    const unitId = shop.unit_id || shop.id;
    if (unitId) {
      fetchUnitDetail(unitId).then(data => {
        if (data) setLiveDetails(data);
      });
    }
  }, [isOpen, shop]);

  if (!isOpen || !shop) return null;

  // Fallback standardized deals for this unit
  const fallbackSpecials = [
    {
      id: `${shop.id}-deal-1`,
      name: "Cooking Oil 2L Special",
      price: 35.00,
      origPrice: 42.00,
      discount: "16% OFF",
      image: "/oil_2l.jpg",
      unit: "2 Liters"
    },
    {
      id: `${shop.id}-deal-2`,
      name: "Albany Superior White Bread",
      price: 14.00,
      origPrice: 17.50,
      discount: "20% OFF",
      image: "/bread_loaf.jpg",
      unit: "700g Loaf"
    },
    {
      id: `${shop.id}-deal-3`,
      name: "Golden Cloud Cake Flour 2.5kg",
      price: 36.00,
      origPrice: 44.00,
      discount: "18% OFF",
      image: "/oil_2l.jpg",
      unit: "2.5kg Bag"
    }
  ];

  // Resolve specials: use live backend promotions if available, otherwise fallback
  const specials = (liveDetails?.promotions && liveDetails.promotions.length > 0)
    ? liveDetails.promotions.map((p, idx) => {
        const isBread = p.title?.toLowerCase().includes("bread") || p.title?.toLowerCase().includes("albany");
        return {
          id: p.id || `${shop.id}-live-promo-${idx}`,
          name: p.title,
          price: Number(p.promo_price || p.price || 0),
          origPrice: Number(p.original_price || p.origPrice || (p.promo_price * 1.2)),
          discount: p.discount_pct ? `${p.discount_pct}% OFF` : "SPECIAL",
          image: isBread ? "/bread_loaf.jpg" : "/oil_2l.jpg",
          unit: p.category || "Grocery Special"
        };
      })
    : fallbackSpecials;

  // Community township gigs listed by this store
  const fallbackGigs = [
    {
      id: "gig-1",
      title: "Weekend Stock & Inventory Packer",
      pay: "R120 / morning shift",
      schedule: "Sat & Sun 07:00 - 12:00",
      description: "Help unpack morning bread crates, stack shelves, and tally simba inventory."
    },
    {
      id: "gig-2",
      title: "Morning Bread Runner",
      pay: "R80 / delivery round",
      schedule: "Mon-Fri 06:30 - 08:30",
      description: "Walk fresh morning Albany bread to elderly pensioners in the neighborhood."
    }
  ];

  const gigs = (liveDetails?.jobs && liveDetails.jobs.length > 0)
    ? liveDetails.jobs.map((j, idx) => ({
        id: j.id || `live-gig-${idx}`,
        title: j.title,
        pay: j.pay || "Township Gig",
        schedule: j.schedule || "Flexible",
        description: j.description || "Community task at store."
      }))
    : fallbackGigs;

  const loyaltyTitle = liveDetails?.loyalty_program?.title || "Daily Bread Stamp Club";
  const loyaltyReward = liveDetails?.loyalty_program?.reward_description || "Buy 9 loaves of Albany bread, get the 10th loaf FREE! Tracked automatically on Spaza Uniti.";
  const stampsRequired = liveDetails?.loyalty_program?.stamps_required || 10;
  const earnedStamps = Math.min(currentCustomer?.stamps || 6, stampsRequired);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#141b27] border border-[#232f44] rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        
        {/* Header Hero Banner */}
        <div className="relative h-44 w-full bg-slate-900 shrink-0">
          <img
            src={shop.image}
            alt={shop.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#141b27] via-[#141b27]/60 to-transparent"></div>
          
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-900/80 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-3 left-6 right-6 flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-black text-white">{shop.name}</h3>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Verified Node
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>{shop.address || shop.township}</span>
                <span className="text-slate-500">•</span>
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{shop.hours || '06:30 - 20:00 Daily'}</span>
              </p>
            </div>
            <div className="text-right hidden sm:block">
              <span className="text-xs text-slate-400 block font-mono">{shop.open_payments_id}</span>
              <span className="text-xs font-bold text-emerald-400">{shop.distanceKm} km away</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#1e273a] px-6 bg-[#111722]">
          <button
            onClick={() => setActiveTab('specials')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'specials'
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Live Specials</span>
          </button>
          <button
            onClick={() => setActiveTab('loyalty')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'loyalty'
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Bread Loyalty Club</span>
          </button>
          <button
            onClick={() => setActiveTab('gigs')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'gigs'
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Briefcase className="w-4 h-4 text-sky-400" />
            <span>Community Gigs (2)</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'specials' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Select items to add to your cart:</span>
                <span className="text-emerald-400 font-semibold">● Broadcasted live from store counter</span>
              </div>
              {specials.map((deal) => (
                <div
                  key={deal.id}
                  className="flex items-center justify-between gap-4 bg-[#182130] border border-[#25334a] rounded-2xl p-3.5 hover:border-emerald-500/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-slate-900 border border-[#25334a] overflow-hidden p-1 shrink-0 flex items-center justify-center">
                      <img src={deal.image} alt={deal.name} className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="text-sm font-bold text-white">{deal.name}</h5>
                        <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold px-1.5 py-0.2 rounded">
                          {deal.discount}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{deal.unit}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs line-through text-slate-500">R{deal.origPrice.toFixed(2)}</span>
                        <span className="text-sm font-black text-emerald-400">R{deal.price.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onAddToCart({
                      id: deal.id,
                      name: deal.name,
                      price: deal.price,
                      image: deal.image,
                      quantity: 1,
                      unit: deal.unit
                    })}
                    className="bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add to Cart</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'loyalty' && (
            <div className="bg-[#182130] border border-[#25334a] rounded-2xl p-5 text-center">
              <div className="flex items-center justify-between mb-4">
                <div className="text-left">
                  <h4 className="text-base font-bold text-white">{loyaltyTitle}</h4>
                  <p className="text-xs text-slate-400">Tracked automatically for @{currentCustomer?.username || 'mannini'}</p>
                </div>
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-bold px-3 py-1 rounded-full">
                  {earnedStamps} / {stampsRequired} Stamps Collected
                </span>
              </div>

              {/* Stamps Grid */}
              <div className="grid grid-cols-5 gap-3 my-5 p-4 bg-[#101622] rounded-xl border border-[#232f44]">
                {[...Array(stampsRequired)].map((_, i) => {
                  const stampNum = i + 1;
                  const isFilled = stampNum <= earnedStamps;
                  const isReward = stampNum === stampsRequired;

                  return (
                    <div
                      key={stampNum}
                      className={`aspect-square rounded-full flex flex-col items-center justify-center font-bold text-xs transition-all ${
                        isFilled
                          ? isReward
                            ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-400/30'
                            : 'bg-emerald-600 text-white shadow-md'
                          : 'border-2 border-dashed border-slate-700 text-slate-600 bg-slate-900/50'
                      }`}
                    >
                      {isFilled ? (
                        isReward ? <Trophy className="w-5 h-5 text-slate-950" /> : <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <span>#{stampNum}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 text-left flex items-center gap-3">
                <Trophy className="w-6 h-6 text-amber-400 shrink-0" />
                <p className="text-xs text-amber-200">
                  <strong>Reward Milestone:</strong> {loyaltyReward}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'gigs' && (
            <div className="space-y-3.5">
              {gigs.map((gig) => (
                <div
                  key={gig.id}
                  className="bg-[#182130] border border-[#25334a] rounded-2xl p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <h5 className="text-sm font-bold text-white">{gig.title}</h5>
                    <div className="flex items-center gap-3 text-xs text-slate-400 my-1">
                      <span className="text-emerald-400 font-bold">{gig.pay}</span>
                      <span>•</span>
                      <span>{gig.schedule}</span>
                    </div>
                    <p className="text-xs text-slate-400">{gig.description}</p>
                  </div>
                  <button
                    onClick={() => alert(`WhatsApp inquiry prepared for ${shop.owner_name} regarding "${gig.title}".`)}
                    className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Apply</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

