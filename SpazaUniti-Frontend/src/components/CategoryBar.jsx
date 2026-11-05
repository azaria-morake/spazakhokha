import React from 'react';
import { 
  ShoppingCart, 
  Apple, 
  Package, 
  Smartphone, 
  Utensils, 
  MoreHorizontal 
} from 'lucide-react';

export default function CategoryBar({ activeCategory, onSelectCategory }) {
  const categories = [
    { 
      id: 'groceries', 
      label: 'Groceries', 
      icon: ShoppingCart, 
      iconColor: 'text-sky-400',
      bgColor: 'hover:border-sky-500/40' 
    },
    { 
      id: 'fresh-produce', 
      label: 'Fresh Produce', 
      icon: Apple, 
      iconColor: 'text-red-400',
      bgColor: 'hover:border-red-500/40' 
    },
    { 
      id: 'household', 
      label: 'Household', 
      icon: Package, 
      iconColor: 'text-cyan-400',
      bgColor: 'hover:border-cyan-500/40' 
    },
    { 
      id: 'airtime-data', 
      label: 'Airtime & Data', 
      icon: Smartphone, 
      iconColor: 'text-emerald-400',
      bgColor: 'hover:border-emerald-500/40' 
    },
    { 
      id: 'food-drinks', 
      label: 'Food & Drinks', 
      icon: Utensils, 
      iconColor: 'text-slate-200',
      bgColor: 'hover:border-slate-400/40' 
    },
    { 
      id: 'more', 
      label: 'More', 
      icon: MoreHorizontal, 
      iconColor: 'text-slate-300',
      bgColor: 'hover:border-slate-400/40' 
    },
  ];

  return (
    <div className="grid grid-cols-6 gap-3.5 my-6">
      {categories.map((cat) => {
        const Icon = cat.icon;
        const isSelected = activeCategory === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(isSelected ? 'all' : cat.id)}
            className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-150 text-center group cursor-pointer ${
              isSelected
                ? 'bg-[#1a2233] border-emerald-500 shadow-lg shadow-emerald-950/30'
                : 'bg-[#151b26] border-[#222b3d] hover:bg-[#1b2332]'
            }`}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 transition-transform group-hover:scale-110">
              <Icon className={`w-7 h-7 ${cat.iconColor}`} />
            </div>
            <span className="text-xs font-semibold text-slate-200 line-clamp-1">
              {cat.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

