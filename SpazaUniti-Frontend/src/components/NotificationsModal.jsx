import React from 'react';
import { Bell, Tag, Star, X } from 'lucide-react';

export default function NotificationsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const notifications = [
    {
      id: 1,
      icon: Tag,
      iconColor: 'text-emerald-400 bg-emerald-950/60',
      title: 'Weekend Special Live!',
      message: 'Mama Zola Spaza (Unit #104) published 18% OFF Albany Superior White Bread.',
      time: '10m ago'
    },
    {
      id: 2,
      icon: Star,
      iconColor: 'text-amber-400 bg-amber-950/60',
      title: 'Loyalty Points Earned',
      message: 'You earned 10 loyalty points for settling your grocery tab at Fresh Foods.',
      time: '1h ago'
    }
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#141b27] border border-[#232f44] rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="p-4 border-b border-[#1f293d] flex items-center justify-between bg-[#111722]">
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Notifications (2)</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {notifications.map((n) => {
            const Icon = n.icon;
            return (
              <div
                key={n.id}
                className="bg-[#182130] border border-[#25334a] rounded-xl p-3 flex gap-3 items-start"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${n.iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-white">{n.title}</h5>
                    <span className="text-[10px] text-slate-500">{n.time}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                    {n.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

