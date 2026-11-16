import React from 'react';
import { 
  Home, 
  Store, 
  Star, 
  FileText, 
  User, 
  Settings 
} from 'lucide-react';

export default function Sidebar({ activeNav, setActiveNav, onOpenCustomerModal }) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'shops', label: 'Nearby Shops', icon: Store },
    { id: 'rewards', label: 'My Rewards', icon: Star },
    { id: 'orders', label: 'My Orders', icon: FileText },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#0d1117] border-r border-[#1e2638] flex flex-col justify-between p-5 min-h-screen shrink-0 select-none">
      <div>
        {/* Brand Logo */}
        <div className="mb-8 cursor-pointer" onClick={() => setActiveNav('home')}>
          <div className="flex items-center gap-3">
            {/* Store Awning Canopy SVG Icon */}
            <div className="w-12 h-11 bg-transparent flex items-center justify-center">
              <svg viewBox="0 0 48 42" className="w-11 h-11" fill="none">
                {/* Store Roof Awning */}
                <path d="M4 18L7 6C7.5 4 9 3 11 3H37C39 3 40.5 4 41 6L44 18" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 18C4 21 6.5 23 9.5 23C12.5 23 15 21 15 18C15 21 17.5 23 20.5 23C23.5 23 26 21 26 18C26 21 28.5 23 31.5 23C34.5 23 37 21 37 18C37 21 39.5 23 42.5 23C44 23 44 21.5 44 18" fill="#16a34a" />
                {/* Striped canopy segments */}
                <path d="M12 4L14 18" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M24 3L24 18" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M36 4L34 18" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                {/* Store Base & Door */}
                <path d="M7 23V36C7 38 8.5 39 10 39H38C39.5 39 41 38 41 36V23" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="18" y="27" width="12" height="12" rx="1.5" stroke="#16a34a" strokeWidth="2.5" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight leading-none">
                Spaza<br />Uniti
              </h1>
            </div>
          </div>
          {/* Cursive Tagline */}
          <div className="font-script text-[#22c55e] text-2xl font-bold ml-1 mt-1 -rotate-3 select-none">
            Kasi Is Real
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'profile') {
                    onOpenCustomerModal();
                  } else {
                    setActiveNav(item.id);
                  }
                }}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-[#15803d] text-white shadow-lg shadow-emerald-950/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#161c28]'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Card: Support Local. Shop Smart. */}
      <div className="bg-[#141a24] border border-[#20293a] rounded-2xl p-4 relative overflow-hidden mt-6">
        {/* Hillbrow Tower & Township Skyline Outline Illustration */}
        <div className="h-20 w-full mb-3 flex items-end justify-center opacity-70">
          <svg viewBox="0 0 160 70" className="w-full h-full" fill="none" stroke="#64748b" strokeWidth="1.8">
            {/* Small houses */}
            <path d="M4 65H18V50L25 45L32 50V65H50" />
            <path d="M22 54H28V60H22V54Z" />
            {/* Middle building */}
            <path d="M50 65V38H72V65" />
            <path d="M56 44H66" />
            <path d="M56 50H66" />
            <path d="M56 56H66" />
            {/* Hillbrow / Telkom Tower iconic shape */}
            <path d="M86 65V24H82L87 18V4H89V18L94 24H90V65" stroke="#94a3b8" strokeWidth="2" />
            <circle cx="88" cy="18" r="4.5" stroke="#94a3b8" strokeWidth="1.5" />
            {/* Right city buildings */}
            <path d="M98 65V32H118V65" />
            <path d="M122 65V44H138V65" />
            <path d="M142 65V52L150 48L158 52V65" />
          </svg>
        </div>

        <div className="text-center">
          <p className="text-white font-bold text-sm leading-snug">
            Support Local.<br />Shop Smart.
          </p>
          {/* Green brush underline */}
          <div className="w-16 h-1 bg-[#22c55e] rounded-full mx-auto mt-2"></div>
        </div>
      </div>
    </aside>
  );
}

