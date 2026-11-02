/**
 * Spaza Uniti — Township Commerce & Open Payments Customer Application
 * Universal Alphanumeric Handles • Proximity Discovery • Standardized Unit Storefront • Two-Tier ILP Consent
 */

const API_BASE = "http://localhost:8001";

// Application State
const state = {
  currentCustomer: {
    username: "mannini",
    name: "Mannini Morake",
    balance: 150.00,
    open_payments_id: "$spazauniti.org/mannini",
    wallet_address_url: "http://localhost:8001/mannini",
    stamps: 6
  },
  coords: {
    lat: -26.2234,
    lng: 27.8681
  },
  radiusKm: 5.0,
  featureFilter: "all",
  searchQuery: "",
  units: [],
  selectedUnit: null,
  pendingGrant: null
};

// Demo Customer Profiles
const DEMO_CUSTOMERS = [
  { username: "mannini", name: "Mannini Morake", avatar: "M", balance: 150.00, stamps: 6 },
  { username: "sipho", name: "Sipho Dlamini", avatar: "S", balance: 84.00, stamps: 6 },
  { username: "azaria", name: "Azaria Morake", avatar: "A", balance: 250.00, stamps: 2 },
  { username: "thandi", name: "Mama Thandi", avatar: "T", balance: 400.00, stamps: 9 }
];

// Township Coordinates Map
const TOWNSHIP_COORDS = {
  dobsonville: { lat: -26.2234, lng: 27.8681 },
  meadowlands: { lat: -26.2290, lng: 27.8720 },
  orlando: { lat: -26.2360, lng: 27.9150 },
  diepkloof: { lat: -26.2550, lng: 27.9400 },
  zola: { lat: -26.2420, lng: 27.8380 }
};

// ----------------------------------------------------------------------------
// Initialization
// ----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupFilterControls();
  setupCustomerModals();
  setupUnitDetailTabs();
  setupCounterPayment();
  
  // Load initial customer & nearby units
  loadCustomer("mannini");
  fetchNearbyUnits();
});

// ----------------------------------------------------------------------------
// Customer Identity & Wallet Management
// ----------------------------------------------------------------------------
async function loadCustomer(username) {
  try {
    const res = await fetch(`${API_BASE}/api/customers/${username}`);
    if (res.ok) {
      const data = await res.json();
      state.currentCustomer = {
        username: data.username,
        name: data.name,
        balance: data.balance,
        open_payments_id: data.open_payments_id,
        wallet_address_url: data.wallet_address_url,
        stamps: data.stamps || 0
      };
    } else {
      // Fallback to local demo record
      const fallback = DEMO_CUSTOMERS.find(c => c.username === username);
      if (fallback) {
        state.currentCustomer = {
          ...fallback,
          open_payments_id: `$spazauniti.org/${fallback.username}`,
          wallet_address_url: `${API_BASE}/${fallback.username}`
        };
      }
    }
  } catch (err) {
    console.warn("Could not reach Uniti backend, using demo record:", err);
  }

  updateCustomerUI();
}

function updateCustomerUI() {
  const cust = state.currentCustomer;
  
  // Header chips
  document.getElementById("headerUserHandle").textContent = `@${cust.username}`;
  document.getElementById("headerWalletBalance").textContent = `R ${cust.balance.toFixed(2)}`;
  document.getElementById("userAvatarText").textContent = (cust.name || cust.username).charAt(0).toUpperCase();
  document.getElementById("opFullPointerUri").textContent = cust.open_payments_id;

  // Pay at counter payer fields
  const payerHandle = document.getElementById("payPayerHandle");
  const payerWallet = document.getElementById("payPayerWallet");
  const availableBal = document.getElementById("payAvailableBalance");
  if (payerHandle) payerHandle.textContent = `@${cust.username} (${cust.name})`;
  if (payerWallet) payerWallet.textContent = cust.open_payments_id;
  if (availableBal) availableBal.textContent = `R ${cust.balance.toFixed(2)}`;

  // Top Up Preview
  const topUpPreview = document.getElementById("topUpWalletPreview");
  if (topUpPreview) topUpPreview.value = cust.open_payments_id;

  // Re-render loyalty stamps if a unit is currently open
  if (state.selectedUnit) {
    renderLoyaltyCard(state.selectedUnit.loyalty_program);
  }
}

// ----------------------------------------------------------------------------
// Discovery Feed & Geolocation
// ----------------------------------------------------------------------------
async function fetchNearbyUnits() {
  const grid = document.getElementById("unitsGrid");
  const emptyState = document.getElementById("emptyUnitsState");
  const headerCount = document.getElementById("discoveryCountHeader");

  let url = `${API_BASE}/api/units?lat=${state.coords.lat}&lng=${state.coords.lng}`;
  if (state.radiusKm !== null) {
    url += `&radius_km=${state.radiusKm}`;
  }
  if (state.featureFilter && state.featureFilter !== "all") {
    url += `&filter=${state.featureFilter}`;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch units");
    let units = await res.json();

    // Filter by client search if text entered
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase();
      units = units.filter(u => 
        u.name.toLowerCase().includes(q) ||
        (u.township && u.township.toLowerCase().includes(q)) ||
        (u.tagline && u.tagline.toLowerCase().includes(q)) ||
        (u.top_promotion && u.top_promotion.toLowerCase().includes(q)) ||
        (u.loyalty_summary && u.loyalty_summary.toLowerCase().includes(q))
      );
    }

    state.units = units;

    headerCount.textContent = `Nearby Registered Spaza Units (${units.length})`;

    if (units.length === 0) {
      grid.innerHTML = "";
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;
    renderUnitsGrid(units);

  } catch (err) {
    console.error("Discovery error:", err);
    showToast("Connecting to Spaza Uniti network...", "warning");
  }
}

function renderUnitsGrid(units) {
  const grid = document.getElementById("unitsGrid");
  grid.innerHTML = "";

  units.forEach(unit => {
    const card = document.createElement("article");
    card.className = "unit-card";
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");

    const distText = unit.distance_km !== null ? `${unit.distance_km} km` : "Nearby";
    
    // Feature tags
    let tagsHtml = "";
    if (unit.promotions_count > 0) {
      tagsHtml += `<span class="feature-tag promo-tag">🔥 ${unit.promotions_count} Special${unit.promotions_count > 1 ? 's' : ''}</span>`;
    }
    if (unit.has_loyalty) {
      tagsHtml += `<span class="feature-tag loyalty-tag">🍞 Bread Club</span>`;
    }
    if (unit.jobs_count > 0) {
      tagsHtml += `<span class="feature-tag jobs-tag">💼 ${unit.jobs_count} Gig${unit.jobs_count > 1 ? 's' : ''}</span>`;
    }

    // Highlight snippet
    let highlightSnippet = "";
    if (unit.top_promotion) {
      highlightSnippet = `
        <div class="highlight-row">
          <span class="highlight-icon">🔥</span>
          <span><strong>Special:</strong> ${escapeHtml(unit.top_promotion)}</span>
        </div>
      `;
    } else if (unit.loyalty_summary) {
      highlightSnippet = `
        <div class="highlight-row">
          <span class="highlight-icon">🍞</span>
          <span>${escapeHtml(unit.loyalty_summary)}</span>
        </div>
      `;
    }

    card.innerHTML = `
      <div>
        <div class="unit-card-header">
          <div class="unit-card-title-group">
            <h4>${escapeHtml(unit.name)}</h4>
            <span class="unit-card-landmark">${escapeHtml(unit.landmark || unit.township)}</span>
          </div>
          <span class="unit-distance-badge">${distText}</span>
        </div>

        <p class="unit-card-tagline" style="margin-top: 10px;">${escapeHtml(unit.tagline || 'Verified community spaza shop')}</p>

        <div class="unit-card-badges-strip" style="margin-top: 12px;">
          ${tagsHtml}
        </div>
      </div>

      ${highlightSnippet ? `<div class="unit-highlights-box">${highlightSnippet}</div>` : ''}

      <div class="unit-card-footer">
        <span class="unit-op-pointer">${escapeHtml(unit.open_payments_id)}</span>
        <button class="btn-open-unit">
          <span>Open Store</span> ➔
        </button>
      </div>
    `;

    card.addEventListener("click", () => openUnitStorefront(unit.id));
    grid.appendChild(card);
  });
}

// ----------------------------------------------------------------------------
// Standardized Internal Unit Storefront (View 2)
// ----------------------------------------------------------------------------
async function openUnitStorefront(unitId) {
  try {
    const res = await fetch(`${API_BASE}/api/units/${unitId}?lat=${state.coords.lat}&lng=${state.coords.lng}`);
    if (!res.ok) throw new Error("Unit not found");
    const unit = await res.json();
    state.selectedUnit = unit;

    // Switch view
    document.getElementById("viewDiscovery").classList.remove("active");
    document.getElementById("viewDiscovery").hidden = true;

    const detailView = document.getElementById("viewUnitDetail");
    detailView.hidden = false;
    detailView.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Populate standardized hero
    document.getElementById("detailUnitName").textContent = unit.name;
    document.getElementById("detailUnitTagline").textContent = unit.tagline || "Fresh bread, groceries & credit tabs";
    document.getElementById("detailUnitAddress").textContent = `${unit.address}, ${unit.township}`;
    document.getElementById("detailUnitHours").textContent = unit.operating_hours || "06:30 - 20:00 Daily";
    document.getElementById("detailUnitOwner").textContent = unit.owner_name;
    document.getElementById("detailUnitOpId").textContent = unit.open_payments_id;
    document.getElementById("detailDistanceBadge").textContent = unit.distance_km !== null ? `${unit.distance_km} km away` : "Nearby";

    // Counter pay recipient fields
    const recName = document.getElementById("payRecipientName");
    const recWallet = document.getElementById("payRecipientWallet");
    if (recName) recName.textContent = unit.name;
    if (recWallet) recWallet.textContent = unit.open_payments_id;

    // Render Tab Contents
    renderPromotionsTab(unit.promotions || []);
    renderLoyaltyCard(unit.loyalty_program);
    renderJobsTab(unit.jobs || []);

    // Set badges
    document.getElementById("tabBadgePromos").textContent = (unit.promotions || []).length;
    document.getElementById("tabBadgeJobs").textContent = (unit.jobs || []).length;

    // Default to Promos Tab
    switchUnitTab("tabPromos");

  } catch (err) {
    console.error("Error opening unit storefront:", err);
    showToast("Failed to load unit details.", "warning");
  }
}

function renderPromotionsTab(promos) {
  const container = document.getElementById("detailPromosGrid");
  container.innerHTML = "";

  if (promos.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 32px; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md);">
        No live promotions currently active at this unit. Check back soon!
      </div>
    `;
    return;
  }

  promos.forEach(p => {
    const card = document.createElement("div");
    card.className = "promo-item-card";
    const orig = Number(p.original_price || 0).toFixed(2);
    const promo = Number(p.promo_price || 0).toFixed(2);
    const disc = p.discount_pct || 15;
    const days = p.days_left || 3;

    card.innerHTML = `
      <div>
        <div class="promo-item-top">
          <span class="promo-category">${escapeHtml(p.category || 'Special')}</span>
          <span class="promo-discount-badge">${disc}% OFF</span>
        </div>
        <h4 class="promo-item-title" style="margin-top: 8px;">${escapeHtml(p.title)}</h4>
      </div>

      <div class="promo-pricing-row">
        <span class="price-original">R${orig}</span>
        <span class="price-promo">R${promo}</span>
      </div>

      <div class="promo-footer-row">
        <span>⏱️ ${days} days remaining</span>
        <button class="btn-inquire-promo" data-title="${escapeHtml(p.title)}" data-price="${promo}">
          Pay at Counter
        </button>
      </div>
    `;

    // Wire quick button to switch to payment tab with prefilled amount
    card.querySelector(".btn-inquire-promo").addEventListener("click", (e) => {
      const amt = e.target.getAttribute("data-price");
      const title = e.target.getAttribute("data-title");
      document.getElementById("payAmountInput").value = amt;
      document.getElementById("payPurposeInput").value = `Special: ${title}`;
      switchUnitTab("tabPayment");
    });

    container.appendChild(card);
  });
}

function renderLoyaltyCard(loyalty) {
  const titleEl = document.getElementById("loyaltyTitle");
  const descEl = document.getElementById("loyaltyRewardDesc");
  const countPill = document.getElementById("loyaltyStampsCountPill");
  const visualizer = document.getElementById("stampsVisualizer");
  const custStatus = document.getElementById("loyaltyCustomerStatus");

  custStatus.textContent = `Tracking for @${state.currentCustomer.username}`;

  if (!loyalty || !loyalty.active) {
    titleEl.textContent = "Loyalty Club (Coming Soon)";
    descEl.textContent = "This unit has not activated an automated loyalty stamp club yet.";
    countPill.textContent = "Inactive";
    visualizer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--text-dim);">No active loyalty card</div>`;
    return;
  }

  titleEl.textContent = loyalty.title || "Daily Bread Stamp Club";
  descEl.textContent = loyalty.reward_description || "Buy 9 loaves of Albany bread, get the 10th FREE!";
  
  const stampsEarned = Math.min(state.currentCustomer.stamps || 0, 10);
  countPill.textContent = `${stampsEarned} / 10 Stamps Collected`;

  visualizer.innerHTML = "";
  for (let i = 1; i <= 10; i++) {
    const slot = document.createElement("div");
    const isRewardSlot = (i === 10);
    const isFilled = (i <= stampsEarned);

    slot.className = `stamp-slot ${isRewardSlot ? 'reward-slot' : ''} ${isFilled ? 'filled' : ''}`;
    slot.innerHTML = `
      <span class="stamp-icon">${isRewardSlot ? '🏆' : (isFilled ? '✓' : '🥖')}</span>
      <span class="stamp-num">#${i}</span>
    `;
    visualizer.appendChild(slot);
  }
}

function renderJobsTab(jobs) {
  const container = document.getElementById("detailJobsList");
  container.innerHTML = "";

  if (jobs.length === 0) {
    container.innerHTML = `
      <div style="padding: 32px; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md);">
        No open community gigs currently listed at this store.
      </div>
    `;
    return;
  }

  jobs.forEach(job => {
    const card = document.createElement("div");
    card.className = "job-item-card";

    card.innerHTML = `
      <div class="job-info-left">
        <h4>${escapeHtml(job.title)}</h4>
        <div class="job-meta-row">
          <span class="job-pay">💵 ${escapeHtml(job.pay)}</span>
          <span class="job-shift">⏰ ${escapeHtml(job.schedule)}</span>
        </div>
        <p class="job-desc">${escapeHtml(job.description)}</p>
      </div>
      <button class="btn-apply-job" data-title="${escapeHtml(job.title)}">
        <span>💬 Contact Owner</span>
      </button>
    `;

    card.querySelector(".btn-apply-job").addEventListener("click", () => {
      const owner = state.selectedUnit ? state.selectedUnit.owner_name : "Store Owner";
      showToast(`WhatsApp inquiry prepared for ${owner} regarding "${job.title}".`, "success");
    });

    container.appendChild(card);
  });
}

function switchUnitTab(targetTabId) {
  // Update buttons
  document.querySelectorAll(".unit-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === targetTabId);
  });

  // Update panels
  document.querySelectorAll(".tab-panel").forEach(panel => {
    if (panel.id === targetTabId) {
      panel.hidden = false;
      panel.classList.add("active");
    } else {
      panel.hidden = true;
      panel.classList.remove("active");
    }
  });
}

// ----------------------------------------------------------------------------
// Counter Payment & Two-Tier Consent Flow
// ----------------------------------------------------------------------------
function setupCounterPayment() {
  const form = document.getElementById("counterPayForm");
  const amountInput = document.getElementById("payAmountInput");

  // Preset pill clicks
  document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      amountInput.value = Number(btn.getAttribute("data-amt")).toFixed(2);
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const amount = parseFloat(amountInput.value);
    const purpose = document.getElementById("payPurposeInput").value || "Counter payment";

    if (isNaN(amount) || amount <= 0) {
      showToast("Please enter a valid amount.", "warning");
      return;
    }

    if (amount > state.currentCustomer.balance) {
      showToast(`Insufficient balance in @${state.currentCustomer.username} wallet. Available: R${state.currentCustomer.balance.toFixed(2)}`, "warning");
      return;
    }

    const unit = state.selectedUnit;
    const recipientUri = unit ? unit.open_payments_id : "$spazauniti.org/unit-104";
    const storeId = unit ? unit.id : "unit-104";
    const storeName = unit ? unit.name : "Mama Zola Spaza";

    // Initiate Outgoing Payment Grant on SpazaUniti backend
    try {
      const res = await fetch(`${API_BASE}/api/wallets/${state.currentCustomer.username}/outgoing-payments/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount,
          merchant_id: storeId,
          merchant_name: storeName,
          merchant_wallet: recipientUri,
          purpose: purpose
        })
      });


      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create payment grant");
      }

      const grantData = await res.json();
      state.pendingGrant = {
        grantId: grantData.grant_id,
        amount: amount,
        purpose: purpose,
        storeName: unit ? unit.name : "Mama Zola Spaza",
        recipientUri: recipientUri,
        authUrl: grantData.interactive_authorization_url
      };

      // Open Two-Tier Consent Modal
      openConsentModal(state.pendingGrant);

    } catch (err) {
      console.error("Payment initiation error:", err);
      showToast(err.message, "warning");
    }
  });

  // Consent Option A (Interactive SMS/Push link simulation)
  document.getElementById("btnApproveOptionA").addEventListener("click", async () => {
    if (!state.pendingGrant) return;
    try {
      const res = await fetch(`${API_BASE}/api/grants/${state.pendingGrant.grantId}/approve`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Approval failed");
      const approval = await res.json();
      
      closeConsentModal();
      handlePaymentSuccess(approval, "Option A (Interactive Push Link)");
    } catch (err) {
      showToast(`Option A failed: ${err.message}`, "warning");
    }
  });

  // Consent Option B (4-digit security PIN fallback)
  document.getElementById("pinFallbackForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.pendingGrant) return;

    const pinInput = document.getElementById("counterPinInput");
    const pinErr = document.getElementById("pinErrorFeedback");
    pinErr.hidden = true;

    try {
      const res = await fetch(`${API_BASE}/api/grants/${state.pendingGrant.grantId}/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput.value })
      });

      if (!res.ok) {
        pinErr.hidden = false;
        pinErr.textContent = "Incorrect security PIN. Please try again.";
        return;
      }

      const approval = await res.json();
      pinInput.value = "";
      closeConsentModal();
      handlePaymentSuccess(approval, "Option B (Counter Security PIN)");

    } catch (err) {
      pinErr.hidden = false;
      pinErr.textContent = err.message || "PIN verification failed.";
    }
  });

  document.getElementById("receiptDoneBtn").addEventListener("click", () => {
    document.getElementById("receiptModalBackdrop").hidden = true;
  });
}

function openConsentModal(grant) {
  document.getElementById("consentAmountText").textContent = `R ${grant.amount.toFixed(2)}`;
  document.getElementById("consentCustomerText").textContent = `@${state.currentCustomer.username} (${state.currentCustomer.name})`;
  document.getElementById("consentRecipientText").textContent = grant.storeName;
  document.getElementById("consentPurposeText").textContent = grant.purpose;
  document.getElementById("consentGrantIdText").textContent = grant.grantId;

  document.getElementById("counterPinInput").value = "";
  document.getElementById("pinErrorFeedback").hidden = true;

  document.getElementById("consentModalBackdrop").hidden = false;
}

function closeConsentModal() {
  document.getElementById("consentModalBackdrop").hidden = true;
}

function handlePaymentSuccess(approvalData, methodUsed) {
  // Update state balance
  state.currentCustomer.balance = approvalData.new_balance;
  updateCustomerUI();

  // Populate receipt modal
  document.getElementById("receiptAmount").textContent = `R ${approvalData.amount.toFixed(2)}`;
  document.getElementById("receiptStore").textContent = state.selectedUnit ? state.selectedUnit.name : "Mama Zola Spaza";
  document.getElementById("receiptCustomer").textContent = `@${state.currentCustomer.username}`;
  document.getElementById("receiptAuthMethod").textContent = methodUsed;
  document.getElementById("receiptNewBalance").textContent = `R ${approvalData.new_balance.toFixed(2)}`;
  document.getElementById("receiptTxnRef").textContent = approvalData.transaction_id || `TXN-OP-${Date.now().toString().slice(-4)}`;

  document.getElementById("receiptModalBackdrop").hidden = false;
  showToast(`⚡ Payment approved via ${methodUsed}!`, "success");
}

// ----------------------------------------------------------------------------
// Navigation & Controls
// ----------------------------------------------------------------------------
function setupNavigation() {
  // Brand logo returns to discovery
  document.getElementById("brandLogoHome").addEventListener("click", returnToDiscovery);
  document.getElementById("backToDiscoveryBtn").addEventListener("click", returnToDiscovery);

  // Township selector
  const townshipSelect = document.getElementById("townshipSelect");
  townshipSelect.addEventListener("change", (e) => {
    const selectedKey = e.target.value;
    const coords = TOWNSHIP_COORDS[selectedKey];
    if (coords) {
      state.coords = coords;
      fetchNearbyUnits();
      showToast(`Location set to ${e.target.options[e.target.selectedIndex].text}`, "success");
    }
  });

  // Hero pay now shortcut button
  const heroPayBtn = document.getElementById("heroPayNowBtn");
  if (heroPayBtn) {
    heroPayBtn.addEventListener("click", () => switchUnitTab("tabPayment"));
  }

  // Claim reward check button
  const claimBtn = document.getElementById("claimRewardBtn");
  if (claimBtn) {
    claimBtn.addEventListener("click", () => {
      const stamps = state.currentCustomer.stamps || 0;
      if (stamps >= 9) {
        showToast("🎉 Congratulations! You have 9+ stamps and qualify for 1 FREE Albany Bread loaf!", "success");
      } else {
        showToast(`You have ${stamps}/10 stamps. Need ${9 - stamps} more loaves to earn a free loaf.`, "warning");
      }
    });
  }
}

function returnToDiscovery() {
  document.getElementById("viewUnitDetail").classList.remove("active");
  document.getElementById("viewUnitDetail").hidden = true;

  const discovery = document.getElementById("viewDiscovery");
  discovery.hidden = false;
  discovery.classList.add("active");
  fetchNearbyUnits();
}

function setupFilterControls() {
  // Radius Pills
  const radiusButtons = document.querySelectorAll("#radiusPillGroup .filter-pill");
  radiusButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      radiusButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const rVal = btn.getAttribute("data-radius");
      state.radiusKm = rVal === "all" ? null : parseFloat(rVal);
      fetchNearbyUnits();
    });
  });

  // Feature Filter Pills
  const featureButtons = document.querySelectorAll("#featurePillGroup .filter-pill");
  featureButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      featureButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.featureFilter = btn.getAttribute("data-feature");
      fetchNearbyUnits();
    });
  });

  // Search Input
  const searchInput = document.getElementById("unitSearchInput");
  const clearBtn = document.getElementById("clearSearchBtn");

  searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    clearBtn.hidden = state.searchQuery.length === 0;
    fetchNearbyUnits();
  });

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    state.searchQuery = "";
    clearBtn.hidden = true;
    fetchNearbyUnits();
  });

  document.getElementById("resetRadiusBtn").addEventListener("click", () => {
    state.radiusKm = 5.0;
    radiusButtons.forEach(b => b.classList.toggle("active", b.getAttribute("data-radius") === "5.0"));
    fetchNearbyUnits();
  });
}

function setupUnitDetailTabs() {
  document.querySelectorAll(".unit-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab");
      switchUnitTab(target);
    });
  });
}

// ----------------------------------------------------------------------------
// Customer Switcher & Registration Modals
// ----------------------------------------------------------------------------
function setupCustomerModals() {
  const userModal = document.getElementById("userModalBackdrop");
  const switchBtn = document.getElementById("switchUserBtn");
  const walletBtn = document.getElementById("customerWalletBtn");
  const closeUserModal = document.getElementById("closeUserModalBtn");

  const openUserModal = () => {
    renderDemoUsersList();
    userModal.hidden = false;
  };

  switchBtn.addEventListener("click", openUserModal);
  walletBtn.addEventListener("click", openUserModal);
  closeUserModal.addEventListener("click", () => userModal.hidden = true);

  // Modal tab switching
  const tabBtnSwitch = document.getElementById("tabBtnSwitchUser");
  const tabBtnReg = document.getElementById("tabBtnRegisterUser");
  const panelSwitch = document.getElementById("modalPanelSwitch");
  const panelReg = document.getElementById("modalPanelRegister");

  tabBtnSwitch.addEventListener("click", () => {
    tabBtnSwitch.classList.add("active");
    tabBtnReg.classList.remove("active");
    panelSwitch.hidden = false;
    panelReg.hidden = true;
  });

  tabBtnReg.addEventListener("click", () => {
    tabBtnReg.classList.add("active");
    tabBtnSwitch.classList.remove("active");
    panelReg.hidden = false;
    panelSwitch.hidden = true;
  });

  // Username validation regex
  const regUsernameInput = document.getElementById("regUsername");
  const handleFeedback = document.getElementById("handleFeedback");
  const regAddressPreview = document.getElementById("regAddressPreview");

  let checkDebounce = null;
  regUsernameInput.addEventListener("input", (e) => {
    const raw = e.target.value.trim();
    regAddressPreview.textContent = raw ? `$spazauniti.org/${raw}` : "$spazauniti.org/username";

    clearTimeout(checkDebounce);
    const alphaRegex = /^[a-zA-Z0-9]{3,20}$/;
    if (!alphaRegex.test(raw)) {
      handleFeedback.className = "handle-validation-feedback error";
      handleFeedback.textContent = "Handle must be 3-20 strictly alphanumeric characters (no spaces, dashes, or symbols).";
      return;
    }

    handleFeedback.className = "handle-validation-feedback";
    handleFeedback.textContent = "Checking availability on Open Payments namespace...";

    checkDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/customers/check-username/${raw}`);
        const data = await res.json();
        if (data.available) {
          handleFeedback.className = "handle-validation-feedback success";
          handleFeedback.textContent = `✓ Universal handle @${raw} is available!`;
        } else {
          handleFeedback.className = "handle-validation-feedback error";
          handleFeedback.textContent = `✗ Handle @${raw} is already registered. Please choose another.`;
        }
      } catch (err) {
        handleFeedback.className = "handle-validation-feedback success";
        handleFeedback.textContent = `✓ Format valid: @${raw}`;
      }
    }, 250);
  });

  // Form submission: Register new customer
  document.getElementById("registerCustomerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullName = document.getElementById("regFullName").value.trim();
    const username = document.getElementById("regUsername").value.trim();
    const pin = document.getElementById("regPin").value.trim();
    const deposit = parseFloat(document.getElementById("regDeposit").value) || 100.0;

    try {
      const res = await fetch(`${API_BASE}/api/customers/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          username: username,
          pin: pin,
          initial_deposit: deposit
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Registration failed");
      }

      const created = await res.json();
      showToast(`Welcome @${created.username}! Open Payments wallet issued.`, "success");

      userModal.hidden = true;
      loadCustomer(created.username);

    } catch (err) {
      showToast(err.message, "warning");
    }
  });

  // Top Up Modal
  const topUpModal = document.getElementById("topUpModalBackdrop");
  document.getElementById("quickTopUpBtn").addEventListener("click", () => {
    document.getElementById("topUpWalletPreview").value = state.currentCustomer.open_payments_id;
    topUpModal.hidden = false;
  });
  document.getElementById("closeTopUpModalBtn").addEventListener("click", () => {
    topUpModal.hidden = true;
  });

  document.getElementById("topUpForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const amt = parseFloat(document.getElementById("topUpAmount").value) || 50;
    const source = document.getElementById("topUpSource").value || "Direct Deposit";

    try {
      const res = await fetch(`${API_BASE}/api/wallets/${state.currentCustomer.username}/incoming-payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          description: source
        })
      });

      if (!res.ok) throw new Error("Top up failed");
      const result = await res.json();

      state.currentCustomer.balance = result.new_balance;
      updateCustomerUI();
      topUpModal.hidden = true;
      showToast(`R${amt.toFixed(2)} received into @${state.currentCustomer.username} wallet!`, "success");

    } catch (err) {
      showToast(err.message, "warning");
    }
  });

  // Close consent modal
  document.getElementById("closeConsentModalBtn").addEventListener("click", closeConsentModal);
}

function renderDemoUsersList() {
  const container = document.getElementById("demoUsersList");
  container.innerHTML = "";

  DEMO_CUSTOMERS.forEach(user => {
    const isCurrent = user.username === state.currentCustomer.username;
    const btn = document.createElement("div");
    btn.className = `user-item-btn ${isCurrent ? 'active' : ''}`;
    btn.innerHTML = `
      <div class="user-item-left">
        <div class="user-item-avatar">${user.avatar}</div>
        <div>
          <div class="user-item-name">${escapeHtml(user.name)}</div>
          <div class="user-item-handle">@${user.username}</div>
        </div>
      </div>
      <div class="user-item-balance">
        ${isCurrent ? `R ${state.currentCustomer.balance.toFixed(2)}` : `R ${user.balance.toFixed(2)}`}
      </div>
    `;

    btn.addEventListener("click", () => {
      document.getElementById("userModalBackdrop").hidden = true;
      loadCustomer(user.username);
      showToast(`Switched active customer to @${user.username}`, "success");
    });

    container.appendChild(btn);
  });
}

// ----------------------------------------------------------------------------
// Utilities
// ----------------------------------------------------------------------------
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icon = type === "success" ? "✓" : (type === "warning" ? "⚠️" : "⚡");
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.25s ease";
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
