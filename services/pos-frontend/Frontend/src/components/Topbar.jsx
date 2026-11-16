import React from 'react';
import { Bot, UserPlus, Sparkles } from 'lucide-react';
import { Button } from './ui/button';

export default function Topbar({ 
  pageTitle, 
  onOpenAgentModal, 
  onOpenAddCustomer 
}) {
  return (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 mb-6 border-b border-slate-200">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
          SPAZA UNITI NODE #104 / MEADOWLANDS
        </p>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
          {pageTitle}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Welcome back, Baba Zola. Your AI Agent is active and managing your Unit.
        </p>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <Button 
          variant="outline" 
          onClick={onOpenAgentModal}
          className="border-emerald-600/40 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 gap-2"
        >
          <Bot className="w-4 h-4 text-emerald-700" />
          <span>AI Co-Pilot</span>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
          </span>
        </Button>

        <Button 
          onClick={onOpenAddCustomer}
          className="bg-emerald-700 hover:bg-emerald-800 text-white gap-2"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Add Customer</span>
        </Button>
      </div>
    </header>
  );
}
