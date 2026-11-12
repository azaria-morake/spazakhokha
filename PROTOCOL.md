# SpazaKhokha offline protocol v1 (lean hackathon version)

Amounts are **integer cents** (R32.00 = `3200`). Times are **Unix seconds**.
Crypto is **ECDSA P-256 + SHA-256**. Public keys are the 65-byte uncompressed point, signatures are
**raw 64 bytes (r‖s)**, both **base64url without padding**.

A signed message is `{ "payload": "<JSON string>", "sig": "<base64url>" }`. The signature covers the
exact payload string that is sent, so JS and Python never need to agree on JSON formatting.

## The three messages

**1. Allowance certificate** (signed by the issuer server, stored on the customer's phone)

```json
{ "v":1, "allowance_id":"al_9f3k", "device_pub":"<customer device public key>",
  "limit":10000, "tx_cap":5000, "expires_at":1800604800 }
```

**2. Payment request** (made by the owner's phone, shown as QR 1, **not signed**)

```json
{ "v":1, "request_id":"a1b2c3d4e5f60718", "wallet":"https://ilp.interledger-test.dev/spazakhokha-shop",
  "amount":3200, "ts":1800000000 }
```

**3. Payment note** (signed by the customer's device key, shown as QR 2 together with the certificate)

```json
{ "v":1, "allowance_id":"al_9f3k", "counter":1, "spent_before":0, "amount":3200,
  "request_id":"a1b2c3d4e5f60718", "wallet":"https://ilp.interledger-test.dev/spazakhokha-shop", "ts":1800000010 }
```

QR 2 contains `{ "cert": <signed cert>, "note": <signed note> }`, encoded with `encodeQR()` (about 860 characters).

## The flow

1. Owner: `newRequest()` and show QR 1.
2. Customer: scan, confirm, `buildPayment()`. **Save the returned state before showing QR 2.** Show QR 2.
3. Owner: scan, `verifyPayment()` offline. If ok: green screen, voice, `recordAccepted()`, store `accepted.pkg` for sync.
4. Later, owner uploads the stored packages to `POST /settle`. Server runs `process_batch()`, then pays the `PAYABLE` ones through Open Payments.

## Owner checks (offline.js `verifyPayment`) and reason codes

| Order | Check | Reason |
|---|---|---|
| 1 | Shape of cert, note and request | `MALFORMED` |
| 2 | Issuer signature on the certificate | `BAD_ISSUER_SIGNATURE` |
| 3 | Customer signature on the note (key from the certificate) | `BAD_NOTE_SIGNATURE` |
| 4 | Not expired by the owner's clock | `EXPIRED` |
| 5 | Note belongs to this allowance | `WRONG_ALLOWANCE` |
| 6 | Note answers **this** request | `WRONG_REQUEST` |
| 7 | Note is addressed to **this** shop's wallet | `WRONG_MERCHANT` |
| 8 | Amount equals the request | `WRONG_AMOUNT` |
| 9 | Amount ≤ per-transaction cap | `OVER_TX_CAP` |
| 10 | `spent_before + amount` ≤ limit | `OVER_LIMIT` |
| 11 | Counter higher than the last one this owner accepted for the allowance, and `spent_before` not lower than the last `spent_after` | `REPLAY` |

## Server settlement (offline_crypto.py `process_batch`)

Same signature and limit checks, plus: the note must name the uploading owner's wallet, the batch must
arrive within the grace window after expiry (default 14 days), and then per note:

| Status | Meaning |
|---|---|
| `PAYABLE` | Pay it. `amount` cents go to the owner's wallet via Open Payments. |
| `DUPLICATE` | Same payment uploaded twice (same allowance, request ID and wallet). Do not pay again. |
| `SHORT_PAID` | Valid, but the allowance has no headroom left. First presented wins, up to the limit. |
| `REJECTED` | Failed a check. `reason` says which. |

A payment is identified by its one-time **request ID**, not by the counter. If two different payments
share a counter, both compete for the remaining headroom and are flagged `COUNTER_REUSE` (a likely
rollback), which is the signal to block that device from new allowances.

## Who uses what

- **Person 1 (frontend):** import `frontend/offline.js`. Store the device `privateKey` (a CryptoKey) in
  IndexedDB, plus `customerState` and `ownerState` objects. Cache the issuer public key from `GET /issuer`.
- **Person 3 (backend):** `backend/offline_crypto.py`. Use `load_or_create_issuer_key("issuer.pem")`
  (add `*.pem` to `.gitignore`), `sign_certificate()` when the grant is approved, `process_batch()` in
  `POST /settle`. Replace the in-memory `Ledger` with a database table and make each note's
  check-and-commit one transaction, keeping the commit only if the Open Payments payment succeeds.
- **Person 2:** owns this folder and the tests.

Run the tests: `node --test frontend/offline.test.mjs` and `pytest backend/test_offline_crypto.py -v`
(requires Node 20+, Python 3.9+, `pip install cryptography pytest`).

## Deliberately not in the hackathon version (say so in the deck)

Revocation list and remote cancel, a PIN gate before signing, hardware-backed keys (Android Keystore),
compact binary QR encoding, a guarantee pool for short-paid notes, and owner-side detection of rollbacks
that happened at other shops. The offline check can only catch what the owner's own phone has seen, which
is why the server and the allowance limit are the real backstop.
