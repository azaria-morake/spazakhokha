import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CategoryBar from './components/CategoryBar';
import HeroBanner from './components/HeroBanner';
import NearbyShops from './components/NearbyShops';
import CartSidebar from './components/CartSidebar';
import MobileNav from './components/MobileNav';
import OpenPaymentsModal from './components/OpenPaymentsModal';
import UnitStorefrontModal from './components/UnitStorefrontModal';
import CustomerModal from './components/CustomerModal';
import NotificationsModal from './components/NotificationsModal';

import { 
  INITIAL_SHOPS, 
  INITIAL_CART_ITEMS, 
  TOWNSHIPS, 
  DEMO_CUSTOMERS 
} from './data/mockData';
import { 
  fetchNearbyUnits, 
  fetchCustomer, 
  createOutgoingPaymentGrant 
} from './services/api';

export default function App() {
  const [activeNav, setActiveNav] = useState('home');
  const [selectedTownship, setSelectedTownship] = useState(TOWNSHIPS[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Customer State
  const [currentCustomer, setCurrentCustomer] = useState(DEMO_CUSTOMERS[0]); // @mannini

  // Cart State (Initialized with Cooking Oil 2L and White Bread matching UI reference)
  const [cartItems, setCartItems] = useState(INITIAL_CART_ITEMS);

  // Shops State
  const [shops, setShops] = useState(INITIAL_SHOPS);
  const [selectedShop, setSelectedShop] = useState(null);

  // Modal States
  const [isStorefrontOpen, setIsStorefrontOpen] = useState(false);
  const [isOpenPaymentsOpen, setIsOpenPaymentsOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [pendingGrant, setPendingGrant] = useState(null);
  const [applyTokens, setApplyTokens] = useState(false);

  // Sync customer from backend on mount
  useEffect(() => {
    async function loadCustomerData() {
      const data = await fetchCustomer(currentCustomer.username);
      if (data) {
        setCurrentCustomer(prev => ({
          ...prev,
          balance: data.balance,
          open_payments_id: data.open_payments_id,
          name: data.full_name || prev.name,
          stamps: data.stamps || prev.stamps,
          ubuntu_tokens: data.ubuntu_tokens || prev.ubuntu_tokens || {},
          total_ubuntu_tokens: data.total_ubuntu_tokens || prev.total_ubuntu_tokens || 0.0,
          cashout_eligible: data.cashout_eligible ?? false
        }));
      }
    }
    loadCustomerData();
  }, [currentCustomer.username]);

  // Sync live units from backend port 8001
  useEffect(() => {
    async function loadUnits() {
      const liveUnits = await fetchNearbyUnits(selectedTownship.lat, selectedTownship.lng);
      if (liveUnits && liveUnits.length > 0) {
        // Merge live units into shops
        const mapped = INITIAL_SHOPS.map(s => {
          const match = liveUnits.find(u => u.id === s.unit_id);
          if (match) {
            return {
              ...s,
              distanceKm: match.distance_km || s.distanceKm,
              name: s.name,
              highlightText: match.top_promotion || s.highlightText,
              open_payments_id: match.open_payments_id || s.open_payments_id
            };
          }
          return s;
        });

        // If Unit-104 (Mama Zola Spaza) is broadcasted, ensure it's available
        const unit104 = liveUnits.find(u => u.id === 'unit-104');
        if (unit104 && !mapped.some(m => m.unit_id === 'unit-104')) {
          mapped.unshift({
            id: 'shop-unit-104',
            name: unit104.name,
            unit_id: 'unit-104',
            image: '/shop_mzansi.jpg',
            rating: 4.8,
            reviewCount: 142,
            distanceKm: unit104.distance_km || 0.2,
            categories: ['Groceries', 'Bakery'],
            badge: '18% off',
            badgeType: 'discount',
            highlightText: unit104.top_promotion || 'Albany Bread Special',
            highlightType: 'tag',
            open_payments_id: unit104.open_payments_id,
            township: unit104.township,
            address: unit104.address,
            owner_name: unit104.owner_name,
            hours: unit104.operating_hours
          });
        }

        setShops(mapped);
      }
    }
    loadUnits();
  }, [selectedTownship]);

  // Cart operations
  const handleUpdateQuantity = (id, newQty) => {
    if (newQty <= 0) {
      handleRemoveItem(id);
      return;
    }
    setCartItems(prev =>
      prev.map(item => item.id === id ? { ...item, quantity: newQty } : item)
    );
  };

  const handleRemoveItem = (id) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const handleAddToCart = (product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, product];
    });
    setIsStorefrontOpen(false);
  };

  // Open Payments Checkout initiation
  const handleInitiateCheckout = async () => {
    const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (subtotal <= 0) return;

    const recipientStore = selectedShop || shops[0];
    const storeId = recipientStore.unit_id || "unit-104";
    const storeName = recipientStore.name;
    const storeWallet = recipientStore.open_payments_id || "$spazauniti.org/unit-104";

    const availableTokens = currentCustomer.ubuntu_tokens?.[storeId] ?? 24.0;
    const tokensDiscount = applyTokens ? Math.min(subtotal, availableTokens >= 16.0 ? 16.0 : availableTokens) : 0;
    const finalAmount = Math.max(0.01, subtotal - tokensDiscount);

    try {
      const grant = await createOutgoingPaymentGrant(currentCustomer.username, {
        amount: finalAmount,
        merchant_id: storeId,
        merchant_name: storeName,
        merchant_wallet: storeWallet,
        purpose: `Marketplace Cart: ${cartItems.map(c => c.name).join(', ')}${tokensDiscount > 0 ? ` (Applied ${tokensDiscount.toFixed(2)} UBU discount)` : ''}`
      });

      setPendingGrant({
        grantId: grant.grant_id,
        amount: finalAmount,
        originalAmount: subtotal,
        tokensDiscount: tokensDiscount,
        storeName: storeName,
        recipientWallet: storeWallet
      });

      setIsOpenPaymentsOpen(true);
    } catch (err) {
      alert("Checkout error: " + err.message);
    }
  };

  // Payment Success Handler
  const handlePaymentSuccess = (result) => {
    const newBal = result.new_balance ?? result.new_wallet_balance ?? (currentCustomer.balance - (pendingGrant?.amount || 0));
    const storeId = selectedShop?.unit_id || "unit-104";
    const tokensUsed = pendingGrant?.tokensDiscount || 0;

    setCurrentCustomer(prev => {
      const prevTokens = prev.ubuntu_tokens || {};
      const currentStoreTok = prevTokens[storeId] ?? 24.0;
      const updatedStoreTok = Math.max(0, currentStoreTok - tokensUsed + 1.78);
      return {
        ...prev,
        balance: newBal,
        points: prev.points + 5,
        stamps: (prev.stamps + 1) % 10,
        ubuntu_tokens: {
          ...prevTokens,
          [storeId]: updatedStoreTok
        }
      };
    });
    setCartItems([]);
    setApplyTokens(false);
  };

  // Filter shops by search and category
  const filteredShops = shops.filter(shop => {
    const matchesSearch = !searchQuery || 
      shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.categories.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = activeCategory === 'all' || 
      shop.categories.some(c => c.toLowerCase().replace(/\s+/g, '-').includes(activeCategory));
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex bg-[#0c1017] min-h-screen text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* 1. Left Sidebar */}
      <Sidebar
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        onOpenCustomerModal={() => setIsCustomerModalOpen(true)}
      />

      {/* 2. Main Content Center Column */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto min-h-screen pb-20 md:pb-8">
        <Header
          selectedTownship={selectedTownship}
          onSelectTownship={setSelectedTownship}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          currentCustomer={currentCustomer}
          onOpenCustomerModal={() => setIsCustomerModalOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
        />

        <div className="px-6 md:px-8 max-w-6xl w-full mx-auto">
          {/* Category Icons Row (Groceries, Produce, Household, Airtime, Food, More) */}
          <CategoryBar
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
          />

          {/* Hero Banner ("Better Prices. Bigger Rewards.") */}
          <HeroBanner
            onExploreDeals={() => {
              const el = document.getElementById('nearby-shops-anchor');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          />

          {/* Nearby Shops Section */}
          <div id="nearby-shops-anchor">
            <NearbyShops
              shops={filteredShops}
              onSelectShop={(shop) => {
                setSelectedShop(shop);
                setIsStorefrontOpen(true);
              }}
              onSeeAll={() => setActiveCategory('all')}
            />
          </div>
        </div>
      </main>

      {/* 3. Right Cart Sidebar ("Your Cart", OpenPayments Button, Purple Rewards Card) */}
      <CartSidebar
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onInitiateCheckout={handleInitiateCheckout}
        pointsEarned={5}
        currentPoints={currentCustomer.points || 245}
        userUbuTokens={currentCustomer.ubuntu_tokens?.[selectedShop?.unit_id || "unit-104"] ?? 24.0}
        applyTokens={applyTokens}
        onToggleApplyTokens={() => setApplyTokens(!applyTokens)}
        onOpenRewards={() => {
          setSelectedShop(shops[0]);
          setIsStorefrontOpen(true);
        }}
      />

      {/* 4. Responsive Mobile Navigation Bar */}
      <MobileNav
        activeNav={activeNav}
        setActiveNav={setActiveNav}
      />

      {/* 5. Modals */}
      <OpenPaymentsModal
        isOpen={isOpenPaymentsOpen}
        onClose={() => setIsOpenPaymentsOpen(false)}
        grantData={pendingGrant}
        onPaymentSuccess={handlePaymentSuccess}
        currentCustomer={currentCustomer}
      />

      <UnitStorefrontModal
        isOpen={isStorefrontOpen}
        onClose={() => setIsStorefrontOpen(false)}
        shop={selectedShop}
        onAddToCart={handleAddToCart}
        currentCustomer={currentCustomer}
      />

      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        currentCustomer={currentCustomer}
        onSelectCustomer={setCurrentCustomer}
        onRefreshCustomer={async () => {
          const updated = await fetchCustomer(currentCustomer.username);
          if (updated) {
            setCurrentCustomer(prev => ({
              ...prev,
              balance: updated.balance,
              ubuntu_tokens: updated.ubuntu_tokens || prev.ubuntu_tokens,
              total_ubuntu_tokens: updated.total_ubuntu_tokens || prev.total_ubuntu_tokens,
              cashout_eligible: updated.cashout_eligible ?? false
            }));
          }
        }}
      />

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />
    </div>
  );
}
