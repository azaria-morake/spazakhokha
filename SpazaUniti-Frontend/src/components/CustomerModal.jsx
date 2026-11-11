import React, { useState } from 'react';
import {
  User,
  Wallet,
  ArrowUpRight,
  ShieldCheck,
  X,
  Check,
  Coins,
  Bus,
  Users,
  Search,
  UserPlus,
  Send,
  Snowflake,
  Play,
  MailCheck
} from 'lucide-react';
import { DEMO_CUSTOMERS } from '../data/mockData';
import {
  checkUsernameAvailability,
  registerCustomer,
  topUpWallet,
  cashoutUbuntuTokens,
  fundUbuWallet,
  addFamilyMember,
  updateFamilyMember,
  searchConsumers,
  inviteBeneficiary,
  respondToInvitation,
  allocateToBeneficiary
} from '../services/api';

export default function CustomerModal({
  isOpen,
  onClose,
  currentCustomer,
  onSelectCustomer,
  onRefreshCustomer
}) {
  const [activeTab, setActiveTab] = useState('profile');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusBanner, setStatusBanner] = useState(null);

  // Registration state
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regCell, setRegCell] = useState('0721112233');
  const [regPin, setRegPin] = useState('');
  const [regAccountType, setRegAccountType] = useState('INDIVIDUAL');
  const [feedback, setFeedback] = useState(null);

  // Wallet funding state
  const [fundUbuAmount, setFundUbuAmount] = useState('100.00');
  const [fundSource, setFundSource] = useState('OPEN_PAYMENTS');
  const [topUpAmount, setTopUpAmount] = useState('100.00');
  const [cashoutMsg, setCashoutMsg] = useState(null);

  // Family member addition state
  const [memUsername, setMemUsername] = useState('');
  const [memFullName, setMemFullName] = useState('');
  const [memRelationship, setMemRelationship] = useState('Child');
  const [memDailyLimit, setMemDailyLimit] = useState('10.00');
  const [memPin, setMemPin] = useState('1234');

  // Beneficiary search & invite state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [inviteTarget, setInviteTarget] = useState(null);
  const [inviteRel, setInviteRel] = useState('Girlfriend');
  const [inviteCap, setInviteCap] = useState('80.00');
  const [allocateAmounts, setAllocateAmounts] = useState({});

  if (!isOpen) return null;

  const isFamilyVault = currentCustomer.account_type === 'FAMILY';
  const totalRewardTokens = currentCustomer.total_ubuntu_tokens ??
    (currentCustomer.ubuntu_tokens ? Object.values(currentCustomer.ubuntu_tokens).reduce((a, b) => a + b, 0) : 0);
  const unit104Tokens = currentCustomer.ubuntu_tokens?.['unit-104'] ?? 0;
  const isCashoutEligible = unit104Tokens >= 20.0;

  const incomingAllocs = currentCustomer.incoming_allocations || [];
  const pendingInvites = incomingAllocs.filter((a) => a.status === 'PENDING');
  const activeIncomingAllowances = incomingAllocs.filter((a) => a.status === 'ACCEPTED');
  const familyMembers = currentCustomer.family_members || [];
  const beneficiaries = currentCustomer.beneficiaries || [];

  const notify = (msg, ok = true) => {
    setStatusBanner({ msg, ok });
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const handleFundUbuSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(fundUbuAmount);
    if (isNaN(amt) || amt <= 0) return;
    setIsSubmitting(true);
    try {
      const res = await fundUbuWallet(currentCustomer.username, amt, fundSource);
      await onRefreshCustomer();
      notify(res.message);
    } catch (err) {
      notify(err.message, false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCashoutSubmit = async () => {
    setIsSubmitting(true);
    setCashoutMsg(null);
    try {
      const res = await cashoutUbuntuTokens(currentCustomer.username, 'unit-104', 20.0, 'Taxi Fare to Job Interview');
      setCashoutMsg(res.receipt_message || 'R20.00 cashed out to spendable wallet!');
      await onRefreshCustomer();
    } catch (err) {
      notify(err.message, false);
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
      await topUpWallet(currentCustomer.username, amt, 'Bank / EFT Top Up');
      await onRefreshCustomer();
      notify(`R${amt.toFixed(2)} credited to @${currentCustomer.username} Open Payments ZAR balance.`);
    } catch (err) {
      notify(err.message, false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddFamilyMember = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addFamilyMember(currentCustomer.username, {
        member_username: memUsername.trim(),
        full_name: memFullName.trim() || memUsername.trim(),
        pin: memPin,
        relationship_label: memRelationship,
        daily_limit_ubu: parseFloat(memDailyLimit) || 10.0,
        period: 'DAILY',
        allowed_categories: memRelationship === 'Child' ? 'Snacks & School Lunch' : 'All Spaza Goods'
      });
      await onRefreshCustomer();
      notify(`Added @${memUsername.trim()} under @${currentCustomer.username} family vault!`);
      setMemUsername('');
      setMemFullName('');
    } catch (err) {
      notify(err.message, false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleFamilyFreeze = async (member) => {
    const nextStatus = member.status === 'FROZEN' ? 'ACCEPTED' : 'FROZEN';
    try {
      await updateFamilyMember(currentCustomer.username, member.member_username, { status: nextStatus });
      await onRefreshCustomer();
      notify(`@${member.member_username} allowance is now ${nextStatus}.`);
    } catch (err) {
      notify(err.message, false);
    }
  };

  const handleSearchConsumers = async (val) => {
    setSearchTerm(val);
    if (val.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const results = await searchConsumers(val.trim(), currentCustomer.username);
    setSearchResults(results);
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteTarget) return;
    setIsSubmitting(true);
    try {
      await inviteBeneficiary(currentCustomer.username, {
        beneficiary_username: inviteTarget.username,
        relationship_label: inviteRel,
        allowance_limit_ubu: parseFloat(inviteCap) || 50.0,
        period: 'WEEKLY'
      });
      await onRefreshCustomer();
      notify(`Invitation sent to @${inviteTarget.username}! Waiting for acceptance.`);
      setInviteTarget(null);
      setSearchTerm('');
      setSearchResults([]);
    } catch (err) {
      notify(err.message, false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRespondInvite = async (linkId, action) => {
    setIsSubmitting(true);
    try {
      await respondToInvitation(linkId, currentCustomer.username, action);
      await onRefreshCustomer();
      notify(action === 'ACCEPT' ? 'Beneficiary invitation accepted!' : 'Invitation declined.');
    } catch (err) {
      notify(err.message, false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendToBeneficiary = async (ben) => {
    const raw = allocateAmounts[ben.link_id] ?? '25.00';
    const amt = parseFloat(raw);
    if (isNaN(amt) || amt <= 0) return;
    setIsSubmitting(true);
    try {
      const res = await allocateToBeneficiary(currentCustomer.username, ben.link_id, {
        amount_ubu: amt,
        mode: 'TRANSFER',
        note: `Beneficiary UBU gift (${ben.relationship_label})`
      });
      await onRefreshCustomer();
      notify(res.message);
    } catch (err) {
      notify(err.message, false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUsernameChange = async (e) => {
    const val = e.target.value.trim();
    setRegUsername(val);
    const regex = /^[a-zA-Z0-9][a-zA-Z0-9_]{1,22}[a-zA-Z0-9]$/;
    if (!regex.test(val)) {
      setFeedback({
        valid: false,
        msg: 'Must be 3-24 characters (letters, numbers, or underscores e.g. morake_ext_5).'
      });
      return;
    }
    setFeedback({ valid: true, msg: 'Checking handle availability...' });
    const check = await checkUsernameAvailability(val);
    if (check.available) {
      setFeedback({ valid: true, msg: `Handle @${val} is available!` });
    } else {
      setFeedback({ valid: false, msg: `Handle @${val} is already taken.` });
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regUsername || regPin.length !== 4) return;
    setIsSubmitting(true);
    try {
      const result = await registerCustomer({
        full_name: regName.trim(),
        username: regUsername.trim(),
        cell_number: regCell.trim() || '0720000000',
        pin: regPin.trim(),
        account_type: regAccountType
      });
      onSelectCustomer({
        username: result.username,
        name: result.full_name,
        avatar: result.username.charAt(0).toUpperCase(),
        account_type: result.account_type,
        balance: result.balance,
        ubu_balance: result.ubu_balance,
        open_payments_id: result.open_payments_id,
        ubuntu_tokens: result.ubuntu_tokens || {},
        total_ubuntu_tokens: result.total_ubuntu_tokens || 0,
        family_members: result.family_members || [],
        beneficiaries: result.beneficiaries || [],
        incoming_allocations: result.incoming_allocations || [],
        pending_invitations_count: result.pending_invitations_count || 0
      });
      setActiveTab('profile');
      notify(`Created ${result.account_type} handle @${result.username}!`);
    } catch (err) {
      setFeedback({ valid: false, msg: err.message || 'Registration failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#141b27] border border-[#232f44] rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-[#1f293d] flex items-center justify-between bg-[#111722] shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center font-bold ${
              isFamilyVault ? 'bg-emerald-900 border-emerald-500/40 text-emerald-300' : 'bg-purple-900 border-purple-500/30 text-purple-300'
            }`}>
              {currentCustomer.name ? currentCustomer.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  @{currentCustomer.username}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isFamilyVault
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600/50'
                    : 'bg-sky-950 text-sky-300 border-sky-600/50'
                }`}>
                  {currentCustomer.account_type || 'INDIVIDUAL'}
                </span>
              </div>
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#1e273a] bg-[#111722] text-[11px] font-bold shrink-0">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors ${
              activeTab === 'profile' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            UBU Wallet
            {pendingInvites.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px]">
                {pendingInvites.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('people')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors ${
              activeTab === 'people' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {isFamilyVault ? 'Family Members' : 'Beneficiaries'}
          </button>
          <button
            onClick={() => setActiveTab('switch')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors ${
              activeTab === 'switch' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Switch
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors ${
              activeTab === 'register' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            + New Handle
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {statusBanner && (
            <div className={`p-3 rounded-xl text-xs font-semibold border ${
              statusBanner.ok
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/70 border-rose-500/40 text-rose-300'
            }`}>
              {statusBanner.msg}
            </div>
          )}

          {/* TAB 1: TWO-BUCKET UBU WALLET + INVITES */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              {/* Primary Wallet Card: Uniti-Wide Spendable UBU vs Open Payments ZAR */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#182130] border border-emerald-500/30 rounded-2xl p-4">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                    Spendable UBU Wallet
                  </span>
                  <div className="text-2xl font-black text-white mt-1">
                    {Number(currentCustomer.ubu_balance || 0).toFixed(2)} <span className="text-xs font-bold text-emerald-400">UBU</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Uniti-wide • 1 UBU = R1.00 sweet/staples
                  </span>
                </div>

                <div className="bg-[#182130] border border-[#25334a] rounded-2xl p-4">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Open Payments ZAR
                  </span>
                  <div className="text-2xl font-black text-slate-100 mt-1">
                    R{Number(currentCustomer.balance || 0).toFixed(2)}
                  </div>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    Direct Bank / Grant Rail
                  </span>
                </div>
              </div>

              {/* Pending Invitations Inbox */}
              {pendingInvites.length > 0 && (
                <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <MailCheck className="w-4 h-4" />
                    <span>Pending Beneficiary Invitation(s)</span>
                  </div>
                  {pendingInvites.map((inv) => (
                    <div key={inv.link_id} className="bg-[#101622] border border-[#25334a] p-3 rounded-xl flex items-center justify-between gap-3">
                      <div className="text-xs">
                        <strong className="text-white block">@{inv.sponsor_username} ({inv.relationship_label})</strong>
                        <span className="text-slate-400 text-[11px]">
                          Offers up to {inv.allocation_limit_ubu.toFixed(2)} UBU/{inv.period.toLowerCase()}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleRespondInvite(inv.link_id, 'ACCEPT')}
                          disabled={isSubmitting}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRespondInvite(inv.link_id, 'DECLINE')}
                          disabled={isSubmitting}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg cursor-pointer"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Active Family / Sponsor Allowances */}
              {activeIncomingAllowances.length > 0 && (
                <div className="bg-[#182130] border border-purple-500/30 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-wider">
                    <Users className="w-4 h-4" />
                    <span>Active Household / Sponsor Allowances</span>
                  </div>
                  {activeIncomingAllowances.map((a) => (
                    <div key={a.link_id} className="bg-[#101622] p-3 rounded-xl border border-[#232f44] text-xs">
                      <div className="flex justify-between font-bold text-white">
                        <span>From @{a.sponsor_username} ({a.relationship_label})</span>
                        <span className="text-emerald-400">
                          {a.remaining_in_period_ubu.toFixed(2)} / {a.allocation_limit_ubu.toFixed(2)} UBU left
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                        <span>Period: {a.period} • {a.allowed_categories}</span>
                        <span>Pool: {Number(a.sponsor_pool_balance_ubu || 0).toFixed(2)} UBU</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 1 Open Payments Deposit into UBU Wallet */}
              <form onSubmit={handleFundUbuSubmit} className="bg-[#182130] border border-[#25334a] rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">+ Load Spendable UBU (1 Single Payment)</span>
                  <span className="text-[10px] text-emerald-400 font-semibold">Zero Fee Micro-Spends</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="10"
                    min="5"
                    value={fundUbuAmount}
                    onChange={(e) => setFundUbuAmount(e.target.value)}
                    className="w-28 bg-[#101622] border border-[#26334a] rounded-xl px-3 py-2 text-sm text-white font-bold outline-none"
                  />
                  <select
                    value={fundSource}
                    onChange={(e) => setFundSource(e.target.value)}
                    className="flex-1 bg-[#101622] border border-[#26334a] rounded-xl px-2.5 py-2 text-xs text-slate-200 outline-none"
                  >
                    <option value="OPEN_PAYMENTS">External Open Payments</option>
                    <option value="WALLET_BALANCE">From ZAR Balance</option>
                    <option value="CASH_IN">Cash-In at Spaza Unit</option>
                  </select>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                  >
                    Load UBU
                  </button>
                </div>
              </form>

              {/* Unit-Scoped Reward UBU + R20 Taxi Cash-Out */}
              <div className="bg-[#182130] border border-[#25334a] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Unit-Scoped Loyalty Rewards</span>
                  </div>
                  <span className="text-xs font-black text-amber-400">{Number(totalRewardTokens).toFixed(2)} UBU</span>
                </div>

                <div className="flex items-center justify-between bg-[#101622] p-2.5 rounded-xl text-xs border border-[#222e42] mb-3">
                  <div>
                    <strong className="text-slate-200 block">Khumalo Spaza Store (#104)</strong>
                    <span className="text-slate-500 font-mono text-[10px]">Locked to Unit #104 Rewards</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400">{Number(unit104Tokens).toFixed(2)} UBU</span>
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
                      ? 'bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 text-white shadow-lg cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
                >
                  <Bus className="w-4 h-4" />
                  <span>
                    {isCashoutEligible
                      ? 'Cash Out R20 Taxi Fare (Open Payments)'
                      : 'Need 20.00 Reward UBU at #104 for Taxi Cash-Out'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: FAMILY MEMBERS (@morake_ext_5) OR INDIVIDUAL BENEFICIARIES */}
          {activeTab === 'people' && (
            <div className="space-y-4">
              {isFamilyVault ? (
                <>
                  {/* Family Members List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Members Under @{currentCustomer.username}
                      </span>
                      <span className="text-xs text-emerald-400 font-bold">
                        Pool: {Number(currentCustomer.ubu_balance || 0).toFixed(2)} UBU
                      </span>
                    </div>

                    {familyMembers.length === 0 ? (
                      <p className="text-xs text-slate-400">No members added yet.</p>
                    ) : (
                      familyMembers.map((m) => (
                        <div key={m.link_id} className="bg-[#182130] border border-[#25334a] p-3 rounded-xl flex items-center justify-between gap-2 text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <strong className="text-white font-mono">@{m.member_username}</strong>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                {m.relationship_label}
                              </span>
                              {m.status === 'FROZEN' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300">FROZEN</span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              Used {m.spent_in_period_ubu.toFixed(2)} / {m.allocation_limit_ubu.toFixed(2)} UBU ({m.period}) • {m.allowed_categories}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleFamilyFreeze(m)}
                            className="p-2 rounded-lg bg-[#101622] border border-[#26334a] text-slate-300 hover:text-white cursor-pointer"
                            title={m.status === 'FROZEN' ? 'Unfreeze allowance' : 'Freeze allowance'}
                          >
                            {m.status === 'FROZEN' ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Snowflake className="w-3.5 h-3.5 text-sky-400" />}
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Provision / Add Member Form */}
                  <form onSubmit={handleAddFamilyMember} className="bg-[#182130] border border-[#25334a] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                      <UserPlus className="w-4 h-4" />
                      <span>Add Member Under @{currentCustomer.username}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        required
                        value={memUsername}
                        onChange={(e) => setMemUsername(e.target.value)}
                        placeholder="Handle e.g. kagisomorake"
                        className="bg-[#101622] border border-[#26334a] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
                      />
                      <input
                        type="text"
                        required
                        value={memFullName}
                        onChange={(e) => setMemFullName(e.target.value)}
                        placeholder="Full name"
                        className="bg-[#101622] border border-[#26334a] rounded-xl px-3 py-2 text-xs text-white outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={memRelationship}
                        onChange={(e) => setMemRelationship(e.target.value)}
                        className="bg-[#101622] border border-[#26334a] rounded-xl px-2.5 py-2 text-xs text-white outline-none"
                      >
                        <option value="Child">Child</option>
                        <option value="Spouse">Spouse / Parent</option>
                        <option value="Sibling">Sibling</option>
                        <option value="Elder">Gogo / Elder</option>
                      </select>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={memDailyLimit}
                        onChange={(e) => setMemDailyLimit(e.target.value)}
                        placeholder="Daily UBU"
                        className="bg-[#101622] border border-[#26334a] rounded-xl px-2.5 py-2 text-xs text-white outline-none"
                      />
                      <input
                        type="text"
                        maxLength={4}
                        value={memPin}
                        onChange={(e) => setMemPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="PIN 1234"
                        className="bg-[#101622] border border-[#26334a] rounded-xl px-2.5 py-2 text-xs text-white font-mono text-center outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                    >
                      Provision Member & Set Daily UBU Cap
                    </button>
                  </form>
                </>
              ) : (
                <>
                  {/* Individual Adult: Search Existing Accounts & Send Invite */}
                  <div className="bg-[#182130] border border-[#25334a] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <Search className="w-4 h-4 text-emerald-400" />
                      <span>Search Registered Account to Add as Beneficiary</span>
                    </div>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => handleSearchConsumers(e.target.value)}
                      placeholder="Search username or name (e.g. lerato, mannini, thandi)..."
                      className="w-full bg-[#101622] border border-[#26334a] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />

                    {searchResults.length > 0 && !inviteTarget && (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {searchResults.map((u) => (
                          <button
                            key={u.username}
                            type="button"
                            onClick={() => setInviteTarget(u)}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#101622] hover:bg-[#1e293b] border border-[#25334a] text-left text-xs cursor-pointer"
                          >
                            <div>
                              <strong className="text-white">{u.full_name}</strong>
                              <span className="text-slate-400 font-mono ml-2">@{u.username}</span>
                            </div>
                            <span className="text-emerald-400 font-bold text-[11px]">Select</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {inviteTarget && (
                      <form onSubmit={handleSendInvite} className="p-3 bg-[#101622] border border-emerald-500/40 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white font-bold">
                            Invite @{inviteTarget.username} ({inviteTarget.full_name})
                          </span>
                          <button type="button" onClick={() => setInviteTarget(null)} className="text-slate-400 text-[11px]">
                            Cancel
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={inviteRel}
                            onChange={(e) => setInviteRel(e.target.value)}
                            placeholder="Relationship (e.g. Girlfriend)"
                            className="bg-[#182130] border border-[#26334a] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                            required
                          />
                          <input
                            type="number"
                            step="5"
                            value={inviteCap}
                            onChange={(e) => setInviteCap(e.target.value)}
                            placeholder="Weekly UBU cap"
                            className="bg-[#182130] border border-[#26334a] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                            required
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-xs cursor-pointer"
                        >
                          Send Beneficiary Invitation
                        </button>
                      </form>
                    )}
                  </div>

                  {/* My Beneficiaries List + Instant Allocation */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider block">
                      My Beneficiaries ({beneficiaries.length})
                    </span>
                    {beneficiaries.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        Search a girlfriend, sibling, or parent above to send them an invite.
                      </p>
                    ) : (
                      beneficiaries.map((ben) => (
                        <div key={ben.link_id} className="bg-[#182130] border border-[#25334a] p-3 rounded-xl space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <div>
                              <strong className="text-white font-mono">@{ben.member_username}</strong>
                              <span className="text-slate-400 ml-2">({ben.relationship_label})</span>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              ben.status === 'ACCEPTED'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/40'
                                : 'bg-amber-950 text-amber-300 border border-amber-600/40'
                            }`}>
                              {ben.status}
                            </span>
                          </div>

                          {ben.status === 'ACCEPTED' && (
                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="number"
                                step="5"
                                min="1"
                                value={allocateAmounts[ben.link_id] ?? '25.00'}
                                onChange={(e) => setAllocateAmounts({ ...allocateAmounts, [ben.link_id]: e.target.value })}
                                className="w-24 bg-[#101622] border border-[#26334a] rounded-lg px-2.5 py-1.5 text-xs text-white font-bold outline-none"
                              />
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleSendToBeneficiary(ben)}
                                className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Send className="w-3 h-3" />
                                <span>Send UBU (R0 Fee)</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: SWITCH CUSTOMER */}
          {activeTab === 'switch' && (
            <div className="space-y-2.5">
              <span className="text-xs text-slate-400 block mb-2">
                Select a consumer profile (Family Vault, Child, or Individual Adult):
              </span>
              {DEMO_CUSTOMERS.map((cust) => {
                const isSelected = cust.username === currentCustomer.username;
                return (
                  <button
                    key={cust.username}
                    onClick={() => {
                      onSelectCustomer(cust);
                      setActiveTab('profile');
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
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
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{cust.name}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                            {cust.account_type || 'INDIVIDUAL'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">@{cust.username}</div>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-emerald-400">
                      {Number(cust.ubu_balance ?? cust.balance).toFixed(2)} UBU
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* TAB 4: REGISTER NEW HANDLE */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1.5">Account Class</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegAccountType('INDIVIDUAL')}
                    className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                      regAccountType === 'INDIVIDUAL'
                        ? 'bg-emerald-950/60 border-emerald-500 text-white'
                        : 'bg-[#182130] border-[#26334a] text-slate-400'
                    }`}
                  >
                    Individual Adult
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegAccountType('FAMILY')}
                    className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                      regAccountType === 'FAMILY'
                        ? 'bg-purple-950/60 border-purple-500 text-white'
                        : 'bg-[#182130] border-[#26334a] text-slate-400'
                    }`}
                  >
                    Family Vault
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">
                  {regAccountType === 'FAMILY' ? 'Household Name' : 'Full Legal Name'}
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder={regAccountType === 'FAMILY' ? 'e.g. Dlamini Household Vault' : 'e.g. Kagiso Khumalo'}
                  className="w-full bg-[#101622] border border-[#26334a] rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">
                  Universal Handle (letters, numbers, underscores)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-slate-500 text-xs font-mono font-bold">@</span>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={handleUsernameChange}
                    placeholder={regAccountType === 'FAMILY' ? 'dlamini_ext_2' : 'kagiso99'}
                    className="w-full bg-[#101622] border border-[#26334a] rounded-xl pl-7 pr-3.5 py-2 text-xs text-white font-mono outline-none"
                  />
                </div>
                {feedback && (
                  <span className={`text-[11px] block mt-1 ${feedback.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                    {feedback.msg}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Cell Number</label>
                  <input
                    type="tel"
                    required
                    value={regCell}
                    onChange={(e) => setRegCell(e.target.value)}
                    className="w-full bg-[#101622] border border-[#26334a] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">4-Digit Security PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={regPin}
                    onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full bg-[#101622] border border-[#26334a] rounded-xl px-3 py-2 text-xs text-white font-mono tracking-widest outline-none text-center"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !feedback?.valid || regPin.length !== 4}
                className="w-full bg-[#16a34a] hover:bg-[#15803d] disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md mt-2 cursor-pointer"
              >
                Create {regAccountType === 'FAMILY' ? 'Family UBU Vault' : 'Individual Handle'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
