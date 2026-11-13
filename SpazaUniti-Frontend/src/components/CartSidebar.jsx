import React from 'react';
import { 
  ShoppingCart, 
  Minus, 
  Plus, 
  Trash2, 
  CreditCard, 
  Star, 
  ArrowRight, 
  Coins, 
  Bus, 
  Check,
  ShieldCheck,
  Sparkles,
  Wallet
} from 'lucide-react';

export default function CartSidebar({
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onPayWithUbu,
  onInitiateCheckout,
  isPayingUbu = false,
  currentCustomer,
  pointsEarned = 5,
  currentPoints = 245,
  userUbuTokens = 24.0,
  applyTokens = false,
  onToggleApplyTokens,
  onOpenRewards
}) {
  const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const tokenDiscount = applyTokens ? Math.min(subtotal, userUbuTokens >= 16.0 ? 16.0 : userUbuTokens) : 0;
  const netPayable = Math.max(0, subtotal - tokenDiscount);

  const spendableUbu = Number(currentCustomer?.ubu_balance || 0);
  const fiatReserve = Number(currentCustomer?.balance || 0);
  const hasEnoughUbu = spendableUbu >= netPayable;
  const hasEnoughFiat = fiatReserve >= netPayable;

  return (
    <aside className="w-80 bg-[#0d1117] border-l border-[#1e2638] flex flex-col justify-between p-5 min-h-screen shrink-0 select-none">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-[#1b2332] mb-5">
          <div className="flex items-center gap-2.5">
            <ShoppingCart className="w-5 h-5 text-white" />
            <h3 className="text-lg font-bold text-white tracking-tight">
              Your Cart
            </h3>
          </div>
          <span className="w-6 h-6 rounded-full bg-[#16a34a] text-white text-xs font-bold flex items-center justify-center">
            {totalCount}
          </span>
        </div>

        {/* Cart Items List */}
        {cartItems.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-semibold">Your cart is empty</p>
            <p className="text-xs text-slate-500 mt-1">Add items from nearby spaza shops</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cartItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3.5 bg-[#141a24] border border-[#20293a] rounded-2xl p-3"
              >
                {/* Product Image Thumbnail */}
                <div className="w-16 h-16 rounded-xl bg-slate-900 border border-[#26334a] overflow-hidden shrink-0 flex items-center justify-center p-1">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-white truncate">
                    {item.name}
                  </h4>
                  {item.unit && (
                    <span className="text-[11px] text-slate-400 block -mt-0.5">
                      {item.unit}
                    </span>
                  )}
                  <span className="text-sm font-extrabold text-white mt-0.5 block">
                    R{item.price.toFixed(2)}
                  </span>

                  {/* Quantity Stepper & Remove */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center bg-[#1b2332] rounded-lg border border-[#28354c] px-1 py-0.5">
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
                        title="Decrease"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold text-white px-2">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
                        title="Increase"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="text-slate-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart Footer */}
      <div className="pt-4 border-t border-[#1b2332] space-y-3 mt-auto">
        {/* Customer Live Wallets Box */}
        <div className="bg-[#141c2a] border border-[#232f46] rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-[#00A2E8]/20 border border-[#00A2E8]/40 flex items-center justify-center text-[#38C3FF]">
                <Coins className="w-3 h-3" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-200 block leading-tight">My Spendable UBU</span>
                <span className="text-[9px] text-[#38C3FF] font-medium">Uniti-wide · R0.00 fee</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-black text-white tabular-nums">
                {spendableUbu.toFixed(2)}{' '}
                <span className="text-xs font-bold text-[#38C3FF]">UBU</span>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CreditCard className="w-3 h-3" />
              </div>
              <div>
                <span className="text-[11px] font-medium text-slate-400 block leading-tight">Bank / OP Reserve</span>
                <span className="text-[9px] text-slate-500">Fiat buffer</span>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-300 tabular-nums">
              R{fiatReserve.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Loyalty Cashback Discount Toggle */}
        {subtotal > 0 && userUbuTokens > 0 && (
          <div 
            onClick={onToggleApplyTokens}
            className={`border rounded-xl px-3 py-2 flex items-center justify-between transition-all cursor-pointer select-none ${
              applyTokens 
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-200' 
                : 'bg-[#151c28] border-[#222e42] text-slate-400 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <Star className={`w-4 h-4 ${applyTokens ? 'text-amber-400 fill-amber-400' : 'text-slate-500'}`} />
              <div className="text-left">
                <span className="text-xs font-bold block text-white">Apply Loyalty Cashback</span>
                <span className="text-[10px] text-slate-400">Available: {Number(userUbuTokens).toFixed(2)} UBU discount</span>
              </div>
            </div>
            <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
              applyTokens ? 'bg-amber-500 border-amber-400 text-slate-950' : 'border-slate-600'
            }`}>
              {applyTokens && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </div>
        )}

        {/* Subtotal & Net Payable Breakdown */}
        <div className="space-y-1 px-1">
          {applyTokens && tokenDiscount > 0 && (
            <>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Subtotal</span>
                <span>R{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-amber-400 font-bold">
                <span>Cashback Applied</span>
                <span>-R{tokenDiscount.toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-300">
              {applyTokens && tokenDiscount > 0 ? "Net Payable" : "Subtotal"}
            </span>
            <span className="text-lg font-black text-white tabular-nums">
              R{netPayable.toFixed(2)}{' '}
              <span className="text-xs font-bold text-[#38C3FF]">({netPayable.toFixed(2)} UBU)</span>
            </span>
          </div>
        </div>

        {/* Loyalty Reward Info Box */}
        {subtotal > 0 && (
          <div className="bg-[#10241b] border border-[#1b3d2d] rounded-xl px-3 py-1.5 flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
            <span className="text-[11px] font-semibold text-emerald-300">
              Earn +1.78 UBU cashback &amp; {pointsEarned} pts with this purchase!
            </span>
          </div>
        )}

        {/* PRIMARY CTA: Pay with Spendable UBU (Zero Fee) */}
        <button
          onClick={onPayWithUbu}
          disabled={cartItems.length === 0 || isPayingUbu || !hasEnoughUbu}
          className="w-full bg-[#00A2E8] hover:bg-[#008fcb] disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2.5 shadow-lg shadow-[#00A2E8]/20 transition-all hover:shadow-[#00A2E8]/35 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
        >
          {isPayingUbu ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Coins className="w-5 h-5 text-white" />
          )}
          <span className="text-sm tracking-wide">
            {isPayingUbu 
              ? "Processing UBU Payment..." 
              : !hasEnoughUbu 
                ? `Insufficient UBU (${spendableUbu.toFixed(2)} UBU available)` 
                : `Pay ${netPayable.toFixed(2)} UBU (Zero Fee)`}
          </span>
        </button>

        {/* SECONDARY CTA: Pay with Bank/OP Reserve */}
        <button
          onClick={onInitiateCheckout}
          disabled={cartItems.length === 0 || !hasEnoughFiat}
          className="w-full bg-[#182130] hover:bg-[#202d42] border border-[#26354f] disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-all cursor-pointer"
          title={!hasEnoughFiat ? `Insufficient Bank/OP Reserve (R${fiatReserve.toFixed(2)} available)` : undefined}
        >
          <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            {!hasEnoughFiat
              ? `Bank/OP Short (R${fiatReserve.toFixed(2)} left)`
              : `Pay R${netPayable.toFixed(2)} with Bank/OP Reserve`}
          </span>
        </button>

        {/* Bottom Purple Promo Box: Loyalty Cashback & Taxi Fare Goal */}
        <div 
          onClick={onOpenRewards}
          className="bg-gradient-to-br from-[#4c1d95] via-[#581c87] to-[#3b0764] border border-[#6b21a8]/40 rounded-2xl p-3.5 relative overflow-hidden shadow-lg cursor-pointer hover:border-purple-400/50 transition-all group"
        >
          <div className="relative z-10 pr-20">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-0.5">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span>Unit Loyalty Cashback</span>
              <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="text-lg font-black text-white tracking-tight">
              {Number(userUbuTokens).toFixed(1)} UBU
            </div>
            <p className="text-[10px] text-purple-200/90 font-medium mt-0.5 flex items-center gap-1">
              <Bus className="w-3 h-3 text-sky-300" />
              {userUbuTokens >= 20 ? "R20 Taxi Fare Ready to Cash Out!" : `${(20 - userUbuTokens).toFixed(1)} UBU to Taxi Fare`}
            </p>
          </div>

          {/* 3D Gift Box Floating Illustration */}
          <div className="absolute -right-2 -bottom-2 w-20 h-20 pointer-events-none group-hover:scale-110 transition-transform duration-300">
            <img
              src="/gift_box.jpg"
              alt="Rewards gift box"
              className="w-full h-full object-contain drop-shadow-md"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
