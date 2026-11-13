import React, { useState } from 'react';
import { MapPin, ChevronDown, Search, Bell } from 'lucide-react';
import { TOWNSHIPS } from '../data/mockData';

export default function Header({
  selectedTownship,
  onSelectTownship,
  searchQuery,
  onSearchChange,
  currentCustomer,
  onOpenCustomerModal,
  onOpenNotifications,
  onOpenLiveTestnet
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="flex items-center justify-between gap-4 py-4 px-6 border-b border-[#1b2232] bg-[#0c1017]">
      {/* Location Selector Pill */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 bg-[#171e2c] border border-[#242f44] hover:border-slate-500 text-slate-100 px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-sm"
        >
          <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{selectedTownship.name}</span>
          <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
        </button>

        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-2 w-56 bg-[#161d2a] border border-[#26334a] rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
              Select Township Area
            </div>
            {TOWNSHIPS.map((town) => (
              <button
                key={town.id}
                onClick={() => {
                  onSelectTownship(town);
                  setDropdownOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2 text-sm flex items-center justify-between transition-colors ${
                  selectedTownship.id === town.id
                    ? 'bg-emerald-950/60 text-emerald-300 font-semibold'
                    : 'text-slate-300 hover:bg-[#1f283a]'
                }`}
              >
                <span>{town.name}</span>
                {selectedTownship.id === town.id && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Global Search Bar */}
      <div className="flex-1 max-w-xl mx-2">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search for products or shops..."
            className="w-full bg-[#181f2b] border border-[#242e42] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 text-sm text-slate-100 placeholder-slate-400 pl-11 pr-4 py-2.5 rounded-full outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3.5 text-slate-400 hover:text-slate-200 text-xs bg-slate-800 rounded-full w-5 h-5 flex items-center justify-center"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Right Action Icons: Live Testnet + Bell + User Avatar */}
      <div className="flex items-center gap-2.5">
        {/* Live Open Payments Testnet Pill */}
        <button
          onClick={onOpenLiveTestnet}
          className="hidden sm:flex items-center gap-2 bg-[#0e192c] hover:bg-[#152542] border border-cyan-500/35 text-cyan-300 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm cursor-pointer hover:border-cyan-400 group"
          title="Open Live Interledger Testnet Console ($ilp.interledger-test.dev/2f0b6b2c)"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-[11px] group-hover:text-white">$ilp.testnet</span>
        </button>

        {/* Notification Bell */}
        <button
          onClick={onOpenNotifications}
          className="relative p-2.5 rounded-full hover:bg-[#1a2230] text-slate-300 hover:text-white transition-colors"
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
            2
          </span>
        </button>

        {/* User Profile Avatar */}
        <button
          onClick={onOpenCustomerModal}
          className="w-10 h-10 rounded-full bg-[#581c87] hover:bg-[#6b21a8] text-white font-bold flex items-center justify-center text-sm shadow-md transition-all border border-purple-400/30 hover:scale-105"
          title={`Active: @${currentCustomer.username} (Click to Switch/Wallet)`}
        >
          {currentCustomer.name ? currentCustomer.name.charAt(0).toUpperCase() : 'A'}
        </button>
      </div>
    </header>
  );
}

