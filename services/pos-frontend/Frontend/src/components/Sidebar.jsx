import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Coins, 
  Sparkles,
  Radio
} from 'lucide-react';
import logoImg from '../assets/logo.jpeg';

export default function Sidebar({ activePage, setActivePage, broadcastActive }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'creditTabs', label: 'Credit Tabs', icon: FileText },
    { id: 'repayments', label: 'Repayments', icon: Coins },
    { id: 'offerings', label: 'Spaza Uniti Offerings', icon: Sparkles },
  ];

  return (
    <aside className="w-64 bg-[#142318] text-white flex flex-col justify-between p-4 shrink-0 min-h-screen border-r border-[#1e3424]">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 p-2 mb-6 border-b border-[#223d29] pb-4">
          <img 
            src={logoImg} 
            alt="SpazaKhokha logo" 
            className="w-12 h-12 rounded-xl object-cover border border-emerald-600/30 shadow-md"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-white">Unit #104</span>
            </div>
            <p className="text-xs text-emerald-400 font-medium">Spaza Uniti Node</p>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold mt-1 px-2 py-0.5 rounded-full ${
              broadcastActive ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/50' : 'bg-slate-800 text-slate-400'
            }`}>
              <Radio className="w-2.5 h-2.5 animate-pulse" />
              {broadcastActive ? 'Live on Uniti' : 'Broadcast Paused'}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left cursor-pointer ${
                  isActive
                    ? 'bg-emerald-700/80 text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-[#1d3323] hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-emerald-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Open Payments Wallet Footer */}
      <div className="space-y-3">
        <div className="bg-[#1b2f21] p-3 rounded-xl border border-[#274630]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 block mb-1">
            Open Payments Address
          </span>
          <code className="text-xs text-emerald-200 font-mono break-all block bg-[#132218] p-1.5 rounded border border-[#233f2c]">
            $ilp.rafiki.money/unit-104
          </code>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Interledger Enabled
          </span>
        </div>

        <p className="text-[11px] text-slate-400 text-center leading-tight">
          SpazaKhokha x Spaza Uniti<br />
          <span className="text-[10px] text-slate-500">Agentic Commerce for Township Economy</span>
        </p>
      </div>
    </aside>
  );
}
