# Spaza Uniti Backend • Customer Identity & Open Payments Engine

The independent platform backend for **Spaza Uniti**, powering customer onboarding, universal alphanumeric username handles, and two-tier Open Payments authorization.

---

## 1. Core Architecture

```
[Customer Experience]
   "My handle is @mannini"  (Simple, memorable, alphanumeric)
            │
            ▼
[Spaza Uniti Identity & Handle Registry]
   @mannini  ──> Maps to: $spazauniti.org/mannini
            │
            ▼
[Open Payments & ILP Engine]
   - Discovery: GET /{username} (RFC/Open Payments Spec)
   - Incoming Funds: Open & Pre-authorized (Tab repayments)
   - Outgoing Debits: Two-Tier Authorization
       ├── Option A (Primary): SMS/WhatsApp interactive link prompt
       └── Option B (Fallback): 4-Digit Counter PIN (Offline/High-latency)
```

---

## 2. API Endpoints

### Customer Registration & Discovery
- **`POST /api/customers/register`**: Instantly creates a customer, validates alphanumeric handle, generates their Open Payments ID, and sets up a 4-digit security PIN.
- **`GET /api/customers/{username}`**: Returns profile, wallet balance, and handle info.
- **`GET /api/customers/check-username/{username}`**: Real-time availability check.
- **`GET /api/resolve/{username}`**: Merchant resolver mapping `@username` to Open Payments wallet address.

### Open Payments Standard Spec
- **`GET /{username}`**: Standard Open Payments discovery document returning `assetCode: "ZAR"`, `assetScale: 2`, and auth/resource servers.

### Two-Tier Outgoing Payment Authorization
1. **Initiate Outgoing Payment**:
   `POST /api/wallets/{username}/outgoing-payments/request`
   Returns `grant_id`, `PENDING_CONSENT`, interactive link, and PIN fallback availability.
2. **Option A (Interactive Link)**:
   Shopper opens `GET /consent/{grant_id}` and taps **Approve**.
   `POST /api/grants/{grant_id}/approve`
3. **Option B (Counter PIN Fallback)**:
   If SMS/WhatsApp is delayed, shopper enters their 4-digit PIN at the counter POS.
   `POST /api/grants/{grant_id}/verify-pin` with `{"pin": "1234"}`

---

## 3. Running the Server

```bash
cd SpazaUniti-Backend
./run.sh
```
Runs on **`http://localhost:8001`** by default.
