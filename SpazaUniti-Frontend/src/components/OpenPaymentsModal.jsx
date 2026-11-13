import React, { useState } from 'react';
import { 
  CreditCard, 
  ShieldCheck, 
  Smartphone, 
  Lock, 
  CheckCircle2, 
  X, 
  ArrowRight,
  AlertCircle 
} from 'lucide-react';
import { approveGrantOptionA, verifyGrantOptionBPin } from '../services/api';

export default function OpenPaymentsModal({
  isOpen,
  onClose,
  grantData,
  onPaymentSuccess,
  currentCustomer
}) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [receipt, setReceipt] = useState(null);

  if (!isOpen || !grantData) return null;

  const handleApproveOptionA = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const result = await approveGrantOptionA(grantData.grantId);
      setReceipt({
        ...result,
        method: 'Option A (Interactive Push Link)'
      });
      onPaymentSuccess(result);
    } catch (err) {
      setErrorMsg(err.message || 'Option A approval failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOptionBPin = async (e) => {
    e.preventDefault();
    if (!pin || pin.length !== 4) {
      setErrorMsg('Please enter a 4-digit PIN.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const result = await verifyGrantOptionBPin(grantData.grantId, pin);
      setReceipt({
        ...result,
        method: 'Option B (Counter Security PIN)'
      });
      onPaymentSuccess(result);
    } catch (err) {
      setErrorMsg(err.message || 'Incorrect 4-digit security PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    setReceipt(null);
    setPin('');
    setErrorMsg('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#141b27] border border-[#232f44] rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-[#1f293d] flex items-center justify-between bg-[#111722]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {receipt ? 'Payment Confirmed' : 'Authorize OpenPayment'}
              </h3>
              <p className="text-xs text-slate-400">
                Two-Tier Interledger Protocol (ILP) Consent
              </p>
            </div>
          </div>
          <button
            onClick={receipt ? handleDone : onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {receipt ? (
            /* Success Receipt View */
            <div className="text-center py-2">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h4 className="text-xl font-black text-white">
                R{receipt.amount.toFixed(2)} Paid Successfully!
              </h4>
              <p className="text-xs text-slate-400 mt-1 mb-5">
                Settled to {receipt.merchant_name || 'Spaza Store'} via Open Payments
              </p>

              {/* Bill Details */}
              <div className="bg-[#182130] border border-[#25334a] rounded-2xl p-4 text-left space-y-2.5 text-xs text-slate-300 mb-6">
                <div className="flex justify-between">
                  <span className="text-slate-400">Debited From:</span>
                  <span className="font-bold text-white">@{currentCustomer.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Recipient Store:</span>
                  <span className="font-bold text-white">{receipt.merchant_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Authorization Method:</span>
                  <span className="text-emerald-400 font-semibold">{receipt.method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Interledger Network:</span>
                  <span className="font-mono text-cyan-300 text-[11px]">$ilp.interledger-test.dev</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#232f44]">
                  <span className="text-slate-400">New Wallet Balance:</span>
                  <span className="font-black text-white text-sm">
                    R{(receipt.new_balance ?? receipt.new_wallet_balance ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                onClick={handleDone}
                className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
              >
                Done & Return to Marketplace
              </button>
            </div>
          ) : (
            /* Two-Tier Authorization Options */
            <div className="space-y-5">
              {/* Order Summary Strip */}
              <div className="bg-[#182130] border border-[#25334a] rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 uppercase font-semibold">Total Amount</span>
                  <div className="text-2xl font-black text-white">R{grantData.amount.toFixed(2)}</div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 font-semibold">Recipient</span>
                  <div className="text-sm font-bold text-emerald-400">{grantData.storeName}</div>
                </div>
              </div>

              {errorMsg && (
                <div className="bg-red-950/40 border border-red-500/40 text-red-300 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Option A: Push / SMS Link */}
              <div className="bg-[#182130] border border-[#25334a] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    <Smartphone className="w-4 h-4" />
                    <span>Option A: Primary Consent</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Interactive Push</span>
                </div>
                <p className="text-xs text-slate-300 mb-3.5">
                  Approve the payment directly through simulated mobile smartphone authorization.
                </p>
                <button
                  onClick={handleApproveOptionA}
                  disabled={loading}
                  className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve via Smartphone Prompt</span>
                </button>
              </div>

              <div className="flex items-center gap-3 text-center text-xs text-slate-500 font-bold uppercase tracking-wider">
                <div className="flex-1 h-px bg-[#232f44]"></div>
                <span>Or If Network Delayed</span>
                <div className="flex-1 h-px bg-[#232f44]"></div>
              </div>

              {/* Option B: Counter 4-Digit Security PIN */}
              <div className="bg-[#182130] border border-[#25334a] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <Lock className="w-4 h-4" />
                    <span>Option B: Counter PIN Fallback</span>
                  </div>
                  <span className="text-[11px] text-slate-400">4-Digit PIN</span>
                </div>
                <p className="text-xs text-slate-300 mb-3">
                  If SMS is delayed by network latency, enter customer's 4-digit PIN directly at counter:
                </p>
                <form onSubmit={handleVerifyOptionBPin} className="flex gap-2.5">
                  <input
                    type="password"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-28 bg-[#101622] border border-[#26334a] focus:border-amber-400 rounded-xl px-3 py-2 text-center text-lg font-mono tracking-widest text-white outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loading || pin.length !== 4}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>Authorize with PIN</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

