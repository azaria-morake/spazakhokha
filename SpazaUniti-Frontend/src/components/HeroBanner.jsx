import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function HeroBanner({ onExploreDeals }) {
  return (
    <div className="relative rounded-3xl overflow-hidden border border-[#1f283a] bg-gradient-to-r from-[#15803d] via-[#166534] to-[#14532d] shadow-xl my-6 flex flex-col md:flex-row items-center justify-between">
      {/* Left Content */}
      <div className="p-8 md:p-10 z-10 max-w-lg">
        <h2 className="text-3xl md:text-4xl lg:text-[40px] font-black text-white leading-[1.15] tracking-tight">
          Better Prices.<br />
          Bigger Rewards.
        </h2>
        <p className="text-emerald-100/90 text-sm md:text-base font-medium mt-3 mb-6 max-w-sm">
          Discover great deals at your favourite local shops.
        </p>
        <button
          onClick={onExploreDeals}
          className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm px-6 py-3 rounded-full shadow-lg transition-all hover:gap-3 cursor-pointer"
        >
          <span>Explore Deals</span>
          <ArrowRight className="w-4 h-4 text-slate-900" />
        </button>
      </div>

      {/* Right Image Container */}
      <div className="relative w-full md:w-1/2 h-64 md:h-72 self-stretch overflow-hidden">
        {/* Soft gradient blend on left */}
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#166534] to-transparent z-10 hidden md:block"></div>
        <img
          src="/hero_spaza.jpg"
          alt="Friendly local spaza shop owner"
          className="w-full h-full object-cover object-center"
        />
        {/* Spaza Shop Badge Overlay */}
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm border border-red-500/30 rounded-xl px-3.5 py-1.5 shadow-md hidden sm:flex items-center gap-2">
          <span className="text-red-600 font-black text-xs tracking-wider uppercase">
            SPAZA SHOP
          </span>
        </div>
      </div>
    </div>
  );
}

