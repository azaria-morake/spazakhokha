import React from 'react';
import { 
  ShoppingCart, 
  Minus, 
  Plus, 
  Trash2, 
  CreditCard, 
  Star, 
  ArrowRight 
} from 'lucide-react';

export default function CartSidebar({
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onInitiateCheckout,
  pointsEarned = 5,
  currentPoints = 245,
  onOpenRewards
}) {
  const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

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
                        className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white"
                        title="Decrease"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold text-white px-2">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white"
                        title="Increase"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="text-slate-500 hover:text-red-400 p-1 transition-colors"
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

      {/* Cart Footer: Subtotal, Reward Badge, Open Payments Button & Purple Rewards Box */}
      <div className="pt-4 border-t border-[#1b2332] space-y-3.5 mt-auto">
        {/* Subtotal Row */}
        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-semibold text-slate-300">Subtotal</span>
          <span className="text-lg font-black text-white">R{subtotal.toFixed(2)}</span>
        </div>

        {/* Loyalty Reward Info Box */}
        {subtotal > 0 && (
          <div className="bg-[#10241b] border border-[#1b3d2d] rounded-xl px-3.5 py-2.5 flex items-center gap-2.5">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
            <span className="text-xs font-semibold text-emerald-300">
              You'll earn {pointsEarned} points with this purchase!
            </span>
          </div>
        )}

        {/* Primary CTA: Pay with OpenPayments */}
        <button
          onClick={onInitiateCheckout}
          disabled={cartItems.length === 0}
          className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-slate-950 font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/30 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
        >
          <CreditCard className="w-5 h-5 text-slate-950" />
          <span className="text-sm tracking-wide">Pay with OpenPayments</span>
        </button>

        {/* Bottom Purple Promo Box: Your Rewards */}
        <div 
          onClick={onOpenRewards}
          className="bg-gradient-to-br from-[#4c1d95] via-[#581c87] to-[#3b0764] border border-[#6b21a8]/40 rounded-2xl p-4 relative overflow-hidden shadow-lg cursor-pointer hover:border-purple-400/50 transition-all group"
        >
          <div className="relative z-10 pr-20">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-1">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span>Your Rewards</span>
              <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="text-2xl font-black text-white tracking-tight">
              {currentPoints} pts
            </div>
            <p className="text-[11px] text-purple-200/80 font-medium mt-0.5">
              Keep shopping to earn more!
            </p>
          </div>

          {/* 3D Gift Box Floating Illustration */}
          <div className="absolute -right-2 -bottom-2 w-24 h-24 pointer-events-none group-hover:scale-110 transition-transform duration-300">
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

