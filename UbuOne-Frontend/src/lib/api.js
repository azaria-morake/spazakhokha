const API_BASE = import.meta.env.VITE_API_URL || ''
const TOKEN_KEY = 'ubuone_rbac_token'
const SESSION_TYPE_KEY = 'ubuone_session_type' // 'STAFF' | 'CONSUMER'

export const CUSTOMER_APP_URL = import.meta.env.VITE_CUSTOMER_APP_URL || 'http://localhost:3001'

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function getStoredSessionType() {
  try {
    return localStorage.getItem(SESSION_TYPE_KEY) || 'STAFF'
  } catch {
    return 'STAFF'
  }
}

export function setStoredSession(token, type = 'STAFF') {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(SESSION_TYPE_KEY, type)
    } else {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(SESSION_TYPE_KEY)
    }
  } catch {
    // ignore storage errors
  }
}

export function setStoredToken(token) {
  setStoredSession(token, token ? getStoredSessionType() : '')
}

async function apiFetch(path, options = {}) {
  const token = getStoredToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (token) {
    headers['X-UbuOne-Token'] = token
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { detail: text || 'Unexpected server response' }
  }

  if (!res.ok) {
    const message =
      typeof data?.detail === 'string'
        ? data.detail
        : Array.isArray(data?.detail)
          ? data.detail.map((e) => e.msg || JSON.stringify(e)).join(', ')
          : `Request failed (${res.status})`
    const err = new Error(message)
    err.status = res.status
    err.payload = data
    throw err
  }

  return data
}

// --- RBAC Auth (Unit Staff) ---
export async function loginUbuOne(username, passcode) {
  const data = await apiFetch('/api/ubuone/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: username.trim(), passcode: passcode.trim() }),
  })
  if (data.token) {
    setStoredSession(data.token, 'STAFF')
  }
  return data
}

export function fetchMe() {
  return apiFetch('/api/ubuone/auth/me')
}

export async function logoutUbuOne() {
  try {
    if (getStoredToken()) {
      await apiFetch('/api/ubuone/auth/logout', { method: 'POST' })
    }
  } catch {
    // clear local session regardless
  } finally {
    setStoredSession('', '')
  }
}

// --- Consumer & Family RBAC Auth ---
export async function loginConsumer(username, pin) {
  const data = await apiFetch('/api/ubuone/auth/consumer/login', {
    method: 'POST',
    body: JSON.stringify({ username: username.trim(), pin: pin.trim() }),
  })
  if (data.token) {
    setStoredSession(data.token, 'CONSUMER')
  }
  return data
}

export function fetchConsumerMe() {
  return apiFetch('/api/ubuone/auth/consumer/me')
}

export async function logoutConsumer() {
  try {
    if (getStoredToken()) {
      await apiFetch('/api/ubuone/auth/consumer/logout', { method: 'POST' })
    }
  } catch {
    // clear local session regardless
  } finally {
    setStoredSession('', '')
  }
}

export function registerConsumerAccount(payload) {
  return apiFetch('/api/customers/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchFamilyOverview(familyUsername) {
  return apiFetch(`/api/ubuone/families/${encodeURIComponent(familyUsername)}/overview`)
}

export function addFamilyMemberRBAC(familyUsername, payload) {
  return apiFetch(`/api/ubuone/families/${encodeURIComponent(familyUsername)}/members`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateFamilyMemberRBAC(familyUsername, memberUsername, payload) {
  return apiFetch(
    `/api/ubuone/families/${encodeURIComponent(familyUsername)}/members/${encodeURIComponent(memberUsername)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  )
}

export function fundFamilyPoolRBAC(familyUsername, payload) {
  return apiFetch(`/api/ubuone/families/${encodeURIComponent(familyUsername)}/fund`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchConsumerWorkspace(username) {
  return apiFetch(`/api/ubuone/consumers/${encodeURIComponent(username)}/workspace`)
}

export function payUnitFromConsumer(username, payload) {
  return apiFetch(`/api/ubuone/consumers/${encodeURIComponent(username)}/pay-unit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fundConsumerUbuRBAC(username, payload) {
  return apiFetch(`/api/ubuone/consumers/${encodeURIComponent(username)}/fund-ubu`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function inviteBeneficiaryRBAC(sponsorUsername, payload) {
  return apiFetch(`/api/ubuone/adults/${encodeURIComponent(sponsorUsername)}/beneficiaries/invite`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function respondInvitationRBAC(linkId, action) {
  return apiFetch(`/api/ubuone/adults/invitations/${encodeURIComponent(linkId)}/respond`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  })
}

export function allocateBeneficiaryRBAC(sponsorUsername, linkId, payload) {
  return apiFetch(
    `/api/ubuone/adults/${encodeURIComponent(sponsorUsername)}/beneficiaries/${encodeURIComponent(linkId)}/allocate`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
}

export function removeBeneficiaryRBAC(username, linkId) {
  return apiFetch(
    `/api/ubuone/adults/${encodeURIComponent(username)}/beneficiaries/${encodeURIComponent(linkId)}`,
    { method: 'DELETE' }
  )
}

export function cashoutConsumerTokens(username, unitId = 'unit-104', amount = 20.0, purpose = 'Taxi / Transport Cashout') {
  return apiFetch(`/api/wallets/${encodeURIComponent(username)}/cashout`, {
    method: 'POST',
    body: JSON.stringify({ unit_id: unitId, amount, purpose }),
  })
}

// --- Unit Overview & Counter Operations ---
export function fetchUnitOverview(unitId) {
  return apiFetch(`/api/ubuone/units/${encodeURIComponent(unitId)}/overview`)
}

export function searchConsumers(query, exclude = '') {
  const q = encodeURIComponent(query || '')
  const ex = exclude ? `&exclude=${encodeURIComponent(exclude)}` : ''
  return apiFetch(`/api/customers/search?q=${q}${ex}`)
}

export function fetchConsumerProfile(username) {
  const clean = encodeURIComponent(String(username || '').replace(/^@+/, '').trim().toLowerCase())
  return apiFetch(`/api/customers/${clean}`)
}

export function postCounterCharge(unitId, payload) {
  return apiFetch(`/api/ubuone/units/${encodeURIComponent(unitId)}/counter/charge`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function postChangeInUbu(unitId, payload) {
  return apiFetch(`/api/ubuone/units/${encodeURIComponent(unitId)}/counter/change-in-ubu`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// --- Settlements ---
export function postUnitSettlement(unitId, payload) {
  return apiFetch(`/api/ubuone/units/${encodeURIComponent(unitId)}/settlements`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// --- Loyalty Pacts, Specials & SpazaUniti Live Broadcast ---
export function fetchUnitLoyalty(unitId) {
  return apiFetch(`/api/ubuone/units/${encodeURIComponent(unitId)}/loyalty`)
}

export function createUnitLoyalty(unitId, payload) {
  return apiFetch(`/api/ubuone/units/${encodeURIComponent(unitId)}/loyalty`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function toggleUnitLoyalty(unitId, programId) {
  return apiFetch(`/api/ubuone/units/${encodeURIComponent(unitId)}/loyalty/${encodeURIComponent(programId)}/toggle`, {
    method: 'PUT',
  })
}

export function deleteUnitLoyalty(unitId, programId) {
  return apiFetch(`/api/ubuone/units/${encodeURIComponent(unitId)}/loyalty/${encodeURIComponent(programId)}`, {
    method: 'DELETE',
  })
}

export function fetchUnitPromotions(unitId) {
  return apiFetch(`/api/ubuone/units/${encodeURIComponent(unitId)}/promotions`)
}

export function createUnitPromo(unitId, payload) {
  return apiFetch(`/api/ubuone/units/${encodeURIComponent(unitId)}/promotions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteUnitPromo(unitId, promoId) {
  return apiFetch(`/api/ubuone/units/${encodeURIComponent(unitId)}/promotions/${encodeURIComponent(promoId)}`, {
    method: 'DELETE',
  })
}

export function toggleUnitBroadcast(unitId, enabled) {
  return apiFetch(`/api/ubuone/units/${encodeURIComponent(unitId)}/broadcast?enabled=${Boolean(enabled)}`, {
    method: 'PUT',
  })
}

// --- Staff RBAC ---
export function fetchUnitStaff(unitId) {
  return apiFetch(`/api/ubuone/units/${encodeURIComponent(unitId)}/staff`)
}

export function createUnitStaff(unitId, payload) {
  return apiFetch(`/api/ubuone/units/${encodeURIComponent(unitId)}/staff`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function toggleUnitStaff(unitId, staffId) {
  return apiFetch(`/api/ubuone/units/${encodeURIComponent(unitId)}/staff/${encodeURIComponent(staffId)}/toggle`, {
    method: 'PUT',
  })
}

// --- Network Admin Explorer ---
export function fetchAdminOverview() {
  return apiFetch('/api/ubuone/admin/overview')
}

