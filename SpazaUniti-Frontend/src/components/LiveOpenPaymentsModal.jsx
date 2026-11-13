import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  ExternalLink, 
  CheckCircle2, 
  ArrowRight, 
  RefreshCw, 
  Zap, 
  Coins, 
  CreditCard, 
  Key, 
  Globe, 
  Copy, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import { 
  fetchLiveOpStatus, 
  createLiveIncomingPayment, 
  initiateLiveTopUp, 
  completeLiveTopUp, 
  cashoutLiveTestnet 
} from '../services/api';

export default function LiveOpenPaymentsModal({ isOpen, onClose, currentCustomer, onRefreshCustomer }) {
  const [activeTab, setActiveTab] = useState('incoming'); // 'incoming', 'topup', 'cashout'
  const [statusData, setStatusData] = useState(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  
  // Action states
  const [incomingAmount, setIncomingAmount] = useState('38.00');
  const [incomingDesc, setIncomingDesc] = useState('Spaza Uniti Magwinya Order');
  const [incomingResult, setIncomingResult] = useState(null);
  const [isCreatingIncoming, setIsCreatingIncoming] = useState(false);

  const [topupAmount, setTopupAmount] = useState('50.00');
  const [topupResult, setTopupResult] = useState(null);
  const [isInitiatingTopup, setIsInitiatingTopup] = useState(false);
  const [isCompletingTopup, setIsCompletingTopup] = useState(false);

  const [cashoutResult, setCashoutResult] = useState(null);
  const [isCashingOut, setIsCashingOut] = useState(false);
  
  const [copiedKey, setCopiedKey] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  const loadStatus = async () => {
    setIsLoadingStatus(true);
    setErrorMsg(null);
    try {
      const data = await fetchLiveOpStatus();
      setStatusData(data);
    } catch (err) {
      setErrorMsg("Failed to connect to backend: " + err.message);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateIncoming = async (e) => {
    e.preventDefault();
    setIsCreatingIncoming(true);
    setErrorMsg(null);
    setIncomingResult(null);
    try {
      const cents = Math.round(parseFloat(incomingAmount) * 100);
      const res = await createLiveIncomingPayment(cents, incomingDesc);
      setIncomingResult(res);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsCreatingIncoming(false);
    }
  };

  const handleInitiateTopup = async () => {
    setIsInitiatingTopup(true);
    setErrorMsg(null);
    setTopupResult(null);
    try {
      const cents = Math.round(parseFloat(topupAmount) * 100);
      const username = currentCustomer?.username || 'mannini';
      const res = await initiateLiveTopUp(username, cents);
      setTopupResult(res);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsInitiatingTopup(false);
    }
  };

  const handleCompleteTopup = async () => {
    if (!topupResult) return;
    setIsCompletingTopup(true);
    setErrorMsg(null);
    try {
      const username = currentCustomer?.username || 'mannini';
      await completeLiveTopUp(username, topupResult.amount_cents);
      if (onRefreshCustomer) await onRefreshCustomer();
      setTopupResult(prev => ({ ...prev, confirmed: true }));
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsCompletingTopup(false);
    }
  };

  const handleCashout = async () => {
    setIsCashingOut(true);
    setErrorMsg(null);
    setCashoutResult(null);
    try {
      const username = currentCustomer?.username || 'mannini';
      const res = await cashoutLiveTestnet(username, 20.0, "Taxi Fare Cash-Out via Interledger Testnet");
      setCashoutResult(res);
      if (onRefreshCustomer) await onRefreshCustomer();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsCashingOut(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0f172a] border border-cyan-500/30 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl shadow-cyan-950/50 overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-[#0d1627] to-[#121d33]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Live Open Payments Testnet</h2>
                <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Rafiki Testnet Live
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cryptographically verified via RFC 9421 HTTP Message Signatures &amp; GNAP
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Credentials & Network Verification Bar */}
        <div className="px-5 py-3.5 bg-[#0a101d] border-b border-white/5 text-xs text-slate-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center justify-between bg-white/5 px-3 py-2 rounded-xl border border-white/5">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Payment Pointer</span>
                <span className="font-mono font-semibold text-cyan-300">$ilp.interledger-test.dev/2f0b6b2c</span>
              </div>
              <button 
                onClick={() => copyToClipboard("$ilp.interledger-test.dev/2f0b6b2c", 'pointer')}
                className="text-slate-400 hover:text-white p-1"
                title="Copy pointer"
              >
                {copiedKey === 'pointer' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center justify-between bg-white/5 px-3 py-2 rounded-xl border border-white/5">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Ed25519 Key ID</span>
                <span className="font-mono text-[11px] text-slate-300">d644f013...4cb5a0e</span>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                <ShieldCheck className="w-3 h-3" /> JWKS Active
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 px-5 pt-3 gap-2 bg-[#0d1627]">
          <button
            onClick={() => setActiveTab('incoming')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'incoming'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            1. Live Incoming Payment
          </button>

          <button
            onClick={() => setActiveTab('topup')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'topup'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            2. On-Ramp UBU Top-Up (Consent Link)
          </button>

          <button
            onClick={() => setActiveTab('cashout')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'cashout'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            3. Off-Ramp Taxi Cash-Out
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: Live Incoming Payment */}
          {activeTab === 'incoming' && (
            <div className="space-y-4">
              <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Create Live Testnet Incoming Payment</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Generates an authorized incoming payment resource directly on Rafiki (<code className="text-cyan-300">https://ilp.interledger-test.dev</code>) using your registered Ed25519 key signature.
                </p>

                <form onSubmit={handleCreateIncoming} className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">Amount (EUR / ZAR equivalent)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">R / €</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={incomingAmount}
                          onChange={(e) => setIncomingAmount(e.target.value)}
                          className="w-full bg-[#162032] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">Description / Order Note</label>
                      <input
                        type="text"
                        value={incomingDesc}
                        onChange={(e) => setIncomingDesc(e.target.value)}
                        className="w-full bg-[#162032] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isCreatingIncoming}
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                  >
                    {isCreatingIncoming ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Signing RFC 9421 &amp; Creating Resource...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        <span>Create Live Interledger Payment (HTTP 201)</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Incoming Payment Result Box */}
              {incomingResult && (
                <div className="bg-[#0b121e] border border-emerald-500/40 rounded-2xl p-4 space-y-2.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Live Interledger Payment Created (HTTP 201)
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {incomingResult.createdAt ? new Date(incomingResult.createdAt).toLocaleTimeString() : 'Just now'}
                    </span>
                  </div>

                  <div className="space-y-1.5 font-mono text-xs">
                    <div className="bg-white/5 p-2 rounded-lg break-all">
                      <span className="text-[10px] text-slate-400 block font-sans uppercase">Payment Resource URI:</span>
                      <a 
                        href={incomingResult.id} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-cyan-300 hover:underline flex items-center gap-1"
                      >
                        {incomingResult.id}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>

                    {incomingResult.ilp_address && (
                      <div className="bg-white/5 p-2 rounded-lg break-all">
                        <span className="text-[10px] text-slate-400 block font-sans uppercase">Live ILP Stream Packet Address:</span>
                        <span className="text-emerald-300 text-[11px]">{incomingResult.ilp_address}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: On-Ramp UBU Top-Up */}
          {activeTab === 'topup' && (
            <div className="space-y-4">
              <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Interactive GNAP Outgoing Grant Consent</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Initiate a real GNAP authorization flow on <code className="text-cyan-300">auth.interledger-test.dev</code> to transfer funds from the test wallet into the consumer's Uniti-wide Spendable UBU pool (1 UBU = 1 ZAR).
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <div className="flex-1">
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">Top-Up Amount (UBU)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">UBU</span>
                      <input
                        type="number"
                        step="1"
                        min="5"
                        value={topupAmount}
                        onChange={(e) => setTopupAmount(e.target.value)}
                        className="w-full bg-[#162032] border border-white/10 rounded-xl pl-12 pr-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleInitiateTopup}
                    disabled={isInitiatingTopup}
                    className="self-end bg-[#00A2E8] hover:bg-[#008fcb] disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 text-xs shadow-lg shadow-[#00A2E8]/20 transition-all cursor-pointer"
                  >
                    {isInitiatingTopup ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    <span>Request Grant Redirect URL</span>
                  </button>
                </div>
              </div>

              {/* Top-up interactive grant result */}
              {topupResult && (
                <div className="bg-[#0b121e] border border-cyan-500/40 rounded-2xl p-4 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-cyan-400" />
                      Live Rafiki Consent Screen Ready
                    </span>
                    <span className="text-[11px] text-slate-400 font-bold">
                      {topupResult.amount_cents / 100} UBU
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    Click below to open the official Interledger Testnet consent interface where you can approve the grant:
                  </p>

                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <a
                      href={topupResult.interact_url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full sm:flex-1 bg-white/10 hover:bg-white/15 text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs border border-white/10 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Open Consent Screen (auth.interledger-test.dev)</span>
                    </a>

                    <button
                      onClick={handleCompleteTopup}
                      disabled={isCompletingTopup || topupResult.confirmed}
                      className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:text-slate-300 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors cursor-pointer"
                    >
                      {isCompletingTopup ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>{topupResult.confirmed ? "Pool Credited!" : "Confirm & Credit UBU Pool"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Off-Ramp Taxi Fare Cash-Out */}
          {activeTab === 'cashout' && (
            <div className="space-y-4">
              <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Off-Ramp Taxi Allowance to Interledger Testnet</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Instantly cash out <strong className="text-white">R20.00 (20.00 UBU)</strong> of loyalty cashback or spendable UBU to the testnet wallet address <code className="text-cyan-300">$ilp.interledger-test.dev/2f0b6b2c</code> via a real incoming payment stream.
                </p>

                <div className="p-3 bg-purple-950/30 border border-purple-500/20 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-purple-300 font-bold block">Available UBU &amp; Cashback</span>
                    <span className="text-slate-400 text-[11px]">Mannini Customer Account</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-white">{Number(currentCustomer?.ubu_balance || 0).toFixed(2)} UBU</span>
                  </div>
                </div>

                <button
                  onClick={handleCashout}
                  disabled={isCashingOut}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
                >
                  {isCashingOut ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Transmitting via Interledger Testnet...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Cash Out R20 Taxi Fare to $ilp.interledger-test.dev/2f0b6b2c</span>
                    </>
                  )}
                </button>
              </div>

              {/* Cashout Result Box */}
              {cashoutResult && (
                <div className="bg-[#0b121e] border border-purple-500/40 rounded-2xl p-4 space-y-2.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                      <CheckCircle2 className="w-4 h-4 text-purple-400" />
                      R20 Taxi Fare Dispatched to Testnet Wallet
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Tx: {cashoutResult.transaction_id}
                    </span>
                  </div>

                  <div className="space-y-1.5 font-mono text-xs">
                    <div className="bg-white/5 p-2 rounded-lg break-all">
                      <span className="text-[10px] text-slate-400 block font-sans uppercase">Destination Payment Pointer:</span>
                      <span className="text-cyan-300 font-bold">{cashoutResult.destination_wallet}</span>
                    </div>

                    <div className="bg-white/5 p-2 rounded-lg break-all">
                      <span className="text-[10px] text-slate-400 block font-sans uppercase">Live ILP Stream Packet Address:</span>
                      <span className="text-emerald-300 text-[11px]">{cashoutResult.ilp_stream_packet}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-[#0a101d] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>Open Payments Interledger Specification (v1.0)</span>
          </div>

          <a
            href="https://wallet.interledger-test.dev"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 hover:underline font-semibold"
          >
            Open Testnet Wallet <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

      </div>
    </div>
  );
}

