const API_BASE = "http://localhost:8000/api";

export async function checkBackendHealth() {
  try {
    const res = await fetch("http://localhost:8000/", { cache: "no-store" });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function fetchDashboard() {
  try {
    const res = await fetch(`${API_BASE}/dashboard`);
    if (!res.ok) throw new Error("Dashboard fetch failed");
    return await res.json();
  } catch (e) {
    console.warn("Using local dashboard metrics:", e);
    return null;
  }
}

export async function fetchCustomers() {
  try {
    const res = await fetch(`${API_BASE}/customers`);
    if (!res.ok) throw new Error("Customers fetch failed");
    return await res.json();
  } catch (e) {
    console.warn("Using local customers:", e);
    return [];
  }
}

export async function createCustomer(customerData) {
  const res = await fetch(`${API_BASE}/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(customerData),
  });
  if (!res.ok) throw new Error("Failed to register customer");
  return await res.json();
}

export async function fetchPurchases() {
  try {
    const res = await fetch(`${API_BASE}/purchases`);
    if (!res.ok) throw new Error("Purchases fetch failed");
    return await res.json();
  } catch (e) {
    return [];
  }
}

export async function createPurchase(purchaseData) {
  const res = await fetch(`${API_BASE}/purchases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(purchaseData),
  });
  if (!res.ok) throw new Error("Failed to record credit purchase");
  return await res.json();
}

export async function fetchRepayments() {
  try {
    const res = await fetch(`${API_BASE}/repayments`);
    if (!res.ok) throw new Error("Repayments fetch failed");
    return await res.json();
  } catch (e) {
    return [];
  }
}

export async function createRepayment(repaymentData) {
  const res = await fetch(`${API_BASE}/repayments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(repaymentData),
  });
  if (!res.ok) throw new Error("Failed to record repayment");
  return await res.json();
}

export async function fetchLoyaltyPrograms() {
  try {
    const res = await fetch(`${API_BASE}/loyalty`);
    if (!res.ok) throw new Error("Loyalty fetch failed");
    return await res.json();
  } catch (e) {
    console.warn("Using local loyalty fallback:", e);
    return [];
  }
}

export async function createLoyaltyProgram(progData) {
  const res = await fetch(`${API_BASE}/loyalty`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(progData),
  });
  if (!res.ok) throw new Error("Failed to create loyalty program");
  return await res.json();
}

export async function toggleLoyaltyProgram(id) {
  const res = await fetch(`${API_BASE}/loyalty/${id}/toggle`, {
    method: "PUT",
  });
  if (!res.ok) throw new Error("Failed to toggle loyalty program");
  return await res.json();
}

export async function deleteLoyaltyProgram(id) {
  const res = await fetch(`${API_BASE}/loyalty/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete loyalty program");
  return await res.json();
}

export async function fetchPromotions() {
  try {
    const res = await fetch(`${API_BASE}/promotions`);
    if (!res.ok) throw new Error("Promotions fetch failed");
    return await res.json();
  } catch (e) {
    return [];
  }
}

export async function createPromotion(promoData) {
  const res = await fetch(`${API_BASE}/promotions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(promoData),
  });
  if (!res.ok) throw new Error("Failed to create promotion");
  return await res.json();
}

export async function deletePromotion(id) {
  const res = await fetch(`${API_BASE}/promotions/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete promotion");
  return await res.json();
}

export async function fetchTransactions() {
  try {
    const res = await fetch(`${API_BASE}/transactions`);
    if (!res.ok) throw new Error("Transactions fetch failed");
    return await res.json();
  } catch (e) {
    return [];
  }
}

export async function toggleBroadcast(active) {
  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uniti_broadcast_active: active }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function sendAgentMessage(message, history = []) {
  const res = await fetch(`${API_BASE}/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) throw new Error("Agent request failed");
  return await res.json();
}
