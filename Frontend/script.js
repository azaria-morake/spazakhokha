// ============================================================================
// SpazaKhokha & Spaza Uniti — Frontend & Agentic AI Controller
// Integrated with Python FastAPI Backend & SQLite
// ============================================================================

const API_BASE = "http://localhost:8000/api";
let backendOnline = false;

// ----------------------------------------------------------------------------
// Audio Feedback (Web Audio API Synthesizer)
// ----------------------------------------------------------------------------
function playSound(type = "success") {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    if (type === "success") {
      // Pleasant two-tone chime (C5 -> G5)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(523.25, now);
      osc2.frequency.setValueAtTime(783.99, now + 0.12);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.12);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.4);
    } else if (type === "ilp") {
      // High-tech digital settlement chime (E5 -> A5 -> B5)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";

      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.setValueAtTime(880.00, now + 0.1);
      osc.frequency.setValueAtTime(987.77, now + 0.2);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === "voice_start") {
      // Radio / walkie-talkie chirp-in
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.setValueAtTime(987.77, now + 0.05);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === "voice_end") {
      // Radio chirp-out
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(987.77, now);
      osc.frequency.setValueAtTime(587.33, now + 0.05);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    }
  } catch (e) {
    console.debug("Web Audio interaction notice:", e);
  }
}

// ----------------------------------------------------------------------------
// State (Synchronized with FastAPI backend & SQLite)
// ----------------------------------------------------------------------------
let nextCustomerNumber = 4;
let nextPurchaseNumber = 3;
let nextRepaymentNumber = 2;
let nextPromoNumber = 3;

let customers = [
  {
    id: "CUST-001",
    name: "Sipho Dlamini",
    phone: "082 555 1234",
    balance: 84.00,
    credit_limit: 400.00,
    stamps: 6,
    notes: "Zone 2, reliable neighbor"
  },
  {
    id: "CUST-002",
    name: "Mama Thandi",
    phone: "071 888 4321",
    balance: 0.00,
    credit_limit: 600.00,
    stamps: 9,
    notes: "School teacher, settles monthly"
  },
  {
    id: "CUST-003",
    name: "Bongani Sithole",
    phone: "083 444 9876",
    balance: 45.00,
    credit_limit: 300.00,
    stamps: 3,
    notes: "Taxi rank vendor"
  }
];

let purchases = [
  {
    id: "PUR-1",
    customer_id: "CUST-001",
    customer_name: "Sipho Dlamini",
    description: "2 Albany Brown, 2L Stoney Ginger Beer",
    amount: 54.00,
    created_at: new Date(Date.now() - 3600000 * 4).toLocaleDateString("en-ZA")
  },
  {
    id: "PUR-2",
    customer_id: "CUST-003",
    customer_name: "Bongani Sithole",
    description: "5kg White Star Maize Meal, 1 Sunlight Soap",
    amount: 45.00,
    created_at: new Date(Date.now() - 3600000 * 2).toLocaleDateString("en-ZA")
  }
];

let repayments = [
  {
    id: "RP-0001",
    customer_id: "CUST-002",
    customer_name: "Mama Thandi",
    amount: 50.00,
    method: "Cash",
    created_at: new Date(Date.now() - 86400000).toLocaleDateString("en-ZA"),
    note: "Paid in full"
  }
];

let transactions = [
  {
    id: "TXN-101",
    type: "purchase",
    customer_name: "Sipho Dlamini",
    details: "2 Albany Brown, 2L Stoney Ginger Beer",
    amount: 54.00,
    method: "Credit Tab",
    source: "Counter Voice",
    created_at: "Today, 08:30"
  },
  {
    id: "TXN-102",
    type: "purchase",
    customer_name: "Bongani Sithole",
    details: "5kg White Star Maize Meal, 1 Sunlight Soap",
    amount: 45.00,
    method: "Credit Tab",
    source: "Counter UI",
    created_at: "Today, 10:15"
  },
  {
    id: "TXN-100",
    type: "repayment",
    customer_name: "Mama Thandi",
    details: "Cleared grocery tab",
    amount: 50.00,
    method: "Cash",
    source: "Counter POS",
    created_at: "Yesterday, 17:20"
  }
];

let promotions = [
  {
    id: "PROMO-001",
    title: "Weekend Albany Superior White Special",
    category: "Bakery",
    original_price: 19.50,
    promo_price: 16.00,
    discount_pct: 18,
    days_left: 2,
    active: true
  },
  {
    id: "PROMO-002",
    title: "Golden Cloud Cake Flour 2.5kg",
    category: "Staples",
    original_price: 42.00,
    promo_price: 35.00,
    discount_pct: 16,
    days_left: 4,
    active: true
  }
];

let loyaltyProgram = {
  title: "Daily Bread Stamp Club",
  program_type: "stamp_card",
  stamps_required: 9,
  reward_description: "Buy 9 loaves of Albany bread, get the 10th loaf FREE! Tracked automatically on Spaza Uniti.",
  active: true
};

let activeOpContext = {
  customerId: "CUST-001",
  customerName: "Sipho Dlamini",
  amount: 50.00,
  purpose: "Tab Repayment"
};

// ----------------------------------------------------------------------------
// Backend Synchronization
// ----------------------------------------------------------------------------
async function syncWithBackend() {
  try {
    const res = await fetch("http://localhost:8000/", { cache: "no-store" });
    if (!res.ok) throw new Error("Backend not healthy");

    backendOnline = true;

    // Fetch live datasets in parallel
    const [custRes, purRes, repRes, promoRes, txnRes, dashRes, settingsRes] = await Promise.all([
      fetch(`${API_BASE}/customers`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/purchases`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/repayments`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/promotions`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/transactions`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/dashboard`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/settings`).then(r => r.json()).catch(() => null)
    ]);

    if (custRes) customers = custRes;
    if (purRes) purchases = purRes;
    if (repRes) repayments = repRes;
    if (promoRes) promotions = promoRes;
    if (txnRes) transactions = txnRes;

    if (settingsRes) {
      updateBroadcastUI(settingsRes.broadcast_to_uniti);
    }

    if (dashRes) {
      document.getElementById("sales").textContent = `R${dashRes.sales.toFixed(2)}`;
      document.getElementById("outstanding").textContent = `R${dashRes.outstanding.toFixed(2)}`;
      document.getElementById("tabCountLabel").textContent = `${dashRes.customers_owing} customer${dashRes.customers_owing === 1 ? '' : 's'} owing`;
      document.getElementById("customers").textContent = dashRes.customers_count;
      document.getElementById("activeOfferingsCount").textContent = `${dashRes.active_promotions} Promos • 1 Loyalty`;
    } else {
      updateDashboardMetrics();
    }

    renderCustomers();
    renderCustomerOptions();
    renderPurchases();
    renderRepaymentCustomers();
    renderRepayments();
    renderPromotions();
    renderTransactions();
  } catch (err) {
    backendOnline = false;
    updateDashboardMetrics();
    renderCustomers();
    renderPurchases();
    renderRepayments();
    renderPromotions();
    renderTransactions();
  }
}

function updateBroadcastUI(isEnabled) {
  const switchEl = document.getElementById("unitiBroadcastSwitch");
  const labelEl = document.getElementById("broadcastToggleLabel");
  const subtextEl = document.getElementById("broadcastSubtext");
  const sidebarBadge = document.getElementById("sidebarBroadcastBadge");

  if (switchEl) switchEl.checked = isEnabled;

  if (labelEl) {
    if (isEnabled) {
      labelEl.className = "broadcast-state-text";
      labelEl.innerHTML = `Broadcast: <strong>ACTIVE</strong>`;
    } else {
      labelEl.className = "broadcast-state-text disabled";
      labelEl.innerHTML = `Broadcast: <strong>OFFLINE</strong>`;
    }
  }

  if (subtextEl) {
    subtextEl.textContent = isEnabled 
      ? "Visible to shoppers in Soweto discovery radius" 
      : "Hidden from customer discovery feed";
  }

  if (sidebarBadge) {
    if (isEnabled) {
      sidebarBadge.className = "card-pill live-pill";
      sidebarBadge.textContent = "● Live on Uniti";
      sidebarBadge.style.background = "#dcfce7";
      sidebarBadge.style.color = "#15803d";
    } else {
      sidebarBadge.className = "card-pill";
      sidebarBadge.textContent = "○ Offline from Uniti";
      sidebarBadge.style.background = "#fee2e2";
      sidebarBadge.style.color = "#b91c1c";
    }
  }
}

async function handleBroadcastToggleChange(event) {
  const isChecked = event.target.checked;
  updateBroadcastUI(isChecked);

  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ broadcast_to_uniti: isChecked })
    });
    const data = await res.json();
    if (isChecked) {
      showToastNotification("📡 Spaza Uniti Broadcast: ENABLED. Unit #104 is now discoverable by nearby shoppers.", "success");
    } else {
      showToastNotification("🔒 Spaza Uniti Broadcast: DISABLED. Unit #104 is now hidden from customer discovery.", "warning");
    }
  } catch (err) {
    console.error("Failed to toggle broadcast:", err);
    showToastNotification("Failed to update broadcast setting. Please verify backend.", "warning");
  }
}

// ----------------------------------------------------------------------------
// DOM Elements
// ----------------------------------------------------------------------------
const dashboardPage = document.getElementById("dashboardPage");
const customersPage = document.getElementById("customersPage");
const creditTabsPage = document.getElementById("creditTabsPage");
const repaymentsPage = document.getElementById("repaymentsPage");
const offeringsPage = document.getElementById("offeringsPage");

const pageTitle = document.getElementById("pageTitle");
const toast = document.getElementById("toastNotification");
const toastText = document.getElementById("toastText");
const toastIcon = document.getElementById("toastIcon");

const agentModalBackdrop = document.getElementById("agentModalBackdrop");
const agentChatFeed = document.getElementById("agentChatFeed");
const agentModalInput = document.getElementById("agentModalInput");
const openPaymentsModal = document.getElementById("openPaymentsModal");
const voiceSimModal = document.getElementById("voiceSimModal");

// ----------------------------------------------------------------------------
// Toast Notifications with Real SVG Icons
// ----------------------------------------------------------------------------
const TOAST_ICONS = {
  check: `<svg class="ui-icon ui-icon-md" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`,
  warning: `<svg class="ui-icon ui-icon-md" viewBox="0 0 24 24" style="stroke: #f59e0b;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`,
  ilp: `<svg class="ui-icon ui-icon-md" viewBox="0 0 24 24" style="stroke: #fde68a; fill: #fde68a;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  mic: `<svg class="ui-icon ui-icon-md" viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`,
  info: `<svg class="ui-icon ui-icon-md" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>`,
  money: `<svg class="ui-icon ui-icon-md" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><line x1="12" x2="12" y1="6" y2="18"/></svg>`,
  celebrate: `<svg class="ui-icon ui-icon-md" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  tab: `<svg class="ui-icon ui-icon-md" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  globe: `<svg class="ui-icon ui-icon-md" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`
};

function getToastIconSvg(key) {
  if (TOAST_ICONS[key]) return TOAST_ICONS[key];
  if (key === "ilp" || key === "zap") return TOAST_ICONS.ilp;
  if (key === "warning" || key === "warn") return TOAST_ICONS.warning;
  if (key === "mic") return TOAST_ICONS.mic;
  if (key === "money" || key === "cash") return TOAST_ICONS.money;
  if (key === "celebrate" || key === "success") return TOAST_ICONS.celebrate;
  if (key === "tab" || key === "credit") return TOAST_ICONS.tab;
  if (key === "globe" || key === "network") return TOAST_ICONS.globe;
  if (key === "info") return TOAST_ICONS.info;
  return TOAST_ICONS.check;
}

let toastTimer = null;
function showToast(msg, icon = "check", duration = 4500) {
  if (toastTimer) clearTimeout(toastTimer);
  toastText.textContent = msg;
  toastIcon.innerHTML = getToastIconSvg(icon);
  toast.hidden = false;

  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, duration);
}

document.getElementById("toastCloseBtn").addEventListener("click", () => {
  toast.hidden = true;
});

function showMessage(msg) {
  if (msg) showToast(msg, "info");
}

// ----------------------------------------------------------------------------
// View Navigation
// ----------------------------------------------------------------------------
function hideAllPages() {
  dashboardPage.hidden = true;
  customersPage.hidden = true;
  creditTabsPage.hidden = true;
  repaymentsPage.hidden = true;
  offeringsPage.hidden = true;
}

function openDashboard() {
  hideAllPages();
  dashboardPage.hidden = false;
  pageTitle.textContent = "Shop dashboard";
  syncWithBackend();
}

function openCustomers() {
  hideAllPages();
  customersPage.hidden = false;
  pageTitle.textContent = "Customer Management";
  renderCustomers();
}

function openCreditTabs() {
  hideAllPages();
  creditTabsPage.hidden = false;
  pageTitle.textContent = "Credit Tabs & Purchases";
  renderCustomerOptions();
  renderPurchases();
}

function openRepayments() {
  hideAllPages();
  repaymentsPage.hidden = false;
  pageTitle.textContent = "Tab Repayments";
  renderRepaymentCustomers();
  renderRepayments();
  updateRepaymentBalance();
}

function openOfferings() {
  hideAllPages();
  offeringsPage.hidden = false;
  pageTitle.textContent = "Spaza Uniti Offerings & Loyalty";
  renderPromotions();
}

document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    document.querySelectorAll(".nav-link").forEach(item => item.classList.remove("active"));
    link.classList.add("active");

    const page = link.dataset.page;
    if (page === "Dashboard") openDashboard();
    else if (page === "Customers") openCustomers();
    else if (page === "Credit Tabs") openCreditTabs();
    else if (page === "Repayments") openRepayments();
    else if (page === "Unit Offerings") openOfferings();
  });
});

document.getElementById("purchaseBtn").addEventListener("click", () => {
  setActiveNav("Credit Tabs");
  openCreditTabs();
  document.getElementById("purchaseDescription").focus();
});

document.getElementById("repaymentBtn").addEventListener("click", () => {
  setActiveNav("Repayments");
  openRepayments();
});

document.getElementById("openPaymentsQRBtn").addEventListener("click", () => {
  openOpenPaymentsModal("CUST-001", 50.00);
});

document.getElementById("viewOfferingsBtn").addEventListener("click", () => {
  setActiveNav("Unit Offerings");
  openOfferings();
});

function setActiveNav(pageName) {
  document.querySelectorAll(".nav-link").forEach(link => {
    if (link.dataset.page === pageName) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

// ----------------------------------------------------------------------------
// Dashboard Metrics & Rendering
// ----------------------------------------------------------------------------
function updateDashboardMetrics() {
  const totalOutstanding = customers.reduce((sum, c) => sum + (c.balance || 0), 0);
  const customersWithTabs = customers.filter(c => (c.balance || 0) > 0).length;
  const totalSalesEstimate = purchases.reduce((sum, p) => sum + (p.amount || 0), 0) + 240.00;

  document.getElementById("sales").textContent = `R${totalSalesEstimate.toFixed(2)}`;
  document.getElementById("outstanding").textContent = `R${totalOutstanding.toFixed(2)}`;
  document.getElementById("tabCountLabel").textContent = `${customersWithTabs} customer${customersWithTabs === 1 ? '' : 's'} owing`;
  document.getElementById("customers").textContent = customers.length;
  document.getElementById("activeOfferingsCount").textContent = `${promotions.length} Promo${promotions.length === 1 ? '' : 's'} • 1 Loyalty`;
}

function renderTransactions() {
  const list = document.getElementById("transactionsList");
  const empty = document.getElementById("transactionsEmpty");
  list.replaceChildren();

  if (transactions.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  transactions.forEach(txn => {
    const row = document.createElement("tr");
    const badgeClass = txn.type === "purchase" ? "purchase" : (txn.method === "Open Payments" ? "open_payments" : "repayment");
    const typeLabel = txn.type === "purchase" ? "Tab Purchase" : "Repayment";

    row.innerHTML = `
      <td><span class="txn-badge ${badgeClass}">${typeLabel}</span></td>
      <td><strong>${escapeHtml(txn.customer_name || txn.customerName)}</strong></td>
      <td>${escapeHtml(txn.details)}</td>
      <td><strong>R${Number(txn.amount).toFixed(2)}</strong></td>
      <td>${escapeHtml(txn.method)}</td>
      <td><span class="muted-small">${escapeHtml(txn.source)}</span></td>
      <td>${escapeHtml(txn.created_at || txn.timestamp)}</td>
    `;
    list.appendChild(row);
  });
}

// ----------------------------------------------------------------------------
// Customer Management
// ----------------------------------------------------------------------------
function renderCustomers() {
  const searchInput = document.getElementById("customerSearch");
  const list = document.getElementById("customerList");
  const empty = document.getElementById("customerEmpty");
  const search = searchInput.value.trim().toLowerCase();

  const filtered = customers.filter(customer =>
    customer.id.toLowerCase().includes(search) ||
    customer.name.toLowerCase().includes(search) ||
    customer.phone.toLowerCase().includes(search)
  );

  list.replaceChildren();

  filtered.forEach(customer => {
    const row = document.createElement("tr");
    const balance = customer.balance || 0;
    const creditLimit = customer.credit_limit || customer.creditLimit || 350;

    row.innerHTML = `
      <td><code>${customer.id}</code></td>
      <td><strong>${escapeHtml(customer.name)}</strong></td>
      <td>${escapeHtml(customer.phone)}</td>
      <td><strong style="color: ${balance > 0 ? '#b91c1c' : '#15803d'}">R${balance.toFixed(2)}</strong></td>
      <td>R${creditLimit.toFixed(2)}</td>
      <td><span class="stamp-chip"><svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> ${customer.stamps || 0}/9 stamps</span></td>
      <td>
        <button class="secondary-btn btn-sm quick-tab-btn" data-id="${customer.id}" data-name="${customer.name}">
          + Add tab
        </button>
      </td>
    `;
    list.appendChild(row);
  });

  empty.hidden = filtered.length > 0;
  document.getElementById("customers").textContent = customers.length;

  document.querySelectorAll(".quick-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      setActiveNav("Credit Tabs");
      openCreditTabs();
      const select = document.getElementById("purchaseCustomer");
      select.value = btn.dataset.id;
      document.getElementById("purchaseDescription").focus();
    });
  });
}

function openCustomerForm() {
  document.getElementById("customerFormContainer").hidden = false;
  document.getElementById("customerName").focus();
}

document.getElementById("addCustomerBtn").addEventListener("click", () => {
  setActiveNav("Customers");
  openCustomers();
  openCustomerForm();
});

document.getElementById("newCustomerBtn").addEventListener("click", openCustomerForm);

document.getElementById("cancelCustomerBtn").addEventListener("click", () => {
  document.getElementById("customerForm").reset();
  document.getElementById("customerFormContainer").hidden = true;
});

document.getElementById("customerForm").addEventListener("submit", async event => {
  event.preventDefault();
  const name = document.getElementById("customerName").value.trim();
  const phone = document.getElementById("customerPhone").value.trim();
  const limit = Number(document.getElementById("customerCreditLimit").value) || 300;
  const notes = document.getElementById("customerNotes").value.trim();

  if (!name || !phone) {
    showToast("Please enter customer name and phone.", "warning");
    return;
  }

  if (backendOnline) {
    try {
      const res = await fetch(`${API_BASE}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, credit_limit: limit, notes })
      });
      if (!res.ok) throw new Error("Failed to create customer on server");
      await syncWithBackend();
    } catch (e) {
      console.warn("Backend error, falling back locally:", e);
      addCustomerLocally(name, phone, limit, notes);
    }
  } else {
    addCustomerLocally(name, phone, limit, notes);
  }

  event.target.reset();
  document.getElementById("customerFormContainer").hidden = true;
  document.getElementById("customerSearch").value = "";
  playSound("success");
  showToast(`Registered ${name} successfully!`, "celebrate");
});

function addCustomerLocally(name, phone, limit, notes) {
  const newCust = {
    id: `CUST-${String(nextCustomerNumber++).padStart(3, "0")}`,
    name,
    phone,
    balance: 0,
    credit_limit: limit,
    stamps: 0,
    notes
  };
  customers.unshift(newCust);
  renderCustomers();
  updateDashboardMetrics();
}

document.getElementById("customerSearch").addEventListener("input", renderCustomers);

// ----------------------------------------------------------------------------
// Credit Tabs & Purchases
// ----------------------------------------------------------------------------
function renderCustomerOptions() {
  const select = document.getElementById("purchaseCustomer");
  const previousValue = select.value;
  select.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a customer";
  select.appendChild(placeholder);

  customers.forEach(customer => {
    const balance = customer.balance || 0;
    const limit = customer.credit_limit || customer.creditLimit || 350;
    const option = document.createElement("option");
    option.value = customer.id;
    option.textContent = `${customer.name} (Tab: R${balance.toFixed(2)} / Limit: R${limit.toFixed(2)})`;
    select.appendChild(option);
  });

  if (customers.some(c => c.id === previousValue)) {
    select.value = previousValue;
  }
}

function renderPurchases() {
  const list = document.getElementById("purchaseList");
  const empty = document.getElementById("purchaseEmpty");
  const search = document.getElementById("tabSearch").value.trim().toLowerCase();

  list.replaceChildren();

  const filtered = purchases.filter(p => {
    const cName = (p.customer_name || p.customerName || "").toLowerCase();
    const cId = (p.customer_id || p.customerId || "").toLowerCase();
    const desc = (p.description || "").toLowerCase();
    return cName.includes(search) || cId.includes(search) || desc.includes(search);
  });

  filtered.forEach(p => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(p.customer_name || p.customerName)}</strong> <span class="muted-small">(${p.customer_id || p.customerId})</span></td>
      <td>${escapeHtml(p.description)}</td>
      <td><strong>R${Number(p.amount).toFixed(2)}</strong></td>
      <td>${escapeHtml(p.created_at || p.date)}</td>
    `;
    list.appendChild(row);
  });

  empty.hidden = filtered.length > 0;
  const total = customers.reduce((sum, c) => sum + (c.balance || 0), 0);
  const owing = customers.filter(c => (c.balance || 0) > 0).length;

  document.getElementById("totalOutstanding").textContent = `R${total.toFixed(2)}`;
  document.getElementById("customersWithTabs").textContent = owing;
  document.getElementById("outstanding").textContent = `R${total.toFixed(2)}`;
}

document.getElementById("purchaseForm").addEventListener("submit", async event => {
  event.preventDefault();
  const customerId = document.getElementById("purchaseCustomer").value;
  const description = document.getElementById("purchaseDescription").value.trim();
  const amount = Number(document.getElementById("purchaseAmount").value);

  const customer = customers.find(c => c.id === customerId);
  if (!customer) {
    showToast("Please choose a customer first.", "warning");
    return;
  }

  if (!description || !Number.isFinite(amount) || amount <= 0) {
    showToast("Please enter valid items and amount.", "warning");
    return;
  }

  if (backendOnline) {
    try {
      const res = await fetch(`${API_BASE}/purchases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId, description, amount })
      });
      if (!res.ok) throw new Error("Purchase creation failed on server");
      await syncWithBackend();
    } catch (e) {
      console.warn("Backend error, recording purchase locally:", e);
      recordPurchaseLocally(customer, description, amount);
    }
  } else {
    recordPurchaseLocally(customer, description, amount);
  }

  event.target.reset();
  playSound("success");
  showToast(`R${amount.toFixed(2)} recorded on ${customer.name}'s tab.`, "tab");
});

function recordPurchaseLocally(customer, description, amount) {
  customer.balance = Math.round(((customer.balance || 0) + amount) * 100) / 100;
  if (description.toLowerCase().includes("bread")) {
    customer.stamps = ((customer.stamps || 0) + 1) % 10;
  }
  purchases.unshift({
    id: `PUR-${nextPurchaseNumber++}`,
    customer_id: customer.id,
    customer_name: customer.name,
    description,
    amount,
    created_at: new Date().toLocaleDateString("en-ZA")
  });
  renderPurchases();
  renderCustomers();
  updateDashboardMetrics();
}

document.getElementById("tabSearch").addEventListener("input", renderPurchases);

// ----------------------------------------------------------------------------
// Repayments
// ----------------------------------------------------------------------------
function renderRepaymentCustomers() {
  const select = document.getElementById("repaymentCustomer");
  const previousValue = select.value;
  select.innerHTML = '<option value="">Select customer owing tab</option>';

  customers.forEach(customer => {
    const bal = customer.balance || 0;
    if (bal > 0) {
      const option = document.createElement("option");
      option.value = customer.id;
      option.textContent = `${customer.name} — Owes R${bal.toFixed(2)}`;
      select.appendChild(option);
    }
  });

  if ([...select.options].some(o => o.value === previousValue)) {
    select.value = previousValue;
  }
}

function updateRepaymentBalance() {
  const select = document.getElementById("repaymentCustomer");
  const customer = customers.find(c => c.id === select.value);
  document.getElementById("repaymentBalance").textContent = customer
    ? `R${(customer.balance || 0).toFixed(2)}`
    : "R0.00";
}

document.getElementById("repaymentCustomer").addEventListener("change", updateRepaymentBalance);

function renderRepayments() {
  const list = document.getElementById("repaymentList");
  const empty = document.getElementById("repaymentEmpty");
  list.replaceChildren();

  repayments.forEach(r => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><code>${r.id}</code></td>
      <td><strong>${escapeHtml(r.customer_name || r.customerName)}</strong></td>
      <td><strong style="color: #15803d">R${Number(r.amount).toFixed(2)}</strong></td>
      <td>${escapeHtml(r.method || 'Cash')}</td>
      <td>${escapeHtml(r.created_at || r.date)}</td>
      <td>${escapeHtml(r.note || '—')}</td>
    `;
    list.appendChild(row);
  });

  empty.hidden = repayments.length > 0;
}

document.getElementById("repaymentForm").addEventListener("submit", async event => {
  event.preventDefault();
  const customerId = document.getElementById("repaymentCustomer").value;
  const amount = Number(document.getElementById("repaymentAmount").value);
  const method = document.getElementById("repaymentMethod").value;
  const note = document.getElementById("repaymentNote").value.trim();

  const customer = customers.find(c => c.id === customerId);
  if (!customer) {
    showToast("Please choose a customer with an active tab.", "warning");
    return;
  }

  if (backendOnline) {
    try {
      const res = await fetch(`${API_BASE}/repayments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId, amount, method, note })
      });
      if (!res.ok) throw new Error("Repayment creation failed on server");
      await syncWithBackend();
    } catch (e) {
      console.warn("Backend error, recording repayment locally:", e);
      recordRepaymentLocally(customer, amount, method, note);
    }
  } else {
    recordRepaymentLocally(customer, amount, method, note);
  }

  event.target.reset();
  playSound("success");
  showToast(`Repayment of R${amount.toFixed(2)} recorded for ${customer.name}.`, "money");
});

function recordRepaymentLocally(customer, amount, method, note) {
  customer.balance = Math.max(0, Math.round(((customer.balance || 0) - amount) * 100) / 100);
  repayments.unshift({
    id: `RP-${String(nextRepaymentNumber++).padStart(4, "0")}`,
    customer_id: customer.id,
    customer_name: customer.name,
    amount,
    method,
    created_at: new Date().toLocaleDateString("en-ZA"),
    note: note || "Counter repayment"
  });
  renderRepaymentCustomers();
  renderRepayments();
  renderCustomers();
  renderPurchases();
  updateRepaymentBalance();
  updateDashboardMetrics();
}

document.getElementById("triggerOpenPaymentsRepaymentBtn").addEventListener("click", () => {
  const customerId = document.getElementById("repaymentCustomer").value || "CUST-001";
  const amount = Number(document.getElementById("repaymentAmount").value) || 50.00;
  openOpenPaymentsModal(customerId, amount);
});

// ----------------------------------------------------------------------------
// Spaza Uniti Offerings & Promotions
// ----------------------------------------------------------------------------
function renderPromotions() {
  const container = document.getElementById("promotionsContainer");
  const countBadge = document.getElementById("promoCountBadge");
  container.replaceChildren();

  const activePromos = promotions.filter(p => p.active);
  countBadge.textContent = `${activePromos.length} active`;

  activePromos.forEach(promo => {
    const card = document.createElement("article");
    card.className = "promo-card";
    const origPrice = promo.original_price || promo.originalPrice || 20;
    const promoPrice = promo.promo_price || promo.promoPrice || 16;
    const discountPct = promo.discount_pct || promo.discountPct || 15;
    const daysLeft = promo.days_left || promo.daysLeft || 3;

    card.innerHTML = `
      <div class="promo-header">
        <div>
          <span class="card-pill live-pill">Live on Spaza Uniti</span>
          <h4 style="margin-top: 6px;">${escapeHtml(promo.title)}</h4>
          <span class="muted-small">Category: ${escapeHtml(promo.category)}</span>
        </div>
        <span class="promo-badge">${discountPct}% OFF</span>
      </div>
      <div class="promo-prices">
        <span class="promo-original">R${origPrice.toFixed(2)}</span>
        <span class="promo-special">R${promoPrice.toFixed(2)}</span>
      </div>
      <div class="promo-footer">
        <span><svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24" style="vertical-align: -1px; margin-right: 3px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Expires in ${daysLeft} days</span>
        <span style="color: #059669; font-weight: 600;"><svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24" style="vertical-align: -1px; margin-right: 2px;"><polyline points="20 6 9 17 4 12"/></svg> Visible to nearby shoppers</span>
      </div>
    `;
    container.appendChild(card);
  });
}

document.getElementById("newPromoBtn").addEventListener("click", () => {
  document.getElementById("promoFormContainer").hidden = false;
  document.getElementById("promoTitle").focus();
});

document.getElementById("cancelPromoBtn").addEventListener("click", () => {
  document.getElementById("promoForm").reset();
  document.getElementById("promoFormContainer").hidden = true;
});

document.getElementById("promoForm").addEventListener("submit", async event => {
  event.preventDefault();
  const title = document.getElementById("promoTitle").value.trim();
  const category = document.getElementById("promoCategory").value;
  const originalPrice = Number(document.getElementById("promoOriginalPrice").value) || 20;
  const promoPrice = Number(document.getElementById("promoDiscountPrice").value);
  const days = Number(document.getElementById("promoDays").value) || 3;

  if (backendOnline) {
    try {
      const res = await fetch(`${API_BASE}/promotions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          original_price: originalPrice,
          promo_price: promoPrice,
          days_left: days
        })
      });
      if (!res.ok) throw new Error("Promotion creation failed on server");
      await syncWithBackend();
    } catch (e) {
      console.warn("Backend error, adding promotion locally:", e);
      addPromoLocally(title, category, originalPrice, promoPrice, days);
    }
  } else {
    addPromoLocally(title, category, originalPrice, promoPrice, days);
  }

  event.target.reset();
  document.getElementById("promoFormContainer").hidden = true;
  playSound("success");
  showToast(`Promotion "${title}" broadcast to Spaza Uniti shoppers!`, "globe");
});

function addPromoLocally(title, category, originalPrice, promoPrice, days) {
  const discountPct = Math.round(((originalPrice - promoPrice) / originalPrice) * 100);
  promotions.unshift({
    id: `PROMO-${String(nextPromoNumber++).padStart(3, "0")}`,
    title,
    category,
    original_price: originalPrice,
    promo_price: promoPrice,
    discount_pct: discountPct > 0 ? discountPct : 15,
    days_left: days,
    active: true
  });
  renderPromotions();
  updateDashboardMetrics();
}

document.getElementById("editLoyaltyBtn").addEventListener("click", async () => {
  const newRule = prompt("Configure Loyalty Program Rule:", loyaltyProgram.reward_description || loyaltyProgram.rewardDescription);
  if (newRule && newRule.trim()) {
    loyaltyProgram.reward_description = newRule.trim();
    document.getElementById("loyaltyRule").textContent = newRule.trim();

    if (backendOnline) {
      try {
        await fetch(`${API_BASE}/loyalty`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reward_description: newRule.trim() })
        });
      } catch (e) {
        console.warn("Could not save loyalty rule to server:", e);
      }
    }
    showToast("Loyalty program rules updated and synced to Spaza Uniti!", "celebrate");
  }
});

// ----------------------------------------------------------------------------
// Open Payments & Interledger Modal
// ----------------------------------------------------------------------------
async function openOpenPaymentsModal(customerId, amount = 50.00) {
  const customer = customers.find(c => c.id === customerId) || customers[0];
  activeOpContext = {
    customerId: customer.id,
    customerName: customer.name,
    amount: amount,
    purpose: "Tab Repayment"
  };

  document.getElementById("opModalAmount").textContent = `R${amount.toFixed(2)} ZAR`;
  document.getElementById("opModalCustomer").textContent = `${customer.name} (Tab Repayment)`;
  openPaymentsModal.hidden = false;

  if (backendOnline) {
    try {
      const res = await fetch(`${API_BASE}/open-payments/create-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customer.id, amount, purpose: "Tab Repayment" })
      });
      const data = await res.json();
      console.log("Created Open Payments incoming-payment request:", data);
    } catch (e) {
      console.warn("Open Payments request creation note:", e);
    }
  }
}

document.getElementById("closeOpModalBtn").addEventListener("click", () => {
  openPaymentsModal.hidden = true;
});

openPaymentsModal.addEventListener("click", event => {
  if (event.target === openPaymentsModal) {
    openPaymentsModal.hidden = true;
  }
});

document.getElementById("simulateCustomerPaymentBtn").addEventListener("click", async () => {
  const btn = document.getElementById("simulateCustomerPaymentBtn");
  btn.disabled = true;
  btn.textContent = "Streaming ILP Packets...";

  if (backendOnline) {
    try {
      await fetch(`${API_BASE}/open-payments/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: activeOpContext.customerId,
          amount: activeOpContext.amount,
          payment_reference: "$ilp.rafiki.money/unit-104"
        })
      });
      await syncWithBackend();
    } catch (e) {
      console.warn("Simulate payment error, falling back locally:", e);
      simulatePaymentLocally();
    }
  } else {
    simulatePaymentLocally();
  }

  setTimeout(() => {
    playSound("ilp");
    openPaymentsModal.hidden = true;
    btn.disabled = false;
    btn.textContent = "Simulate Customer ILP Transfer Now";
    showToast(`Open Payments Received: R${activeOpContext.amount.toFixed(2)} from ${activeOpContext.customerName}. Tab automatically credited!`, "ilp", 6000);
  }, 700);
});

function simulatePaymentLocally() {
  const customer = customers.find(c => c.id === activeOpContext.customerId);
  const settledAmount = activeOpContext.amount;

  if (customer && customer.balance > 0) {
    const deduction = Math.min(settledAmount, customer.balance);
    customer.balance = Math.round((customer.balance - deduction) * 100) / 100;
  }

  repayments.unshift({
    id: `RP-${String(nextRepaymentNumber++).padStart(4, "0")}`,
    customer_id: activeOpContext.customerId,
    customer_name: activeOpContext.customerName,
    amount: settledAmount,
    method: "Open Payments",
    created_at: new Date().toLocaleDateString("en-ZA"),
    note: "Interledger ILP Settlement ($ilp.rafiki.money/unit-104)"
  });

  renderCustomers();
  renderRepayments();
  renderPurchases();
  updateDashboardMetrics();
}

// ----------------------------------------------------------------------------
// Agentic AI Co-Pilot Engine (Communicates with Backend API)
// ----------------------------------------------------------------------------
let agentChatHistory = [];

async function processAgentCommand(userInput) {
  if (!userInput || !userInput.trim()) return;
  const input = userInput.trim();

  const respArea = document.getElementById("quickAgentResponseArea");
  const respBadge = document.getElementById("quickResponseBadge");
  const respText = document.getElementById("quickResponseText");
  const quickSendBtn = document.getElementById("quickSendBtn");

  if (respArea) {
    respArea.hidden = false;
    respBadge.textContent = "Thinking...";
    respBadge.className = "quick-response-badge thinking";
    respText.innerHTML = `<span style="opacity: 0.75;">Mkhulu is consulting the store ledger...</span>`;
  }
  if (quickSendBtn) {
    quickSendBtn.disabled = true;
    quickSendBtn.textContent = "Processing...";
  }

  appendChatMessage(input, "user");

  if (backendOnline) {
    try {
      const res = await fetch(`${API_BASE}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_input: input, unit_id: "unit-104", history: agentChatHistory })
      });
      const data = await res.json();

      let toolCallStr = null;
      if (data.tool_called) {
        toolCallStr = `Tool Call: ${data.tool_called}(${JSON.stringify(data.tool_parameters, null, 2)})`;
      }

      agentChatHistory.push({ role: "user", content: input });
      agentChatHistory.push({ role: "model", content: data.response_text });
      if (agentChatHistory.length > 12) agentChatHistory = agentChatHistory.slice(-12);

      appendChatMessage(data.response_text, "bot", toolCallStr);

      if (respArea) {
        respBadge.textContent = data.tool_called ? data.tool_called.replace(/_/g, " ") : "Mkhulu Answer";
        respBadge.className = "quick-response-badge";
        respText.innerHTML = escapeHtml(data.response_text)
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>');
      }

      await syncWithBackend();

      const transactionTools = ["record_tab_purchase", "record_tab_repayment", "create_promotion"];
      if (data.data_mutation && transactionTools.includes(data.tool_called)) {
        playSound("success");
        showToast(`Transaction logged: ${data.tool_called.replace(/_/g, " ")}`, "mic");
      }
      return;
    } catch (err) {
      console.warn("Backend chat failed, using local agent fallback:", err);
    } finally {
      if (quickSendBtn) {
        quickSendBtn.disabled = false;
        quickSendBtn.textContent = "Process with Agent";
      }
    }
  }

  // Local fallback
  fallbackProcessAgentCommand(input);
  if (quickSendBtn) {
    quickSendBtn.disabled = false;
    quickSendBtn.textContent = "Process with Agent";
  }
}

function fallbackProcessAgentCommand(input) {
  const lower = input.toLowerCase();

  // Find customer dynamically from active customers array
  let cust = customers.find(c => lower.includes(c.name.toLowerCase()) || lower.includes(c.name.split(" ")[0].toLowerCase()));
  if (!cust) cust = customers[0];

  if (lower.includes("credit") || lower.includes("tab") || lower.includes("took") || lower.includes("bought")) {
    let amount = 35.00;
    let items = "Counter groceries on tab";

    // Check for multiplication: e.g. "5 bags of Simbas, R18 each"
    const multMatch = lower.match(/(\d+)\s+([a-zA-Z\s]+?)[,\s]+(?:at\s+)?[rR]?\s*(\d+(?:\.\d{1,2})?)\s*(?:each|ea|\/each)?/);
    if (multMatch && (lower.includes("each") || lower.includes("at") || lower.includes("ea"))) {
      const qty = parseInt(multMatch[1], 10);
      const rawItem = multMatch[2].trim();
      const unitPrice = parseFloat(multMatch[3]);
      amount = Math.round(qty * unitPrice * 100) / 100;
      items = `${qty} ${rawItem}`;
    } else {
      const amountMatch = lower.match(/r\s*(\d+(\.\d{1,2})?)/) || lower.match(/(\d+(\.\d{1,2})?)\s*rand/) || lower.match(/(\d+(\.\d{1,2})?)/);
      if (amountMatch) amount = parseFloat(amountMatch[1]);
    }

    cust.balance = Math.round(((cust.balance || 0) + amount) * 100) / 100;
    purchases.unshift({
      id: `PUR-${nextPurchaseNumber++}`,
      customer_id: cust.id,
      customer_name: cust.name,
      description: items,
      amount,
      created_at: new Date().toLocaleDateString("en-ZA")
    });

    renderPurchases();
    renderCustomers();
    updateDashboardMetrics();
    playSound("success");

    const toolExecution = `Tool Call: record_tab_purchase({\n  customer: "${cust.name}",\n  items: "${items}",\n  amount: R${amount.toFixed(2)}\n})`;
    appendChatMessage(`Got it Baba! Recorded R${amount.toFixed(2)} on **${cust.name}**'s tab for *${items}*.\nRemaining balance: **R${cust.balance.toFixed(2)}**.`, "bot", toolExecution);
    showToast(`Agent logged: R${amount.toFixed(2)} on ${cust.name}'s tab`, "mic");
    return;
  }

  appendChatMessage(`I heard: "${input}". You can ask me to log credit tabs (*"Sipho took bread, R34"*), log repayments (*"Thabo paid R50"*), or launch promotions for your Unit on Spaza Uniti!`, "bot");
}

function appendChatMessage(text, sender = "bot", toolCall = null) {
  const msgDiv = document.createElement("div");
  msgDiv.className = `agent-msg ${sender}`;

  let contentHtml = `<div class="msg-bubble">${escapeHtml(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')}</div>`;

  if (toolCall) {
    contentHtml += `<div class="tool-call-pill"><span class="tool-badge"><svg class="ui-icon ui-icon-xs" viewBox="0 0 24 24" style="vertical-align: -1px; margin-right: 4px;"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>AGENT TOOL EXECUTION</span><pre style="margin: 0; font-size: 11px;">${escapeHtml(toolCall)}</pre></div>`;
  }

  contentHtml += `<div class="msg-time">Just now</div>`;
  msgDiv.innerHTML = contentHtml;
  agentChatFeed.appendChild(msgDiv);
  agentChatFeed.scrollTop = agentChatFeed.scrollHeight;
}

document.getElementById("quickVoiceForm").addEventListener("submit", event => {
  event.preventDefault();
  const input = document.getElementById("quickCommandInput");
  const val = input.value.trim();
  if (val) {
    processAgentCommand(val);
    input.value = "";
  }
});

document.querySelectorAll(".prompt-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const cmd = chip.dataset.command;
    document.getElementById("quickCommandInput").value = cmd;
    processAgentCommand(cmd);
  });
});

document.getElementById("openAgentModalBtn").addEventListener("click", () => {
  agentModalBackdrop.hidden = false;
  document.getElementById("agentModalInput").focus();
});

document.getElementById("closeAgentModalBtn").addEventListener("click", () => {
  agentModalBackdrop.hidden = true;
});

agentModalBackdrop.addEventListener("click", event => {
  if (event.target === agentModalBackdrop) {
    agentModalBackdrop.hidden = true;
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    agentModalBackdrop.hidden = true;
    openPaymentsModal.hidden = true;
    if (voiceSimModal) voiceSimModal.hidden = true;
    const custForm = document.getElementById("customerFormContainer");
    if (custForm) custForm.hidden = true;
    const promoForm = document.getElementById("promoFormContainer");
    if (promoForm) promoForm.hidden = true;
  }
});

document.getElementById("modalSendBtn").addEventListener("click", () => {
  const input = document.getElementById("agentModalInput");
  const val = input.value.trim();
  if (val) {
    processAgentCommand(val);
    input.value = "";
  }
});

document.getElementById("agentModalInput").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    const val = event.target.value.trim();
    if (val) {
      processAgentCommand(val);
      event.target.value = "";
    }
  }
});

// ----------------------------------------------------------------------------
// Speech-to-Text Recognition (Web Speech API)
// ----------------------------------------------------------------------------
let recognition = null;
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-ZA";

  recognition.onstart = () => {
    document.querySelectorAll(".mic-btn").forEach(btn => btn.classList.add("listening"));
    const label = document.getElementById("micStatusLabel");
    if (label) label.hidden = false;
  };

  recognition.onresult = event => {
    const transcript = event.results[0][0].transcript;
    document.getElementById("quickCommandInput").value = transcript;
    document.getElementById("agentModalInput").value = transcript;
    processAgentCommand(transcript);
  };

  recognition.onerror = event => {
    console.warn("Speech recognition error:", event.error);
    document.querySelectorAll(".mic-btn").forEach(btn => btn.classList.remove("listening"));
    const label = document.getElementById("micStatusLabel");
    if (label) label.hidden = true;

    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      showToast("Microphone access blocked by browser. Opening Voice Simulator so you can test!", "warning", 4500);
      openVoiceSimModal();
    } else if (event.error === "no-speech") {
      showToast("No speech detected. Select a simulated voice memo below to test.", "info", 4000);
      openVoiceSimModal();
    } else if (event.error === "audio-capture") {
      showToast("No microphone detected. Switched to Voice Note Simulator!", "warning", 4500);
      openVoiceSimModal();
    } else if (event.error === "network") {
      showToast("Speech recognition network unreachable. Opening Voice Simulator!", "warning", 4500);
      openVoiceSimModal();
    } else {
      showToast("Voice recognition notice (" + event.error + "). Opening Voice Simulator!", "info", 4000);
      openVoiceSimModal();
    }
  };

  recognition.onend = () => {
    document.querySelectorAll(".mic-btn").forEach(btn => btn.classList.remove("listening"));
    const label = document.getElementById("micStatusLabel");
    if (label) label.hidden = true;
  };
}

function triggerVoiceCapture() {
  if (recognition) {
    try {
      recognition.start();
      showToast("Listening... Speak your counter instruction now.", "mic");
    } catch (e) {
      console.warn("Recognition start notice:", e);
      openVoiceSimModal();
    }
  } else {
    showToast("Browser Speech API not available. Opening Voice Simulator!", "info");
    openVoiceSimModal();
  }
}

function openVoiceSimModal() {
  if (voiceSimModal) voiceSimModal.hidden = false;
}

function closeVoiceSimModal() {
  if (voiceSimModal) voiceSimModal.hidden = true;
}

function simulateVoiceMemo(memoText) {
  if (!memoText) return;

  closeVoiceSimModal();
  playSound("voice_start");
  showToast("Transcribing voice memo...", "mic", 2500);

  document.querySelectorAll(".mic-btn").forEach(btn => btn.classList.add("listening"));
  const label = document.getElementById("micStatusLabel");
  if (label) {
    label.innerHTML = `<span class="recording-indicator"></span> Transcribing voice memo: "${escapeHtml(memoText)}"`;
    label.hidden = false;
  }

  const quickInput = document.getElementById("quickCommandInput");
  const modalInput = document.getElementById("agentModalInput");
  quickInput.value = "";
  modalInput.value = "";

  let charIndex = 0;
  const chunk = Math.max(1, Math.floor(memoText.length / 15));
  const interval = setInterval(() => {
    charIndex += chunk;
    const current = memoText.slice(0, charIndex);
    quickInput.value = current;
    modalInput.value = current;

    if (charIndex >= memoText.length) {
      clearInterval(interval);
      setTimeout(() => {
        document.querySelectorAll(".mic-btn").forEach(btn => btn.classList.remove("listening"));
        if (label) label.hidden = true;
        playSound("voice_end");
        processAgentCommand(memoText);
      }, 350);
    }
  }, 40);
}

document.getElementById("openVoiceSimBtn").addEventListener("click", openVoiceSimModal);
const modalVoiceSimBtn = document.getElementById("modalVoiceSimBtn");
if (modalVoiceSimBtn) modalVoiceSimBtn.addEventListener("click", openVoiceSimModal);

const closeVoiceSimBtn = document.getElementById("closeVoiceSimBtn");
if (closeVoiceSimBtn) closeVoiceSimBtn.addEventListener("click", closeVoiceSimModal);

if (voiceSimModal) {
  voiceSimModal.addEventListener("click", event => {
    if (event.target === voiceSimModal) {
      closeVoiceSimModal();
    }
  });
}

document.querySelectorAll(".voice-sim-card").forEach(card => {
  card.addEventListener("click", () => {
    const memo = card.dataset.memo;
    if (memo) simulateVoiceMemo(memo);
  });
});

const simulateCustomVoiceBtn = document.getElementById("simulateCustomVoiceBtn");
const customVoiceMemoInput = document.getElementById("customVoiceMemoInput");
if (simulateCustomVoiceBtn && customVoiceMemoInput) {
  simulateCustomVoiceBtn.addEventListener("click", () => {
    const val = customVoiceMemoInput.value.trim();
    if (val) {
      simulateVoiceMemo(val);
      customVoiceMemoInput.value = "";
    }
  });

  customVoiceMemoInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      const val = event.target.value.trim();
      if (val) {
        simulateVoiceMemo(val);
        event.target.value = "";
      }
    }
  });
}

document.getElementById("quickMicBtn").addEventListener("click", triggerVoiceCapture);
document.getElementById("modalMicBtn").addEventListener("click", triggerVoiceCapture);

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ----------------------------------------------------------------------------
// App Initialization
// ----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  if (agentModalBackdrop) agentModalBackdrop.hidden = true;
  if (openPaymentsModal) openPaymentsModal.hidden = true;
  if (voiceSimModal) voiceSimModal.hidden = true;

  const broadcastSwitch = document.getElementById("unitiBroadcastSwitch");
  if (broadcastSwitch) {
    broadcastSwitch.addEventListener("change", handleBroadcastToggleChange);
  }

  const sidebarBadge = document.getElementById("sidebarBroadcastBadge");
  if (sidebarBadge) {
    sidebarBadge.addEventListener("click", () => {
      openOfferings();
    });
  }

  openDashboard();
  syncWithBackend();
});

