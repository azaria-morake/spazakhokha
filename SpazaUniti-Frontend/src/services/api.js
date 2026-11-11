/**
 * Spaza Uniti API Client
 * Connects to SpazaUniti-Backend (Port 8001)
 */

const API_BASE = "http://localhost:8001";

export async function fetchNearbyUnits(lat = -26.2234, lng = 27.8681, radiusKm = 5.0, filterType = "all") {
  try {
    let url = `${API_BASE}/api/units?lat=${lat}&lng=${lng}`;
    if (radiusKm) url += `&radius_km=${radiusKm}`;
    if (filterType && filterType !== "all") url += `&filter=${filterType}`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch units");
    return await res.json();
  } catch (err) {
    console.warn("Backend unavailable, using fallback:", err);
    return null;
  }
}

export async function fetchUnitDetail(unitId, lat = -26.2234, lng = 27.8681) {
  try {
    const res = await fetch(`${API_BASE}/api/units/${unitId}?lat=${lat}&lng=${lng}`);
    if (!res.ok) throw new Error("Unit not found");
    return await res.json();
  } catch (err) {
    console.warn("Unit detail fetch error:", err);
    return null;
  }
}

export async function fetchCustomer(username) {
  try {
    const res = await fetch(`${API_BASE}/api/customers/${username}`);
    if (!res.ok) throw new Error("Customer not found");
    return await res.json();
  } catch (err) {
    console.warn("Customer fetch error:", err);
    return null;
  }
}

export async function checkUsernameAvailability(username) {
  try {
    const res = await fetch(`${API_BASE}/api/customers/check-username/${username}`);
    return await res.json();
  } catch (err) {
    return { available: true };
  }
}

export async function registerCustomer(payload) {
  const res = await fetch(`${API_BASE}/api/customers/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Registration failed");
  }
  return await res.json();
}

export async function createOutgoingPaymentGrant(username, payload) {
  const res = await fetch(`${API_BASE}/api/wallets/${username}/outgoing-payments/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to create payment grant");
  }
  return await res.json();
}

export async function approveGrantOptionA(grantId) {
  const res = await fetch(`${API_BASE}/api/grants/${grantId}/approve`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Option A approval failed");
  return await res.json();
}

export async function verifyGrantOptionBPin(grantId, pin) {
  const res = await fetch(`${API_BASE}/api/grants/${grantId}/verify-pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Incorrect security PIN");
  }
  return await res.json();
}

export async function topUpWallet(username, amount, description = "Top Up") {
  const res = await fetch(`${API_BASE}/api/wallets/${username}/incoming-payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, description })
  });
  if (!res.ok) throw new Error("Top up failed");
  return await res.json();
}

export async function cashoutUbuntuTokens(username, unitId = "unit-104", amount = 20.00, purpose = "Taxi / Transportation Allowance") {
  const clean = username.replace(/^@/, '');
  const res = await fetch(`${API_BASE}/api/wallets/${clean}/cashout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ unit_id: unitId, amount, purpose })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Cash-out failed");
  }
  return await res.json();
}

export async function spendUbuntuTokens(username, unitId = "unit-104", amount = 16.00, purpose = "Marketplace Cart Discount") {
  const clean = username.replace(/^@/, '');
  const res = await fetch(`${API_BASE}/api/wallets/${clean}/spend-tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ unit_id: unitId, amount, purpose })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Token redemption failed");
  }
  return await res.json();
}

export async function searchConsumers(query, excludeUsername = "") {
  try {
    const params = new URLSearchParams({ q: query });
    if (excludeUsername) params.set("exclude", excludeUsername.replace(/^@/, ""));
    const res = await fetch(`${API_BASE}/api/customers/search?${params.toString()}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fundUbuWallet(username, amount, source = "OPEN_PAYMENTS", note = "Single Open Payments UBU Funding") {
  const clean = username.replace(/^@/, "");
  const res = await fetch(`${API_BASE}/api/wallets/${clean}/fund-ubu`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, source, note })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Funding UBU wallet failed");
  }
  return await res.json();
}

export async function addFamilyMember(familyUsername, payload) {
  const clean = familyUsername.replace(/^@/, "");
  const res = await fetch(`${API_BASE}/api/consumers/families/${clean}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to add family member");
  }
  return await res.json();
}

export async function updateFamilyMember(familyUsername, memberUsername, payload) {
  const fam = familyUsername.replace(/^@/, "");
  const mem = memberUsername.replace(/^@/, "");
  const res = await fetch(`${API_BASE}/api/consumers/families/${fam}/members/${mem}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to update member");
  }
  return await res.json();
}

export async function inviteBeneficiary(sponsorUsername, payload) {
  const clean = sponsorUsername.replace(/^@/, "");
  const res = await fetch(`${API_BASE}/api/consumers/${clean}/beneficiaries/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to send beneficiary invitation");
  }
  return await res.json();
}

export async function respondToInvitation(linkId, username, action) {
  const clean = username.replace(/^@/, "");
  const res = await fetch(`${API_BASE}/api/consumers/invitations/${linkId}/respond?username=${encodeURIComponent(clean)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to respond to invitation");
  }
  return await res.json();
}

export async function allocateToBeneficiary(sponsorUsername, linkId, payload) {
  const clean = sponsorUsername.replace(/^@/, "");
  const res = await fetch(`${API_BASE}/api/consumers/${clean}/beneficiaries/${linkId}/allocate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to allocate UBU");
  }
  return await res.json();
}

export async function removeBeneficiaryLink(username, linkId) {
  const clean = username.replace(/^@/, "");
  const res = await fetch(`${API_BASE}/api/consumers/${clean}/beneficiaries/${linkId}`, {
    method: "DELETE"
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to remove link");
  }
  return await res.json();
}

