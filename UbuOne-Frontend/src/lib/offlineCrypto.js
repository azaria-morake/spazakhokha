import jsQR from 'jsqr'
import QRCode from 'qrcode'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001'
const DB_NAME = 'spazakhokha_ubuone_keys'
const STORE_NAME = 'device_keys'
const ISSUER_PUB_KEY = 'spaza_issuer_pub'
const QUEUE_KEY = 'spaza_merchant_offline_queue'

export function b64uEncode(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let bin = ''
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64uDecode(str) {
  const pad = '='.repeat((4 - (str.length % 4)) % 4)
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function canonicalJson(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return JSON.stringify(obj)
  }
  const keys = Object.keys(obj).sort()
  return '{' + keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',') + '}'
}

function openKeyDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getOrCreateDeviceKeypair(actorHandle = 'default') {
  const keyId = `ecdsa_p256_${actorHandle}`
  const db = await openKeyDb()

  const existing = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(keyId)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })

  if (existing && existing.privateKey && existing.publicKeyB64u) {
    return existing
  }

  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign', 'verify']
  )
  const rawPub = await crypto.subtle.exportKey('raw', pair.publicKey)
  const record = {
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    publicKeyB64u: b64uEncode(rawPub),
  }

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).put(record, keyId)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })

  return record
}

export async function signPayload(privateKey, obj) {
  const payload = canonicalJson(obj)
  const encoded = new TextEncoder().encode(payload)
  const sigBuf = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoded
  )
  return {
    payload,
    sig: b64uEncode(sigBuf),
  }
}

export async function verifySigned(publicKeyB64u, signed) {
  try {
    if (!signed || typeof signed.payload !== 'string' || typeof signed.sig !== 'string') {
      return false
    }
    const rawSig = b64uDecode(signed.sig)
    if (rawSig.length !== 64) return false

    const rawPub = b64uDecode(publicKeyB64u)
    const pubKey = await crypto.subtle.importKey(
      'raw',
      rawPub,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    )
    const encoded = new TextEncoder().encode(signed.payload)
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pubKey,
      rawSig,
      encoded
    )
  } catch {
    return false
  }
}

export function getCachedIssuerPub() {
  return localStorage.getItem(ISSUER_PUB_KEY) || ''
}

export async function syncIssuerPublicKey() {
  try {
    const res = await fetch(`${API_BASE}/api/issuer`)
    if (!res.ok) return getCachedIssuerPub()
    const data = await res.json()
    if (data?.pub) {
      localStorage.setItem(ISSUER_PUB_KEY, data.pub)
      return data.pub
    }
  } catch {
    // Offline fallback
  }
  return getCachedIssuerPub()
}

function allowanceStorageKey(actorHandle) {
  return `spaza_offline_allowance_${(actorHandle || 'default').toLowerCase()}`
}

export function getSavedAllowance(actorHandle) {
  try {
    const raw = localStorage.getItem(allowanceStorageKey(actorHandle))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveAllowanceState(actorHandle, state) {
  localStorage.setItem(allowanceStorageKey(actorHandle), JSON.stringify(state))
}

export async function mintOfflineAllowance({
  actorHandle,
  limitCents,
  customerWallet = '',
  mode = 'demo',
}) {
  const kp = await getOrCreateDeviceKeypair(actorHandle)
  const res = await fetch(`${API_BASE}/api/allowances`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_pub: kp.publicKeyB64u,
      customer_wallet: customerWallet,
      limit_cents: Number(limitCents),
      return_to: window.location.origin,
      mode,
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.detail || 'Failed to mint offline allowance')
  }
  if (data.issuer_pub) {
    localStorage.setItem(ISSUER_PUB_KEY, data.issuer_pub)
  }
  if (data.cert) {
    const certObj = JSON.parse(data.cert.payload)
    const state = {
      allowanceId: data.allowance_id,
      cert: data.cert,
      limitCents: certObj.limit,
      txCapCents: certObj.tx_cap,
      expiresAt: certObj.expires_at,
      spentCents: 0,
      counter: 0,
      actorHandle,
    }
    saveAllowanceState(actorHandle, state)
    return { state, approvalUrl: null }
  }
  return { state: null, approvalUrl: data.approval_url, allowanceId: data.allowance_id }
}

export async function signOfflinePaymentNote({
  actorHandle,
  requestId,
  merchantWallet,
  amountCents,
  unitId = 'unit-104',
}) {
  const state = getSavedAllowance(actorHandle)
  if (!state || !state.cert) {
    throw new Error('No active offline allowance certificate found. Lock an allowance while online first.')
  }
  const nowSec = Math.floor(Date.now() / 1000)
  if (nowSec > state.expiresAt) {
    throw new Error('Offline allowance certificate has expired.')
  }
  if (amountCents <= 0 || amountCents > state.txCapCents) {
    throw new Error(`Amount exceeds per-transaction cap of R${(state.txCapCents / 100).toFixed(2)}.`)
  }
  if (state.spentCents + amountCents > state.limitCents) {
    throw new Error('Insufficient remaining offline allowance balance.')
  }

  const nextCounter = state.counter + 1
  const kp = await getOrCreateDeviceKeypair(actorHandle)
  const note = await signPayload(kp.privateKey, {
    v: 1,
    allowance_id: state.allowanceId,
    request_id: requestId,
    wallet: merchantWallet,
    amount: amountCents,
    counter: nextCounter,
    spent_before: state.spentCents,
    ts: nowSec,
  })

  const updated = {
    ...state,
    counter: nextCounter,
    spentCents: state.spentCents + amountCents,
  }
  saveAllowanceState(actorHandle, updated)

  return {
    package: {
      v: 1,
      type: 'SPAZAKHOKHA_PAY',
      unit_id: unitId,
      payer: actorHandle,
      cert: state.cert,
      note,
    },
    updatedState: updated,
  }
}

export function getMerchantOfflineQueue(unitId = 'unit-104') {
  try {
    const all = JSON.parse(localStorage.getItem(QUEUE_KEY) || '{}')
    return all[unitId] || []
  } catch {
    return []
  }
}

function saveMerchantOfflineQueue(unitId, items) {
  const all = JSON.parse(localStorage.getItem(QUEUE_KEY) || '{}')
  all[unitId] = items
  localStorage.setItem(QUEUE_KEY, JSON.stringify(all))
}

export async function verifyAndQueueOfflinePackage(pkg, expectedMerchantWallet, unitId = 'unit-104') {
  const issuerPub = getCachedIssuerPub()
  if (!issuerPub) {
    throw new Error('Issuer public key not cached yet. Connect briefly once to sync keys.')
  }
  if (!pkg || !pkg.cert || !pkg.note) {
    throw new Error('Malformed offline payment QR package.')
  }

  const certValid = await verifySigned(issuerPub, pkg.cert)
  if (!certValid) {
    throw new Error('REJECTED: Invalid Issuer signature on allowance certificate.')
  }
  const cert = JSON.parse(pkg.cert.payload)

  const noteValid = await verifySigned(cert.device_pub, pkg.note)
  if (!noteValid) {
    throw new Error('REJECTED: Customer ECDSA signature verification failed.')
  }
  const note = JSON.parse(pkg.note.payload)

  if (note.allowance_id !== cert.allowance_id) {
    throw new Error('REJECTED: Note allowance ID does not match certificate.')
  }
  if (expectedMerchantWallet && note.wallet !== expectedMerchantWallet) {
    throw new Error('REJECTED: Payment note is addressed to a different Spaza Unit.')
  }
  if (note.amount > cert.tx_cap || note.spent_before + note.amount > cert.limit) {
    throw new Error('REJECTED: Payment exceeds allowance or transaction cap.')
  }

  const queue = getMerchantOfflineQueue(unitId)
  const dup = queue.some(
    (entry) =>
      entry.notePayload.allowance_id === note.allowance_id &&
      entry.notePayload.request_id === note.request_id
  )
  if (dup) {
    throw new Error('DUPLICATE: This offline payment note is already queued.')
  }

  const entry = {
    id: `off_${Date.now()}_${note.counter}`,
    payer: pkg.payer || 'offline_customer',
    amountCents: note.amount,
    counter: note.counter,
    requestId: note.request_id,
    receivedAt: new Date().toISOString(),
    notePayload: note,
    package: { cert: pkg.cert, note: pkg.note },
    status: 'QUEUED_OFFLINE',
  }

  const nextQueue = [entry, ...queue]
  saveMerchantOfflineQueue(unitId, nextQueue)
  return { entry, queue: nextQueue }
}

export async function settleOfflineQueueBatch(merchantWallet, unitId = 'unit-104') {
  const queue = getMerchantOfflineQueue(unitId)
  if (!queue.length) {
    return { results: [], total_settled_zar: 0 }
  }

  const res = await fetch(`${API_BASE}/api/settle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet: merchantWallet,
      unit_id: unitId,
      packages: queue.map((q) => q.package),
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.detail || 'Batch settlement failed')
  }

  const remaining = []
  ;(data.results || []).forEach((r, idx) => {
    if (r.status === 'PAYMENT_FAILED') {
      remaining.push({ ...queue[idx], status: r.status, detail: r.detail })
    }
  })
  saveMerchantOfflineQueue(unitId, remaining)
  return { ...data, remainingCount: remaining.length }
}

export async function generateQrDataUrl(payloadObj) {
  const text = typeof payloadObj === 'string' ? payloadObj : JSON.stringify(payloadObj)
  return await QRCode.toDataURL(text, {
    width: 260,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0B1128', light: '#FFFFFF' },
  })
}

export function decodeQrFromImageData(imageData) {
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'dontInvert',
  })
  return code ? code.data : null
}
