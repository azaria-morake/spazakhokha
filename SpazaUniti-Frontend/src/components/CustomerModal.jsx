import React, { useState } from 'react';
import { 
  User, 
  Wallet, 
  CreditCard, 
  ArrowUpRight, 
  ShieldCheck, 
  X, 
  Check, 
  AlertCircle,
  Coins,
  Bus,
  Sparkles
} from 'lucide-react';
import { DEMO_CUSTOMERS } from '../data/mockData';
import { checkUsernameAvailability, registerCustomer, topUpWallet, cashoutUbuntuTokens } from '../services/api';

export default function CustomerModal({
  isOpen,
  onClose,
  currentCustomer,
  onSelectCustomer,
  onRefreshCustomer
}) {
  const [activeTab, setActiveTab] = useState('profile');
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPin, setRegPin] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [topUpAmount, setTopUpAmount] = useState('100.00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cashoutMsg, setCashoutMsg] = useState(null);

  if (!isOpen) return null;

  const totalTokens = currentCustomer.total_ubuntu_tokens ?? 
    (currentCustomer.ubuntu_tokens ? Object.values(currentCustomer.ubuntu_tokens).reduce((a, b) => a + b, 0) : 24.0);
  const unit104Tokens = currentCustomer.ubuntu_tokens?.["unit-104"] ?? 24.0;
  const isCashoutEligible = totalTokens >= 20.0 || unit104Tokens >= 20.0;

  const handleCashoutSubmit = async () => {
    setIsSubmitting(true);
    setCashoutMsg(null);
    try {
      const res = await cashoutUbuntuTokens(currentCustomer.username, "unit-104", 20.0, "Taxi Fare to Job Interview");
      setCashoutMsg(res.receipt_message || "R20.00 cashed out to spendable wallet!");
      await onRefreshCustomer();
    } catch (err) {
      alert("Cash-out error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUsernameChange = async (e) => {
    const val = e.target.value.trim();
    setRegUsername(val);

    const regex = /^[a-zA-Z0-9]{3,20}$/;
    if (!regex.test(val)) {
      setFeedback({
        valid: false,
        msg: 'Must be 3-20 strictly alphanumeric characters (no spaces, dashes, or symbols).'
      });
      return;
    }

    setFeedback({ valid: true, msg: 'Checking handle availability...' });
    const check = await checkUsernameAvailability(val);
    if (check.available) {
      setFeedback({ valid: true, msg: `✓ Universal handle @${val} is available!` });
    } else {
      setFeedback({ valid: false, msg: `✗ Handle @${val} is already taken.` });
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regUsername || !regPin || regPin.length !== 4) return;

    setIsSubmitting(true);
    try {
      const result = await registerCustomer({
        name: regName.trim(),
        username: regUsername.trim(),
        pin: regPin.trim(),
        initial_deposit: 100.00
      });
      onSelectCustomer({
        username: result.username,
        name: result.name || result.full_name,
        avatar: result.username.charAt(0).toUpperCase(),
        balance: result.balance || 100.00,
        points: 50,
        stamps: 0,
        open_payments_id: `$spazauniti.org/${result.username}`
      });
      onClose();
    } catch (err) {
      setFeedback({ valid: false, msg: err.message || 'Registration failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTopUpSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(topUpAmount);
    if (isNaN(amt) || amt <= 0) return;

    setIsSubmitting(true);
    try {
      await topUpWallet(currentCustomer.username, amt, "Card/EFT Top Up");
      await onRefreshCustomer();
      alert(`R${amt.toFixed(2)} credited to @${currentCustomer.username} wallet!`);
    } catch (err) {
      alert("Top up error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#141b27] border border-[#232f44] rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-[#1f293d] flex items-center justify-between bg-[#111722]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-900 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold">
              {currentCustomer.name ? currentCustomer.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                @{currentCustomer.username}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {currentCustomer.open_payments_id || `$spazauniti.org/${currentCustomer.username}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-[#1e273a] bg-[#111722] text-xs font-bold">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Wallet & Balance
          </button>
          <button
            onClick={() => setActiveTab('switch')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors ${
              activeTab === 'switch'
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Switch Customer
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors ${
              activeTab === 'register'
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            + New Handle
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="bg-[#182130] border border-[#25334a] rounded-2xl p-5 text-center">
                <span className="text-xs text-slate-400 font-semibold uppercase">Open Payments Balance</span>
                <div className="text-3xl font-black text-emerald-400 mt-1 mb-2">
                  R{Number(currentCustomer.balance || 0).toFixed(2)}
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>RFC Open Payments Compatible (ZAR)</span>
                </div>
              </div>

              {/* Ubuntu Tokens Ledger */}
              <div className="bg-[#182130] border border-[#25334a] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Ubuntu Tokens</span>
                  </div>
                  <span className="text-xs font-black text-amber-400">
                    {Number(totalTokens).toFixed(2)} UBU
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-[#101622] p-2.5 rounded-xl text-xs border border-[#222e42]">
                    <div>
                      <strong className="text-slate-200 block">Khumalo Spaza Store</strong>
                      <span className="text-slate-500 font-mono text-[10px]">Unit #104 (1 UBU = R1.00)</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-400">{Number(unit104Tokens).toFixed(2)} UBU</span>
                  </div>
                </div>

                {/* R20 Taxi / Transport Cash-Out Feature */}
                <div className="mt-4 pt-3 border-t border-[#222e42]">
                  <div className="flex items-start gap-2 mb-2.5">
                    <Bus className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-xs font-bold text-white">R20 Taxi & Transport Allowance</h5>
                      <p className="text-[11px] text-slate-400">
                        {isCashoutEligible
                          ? "You have >= 20 UBU! Cash out R20.00 directly to spendable cash for taxi fare or airtime."
                          : "Reach 20.00 UBU to unlock open-ramp taxi fare cash-out."}
                      </p>
                    </div>
                  </div>

                  {cashoutMsg && (
                    <div className="mb-2 p-2 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-300">
                      {cashoutMsg}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!isCashoutEligible || isSubmitting}
                    onClick={handleCashoutSubmit}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      isCashoutEligible
                        ? "bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 text-white shadow-lg cursor-pointer"
                        : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Cash Out R20 Taxi Fare (Open Payments)</span>
                  </button>
                </div>
              </div>

              {/* Top Up Form */}
              <form onSubmit={handleTopUpSubmit} className="bg-[#182130] border border-[#25334a] rounded-2xl p-4">
                <span className="text-xs font-bold text-white block mb-2">+ Top Up Wallet</span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="10"
                    min="10"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    className="flex-1 bg-[#101622] border border-[#26334a] rounded-xl px-3 py-2 text-sm text-white font-bold outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
                  >
                    Receive Funds
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'switch' && (
            <div className="space-y-2.5">
              <span className="text-xs text-slate-400 block mb-2">Select a customer profile:</span>
              {DEMO_CUSTOMERS.map((cust) => {
                const isSelected = cust.username === currentCustomer.username;
                return (
                  <button
                    key={cust.username}
                    onClick={() => {
                      onSelectCustomer(cust);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-500 text-white'
                        : 'bg-[#182130] border-[#25334a] text-slate-300 hover:bg-[#1d273a]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs">
                        {cust.avatar}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{cust.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">@{cust.username}</div>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-emerald-400">
                      R{cust.balance.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Kagiso Khumalo"
                  className="w-full bg-[#101622] border border-[#26334a] rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">
                  Universal Username (Alphanumeric only)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-slate-500 text-xs font-mono font-bold">@</span>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={handleUsernameChange}
                    placeholder="kagiso99"
                    className="w-full bg-[#101622] border border-[#26334a] rounded-xl pl-7 pr-3.5 py-2 text-xs text-white font-mono outline-none"
                  />
                </div>
                {feedback && (
                  <span className={`text-[11px] block mt-1 ${feedback.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                    {feedback.msg}
                  </span>
                )}
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">
                  4-Digit Security PIN (for counter checkout)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={regPin}
                  onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-28 bg-[#101622] border border-[#26334a] rounded-xl px-3 py-2 text-xs text-white font-mono tracking-widest outline-none text-center"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !feedback?.valid || regPin.length !== 4}
                className="w-full bg-[#16a34a] hover:bg-[#15803d] disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md mt-4 cursor-pointer"
              >
                Create Open Payments Handle
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}

