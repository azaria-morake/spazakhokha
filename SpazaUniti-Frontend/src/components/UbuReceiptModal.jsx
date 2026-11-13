import React from 'react';
import { ShieldCheck, CheckCircle2, Coins, ArrowRight, X, Sparkles, Store, Wallet } from 'lucide-react';

export default function UbuReceiptModal({
  isOpen,
  onClose,
  receipt
}) {
  if (!isOpen || !receipt) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#121824] border border-[#233149] rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-b from-[#182337] to-[#121824] border-b border-[#212c42] text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#00A2E8]/20 border border-[#00A2E8]/40 flex items-center justify-center text-[#38C3FF] shadow-lg shadow-[#00A2E8]/20">
            <Coins className="w-7 h-7" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-bold text-emerald-400 mb-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> UBU Payment Confirmed
          </span>

          <h3 className="text-3xl font-black text-white tracking-tight tabular-nums">
            {Number(receipt.amountUbu || 0).toFixed(2)}{' '}
            <span className="text-lg font-bold text-[#38C3FF]">UBU</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
            <Store className="w-3.5 h-3.5 text-slate-400" />
            <span>Paid to {receipt.unitName}</span>
          </p>
        </div>

        {/* Receipt Body */}
        <div className="p-6 space-y-4">
          <div className="bg-[#162030] border border-[#223048] rounded-2xl p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Payment Rail</span>
              <span className="font-bold text-[#38C3FF] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> UbuOne Community Ledger
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Transaction Fee</span>
              <span className="font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[11px]">
                R0.00 (Zero Fee)
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Debited Bucket</span>
              <span className="font-semibold text-white">
                {receipt.sourceBucket === 'FAMILY_POOL' ? 'Family Vault Allowance' : 'Spendable UBU Wallet'}
              </span>
            </div>

            <div className="border-t border-white/5 pt-2 flex items-center justify-between text-slate-300">
              <span className="text-slate-400">New Spendable UBU</span>
              <span className="font-bold text-white tabular-nums">
                {Number(receipt.newUbuBalance || 0).toFixed(2)} UBU
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Bank / OP Reserve</span>
              <span className="font-medium text-slate-400 tabular-nums">
                R{Number(receipt.newZarBalance || 0).toFixed(2)} (Untouched)
              </span>
            </div>
          </div>

          {/* Cashback Reward Banner */}
          {receipt.rewardEarned > 0 && (
            <div className="bg-[#10241b] border border-[#1b3d2d] rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <strong className="text-emerald-300 block">
                  +{Number(receipt.rewardEarned).toFixed(2)} UBU Loyalty Cashback!
                </strong>
                <span className="text-slate-400 text-[11px]">
                  Earned automatically towards your R20 taxi fare goal.
                </span>
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full bg-[#00A2E8] hover:bg-[#008fcb] text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-lg shadow-[#00A2E8]/20 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

