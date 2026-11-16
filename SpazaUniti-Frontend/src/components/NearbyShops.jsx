import React, { useState } from 'react';
import { Star, Heart, Tag, ArrowRight } from 'lucide-react';

export default function NearbyShops({ shops, onSelectShop, onSeeAll }) {
  const [favorites, setFavorites] = useState({});

  const toggleFavorite = (e, shopId) => {
    e.stopPropagation();
    setFavorites(prev => ({ ...prev, [shopId]: !prev[shopId] }));
  };

  return (
    <div className="my-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xl font-bold text-white tracking-tight">
          Nearby Shops
        </h3>
        <button
          onClick={onSeeAll}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#22c55e] hover:text-emerald-400 transition-colors cursor-pointer"
        >
          <span>See all</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {shops.map((shop) => {
          const isFav = !!favorites[shop.id];

          return (
            <div
              key={shop.id}
              onClick={() => onSelectShop(shop)}
              className="bg-[#141a24] hover:bg-[#18202d] border border-[#20293a] hover:border-emerald-500/40 rounded-2xl overflow-hidden shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between"
            >
              {/* Image Banner */}
              <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                <img
                  src={shop.image}
                  alt={shop.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />

                {/* Top-Left Promo Badge */}
                {shop.badge && (
                  <div className="absolute top-3 left-3 bg-[#16a34a] text-white text-xs font-extrabold px-3 py-1 rounded-full shadow-md">
                    {shop.badge}
                  </div>
                )}

                {/* Top-Right Favorite Heart */}
                <button
                  onClick={(e) => toggleFavorite(e, shop.id)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-900/60 backdrop-blur-sm hover:bg-slate-900/90 text-white flex items-center justify-center transition-colors"
                  title="Favorite this shop"
                >
                  <Heart
                    className={`w-4 h-4 transition-colors ${
                      isFav ? 'text-red-500 fill-red-500' : 'text-slate-200'
                    }`}
                  />
                </button>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                    {shop.name}
                  </h4>

                  {/* Rating & Distance */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1 mb-2.5">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                    <span className="font-bold text-white">{shop.rating}</span>
                    <span className="text-slate-400">({shop.reviewCount})</span>
                    <span className="text-slate-500">•</span>
                    <span className="font-medium text-slate-300">{shop.distanceKm} km</span>
                  </div>

                  {/* Category Pills */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {shop.categories.map((cat, i) => (
                      <span
                        key={i}
                        className="bg-[#1b2332] text-slate-300 text-[11px] font-semibold px-2.5 py-0.5 rounded-md"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Highlight Tag Strip */}
                {shop.highlightText && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 pt-2.5 border-t border-[#1e2738]">
                    {shop.highlightType === 'star' ? (
                      <Star className="w-3.5 h-3.5 fill-amber-400 shrink-0" />
                    ) : (
                      <Tag className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="line-clamp-1">{shop.highlightText}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

