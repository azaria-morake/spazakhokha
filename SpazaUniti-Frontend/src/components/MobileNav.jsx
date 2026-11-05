import React from 'react';
import { Home, Compass, Trophy, FileText, MoreHorizontal } from 'lucide-react';

export default function MobileNav({ activeNav, setActiveNav }) {
  const items = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'shops', label: 'Discover', icon: Compass },
    { id: 'rewards', label: 'Rewards', icon: Trophy },
    { id: 'orders', label: 'Orders', icon: FileText },
    { id: 'more', label: 'More', icon: MoreHorizontal },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[#0d1117] border-t border-[#1e2638] flex items-center justify-around py-2.5 z-40 select-none">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeNav === item.id;

        return (
          <button
            key={item.id}
            onClick={() => setActiveNav(item.id)}
            className={`flex flex-col items-center gap-1 py-1 px-3 transition-colors ${
              isActive ? 'text-[#22c55e]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-semibold">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

