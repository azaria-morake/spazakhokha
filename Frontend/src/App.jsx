import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import MkhuluQuickBar from './components/MkhuluQuickBar';
import DashboardView from './components/views/DashboardView';
import CustomersView from './components/views/CustomersView';
import CreditTabsView from './components/views/CreditTabsView';
import RepaymentsView from './components/views/RepaymentsView';
import OfferingsView from './components/views/OfferingsView';
import CreateLoyaltyDialog from './components/dialogs/CreateLoyaltyDialog';
import CreatePromoDialog from './components/dialogs/CreatePromoDialog';
import AddCustomerDialog from './components/dialogs/AddCustomerDialog';
import MkhuluAgentDialog from './components/dialogs/MkhuluAgentDialog';
import OpenPaymentsQRDialog from './components/dialogs/OpenPaymentsQRDialog';

import {
  fetchDashboard,
  fetchCustomers,
  fetchPurchases,
  fetchRepayments,
  fetchLoyaltyPrograms,
  fetchPromotions,
  fetchTransactions,
  toggleBroadcast,
  checkBackendHealth
} from './services/api';

export default function App() {
  const [activePage, setActivePage] = useState('offerings'); // User was viewing Offerings
  const [dashboardMetrics, setDashboardMetrics] = useState({ sales: 0, outstanding: 0 });
  const [customers, setCustomers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [loyaltyPrograms, setLoyaltyPrograms] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [broadcastActive, setBroadcastActive] = useState(true);

  // Dialog States
  const [isLoyaltyOpen, setIsLoyaltyOpen] = useState(false);
  const [isPromoOpen, setIsPromoOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const syncAllData = async () => {
    try {
      const isOnline = await checkBackendHealth();
      if (!isOnline) {
        console.warn("Backend not detected on Port 8000. Running in offline/fallback mode.");
      }

      const [dash, custs, purs, reps, loyalty, promos, txns] = await Promise.all([
        fetchDashboard(),
        fetchCustomers(),
        fetchPurchases(),
        fetchRepayments(),
        fetchLoyaltyPrograms(),
        fetchPromotions(),
        fetchTransactions()
      ]);

      if (dash) setDashboardMetrics(dash);
      if (Array.isArray(custs)) setCustomers(custs);
      if (Array.isArray(purs)) setPurchases(purs);
      if (Array.isArray(reps)) setRepayments(reps);
      if (Array.isArray(loyalty) && loyalty.length > 0) setLoyaltyPrograms(loyalty);
      if (Array.isArray(promos)) setPromotions(promos);
      if (Array.isArray(txns)) setTransactions(txns);
    } catch (e) {
      console.warn("Sync error:", e);
    }
  };

  useEffect(() => {
    syncAllData();
  }, []);

  const handleToggleBroadcast = async (checked) => {
    setBroadcastActive(checked);
    await toggleBroadcast(checked);
    showToast(`Store broadcast is now ${checked ? 'ACTIVE' : 'PAUSED'} on Spaza Uniti!`, 'info');
  };

  const pageTitles = {
    dashboard: 'Shop Dashboard',
    customers: 'Customers & Credit Tabs',
    creditTabs: 'Informal Credit Ledger',
    repayments: 'Repayments & Reconciliation',
    offerings: 'Spaza Uniti Offerings & Loyalty'
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-[99999] px-4 py-3 rounded-xl shadow-xl border text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-bottom-2 ${
          toast.type === 'success' 
            ? 'bg-emerald-900 text-white border-emerald-700' 
            : toast.type === 'destructive'
            ? 'bg-rose-900 text-white border-rose-700'
            : 'bg-slate-900 text-white border-slate-700'
        }`}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        broadcastActive={broadcastActive}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
        <Topbar 
          pageTitle={pageTitles[activePage] || 'Shop Dashboard'}
          onOpenAgentModal={() => setIsAgentOpen(true)}
          onOpenAddCustomer={() => setIsAddCustomerOpen(true)}
        />

        {/* Mkhulu Zero-UI Voice Command Bar */}
        <MkhuluQuickBar 
          onRefreshData={syncAllData} 
          showToast={showToast} 
        />

        {/* View Switcher */}
        {activePage === 'dashboard' && (
          <DashboardView 
            dashboardMetrics={dashboardMetrics}
            transactions={transactions}
            customers={customers}
            onNavigate={setActivePage}
            onOpenQR={() => setIsQROpen(true)}
          />
        )}

        {activePage === 'customers' && (
          <CustomersView 
            customers={customers}
            onOpenAddCustomer={() => setIsAddCustomerOpen(true)}
            onRecordPurchaseForCustomer={(id) => {
              setActivePage('creditTabs');
            }}
            onRecordRepaymentForCustomer={(id) => {
              setActivePage('repayments');
            }}
          />
        )}

        {activePage === 'creditTabs' && (
          <CreditTabsView 
            customers={customers}
            purchases={purchases}
            onRefreshData={syncAllData}
            showToast={showToast}
          />
        )}

        {activePage === 'repayments' && (
          <RepaymentsView 
            customers={customers}
            repayments={repayments}
            onRefreshData={syncAllData}
            showToast={showToast}
          />
        )}

        {activePage === 'offerings' && (
          <OfferingsView 
            loyaltyPrograms={loyaltyPrograms}
            promotions={promotions}
            broadcastActive={broadcastActive}
            onToggleBroadcast={handleToggleBroadcast}
            onOpenCreateLoyalty={() => setIsLoyaltyOpen(true)}
            onOpenCreatePromo={() => setIsPromoOpen(true)}
            onRefreshData={syncAllData}
            showToast={showToast}
          />
        )}

        {/* Modals & Dialogs (Official ShadCN Dialogs) */}
        <CreateLoyaltyDialog 
          open={isLoyaltyOpen}
          onOpenChange={setIsLoyaltyOpen}
          onCreated={syncAllData}
          showToast={showToast}
        />

        <CreatePromoDialog 
          open={isPromoOpen}
          onOpenChange={setIsPromoOpen}
          onCreated={syncAllData}
          showToast={showToast}
        />

        <AddCustomerDialog 
          open={isAddCustomerOpen}
          onOpenChange={setIsAddCustomerOpen}
          onCreated={syncAllData}
          showToast={showToast}
        />

        <MkhuluAgentDialog 
          open={isAgentOpen}
          onOpenChange={setIsAgentOpen}
          onActionComplete={syncAllData}
          showToast={showToast}
        />

        <OpenPaymentsQRDialog 
          open={isQROpen}
          onOpenChange={setIsQROpen}
          showToast={showToast}
        />
      </main>
    </div>
  );
}
