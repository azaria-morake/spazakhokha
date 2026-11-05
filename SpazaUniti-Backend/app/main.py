import os
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from .database import init_db, get_db, hash_pin
from .models import (
    CustomerRegisterRequest,
    CustomerResponse,
    WalletAddressResponse,
    CustomerResolveResponse,
    IncomingPaymentCreateRequest,
    IncomingPaymentResponse,
    OutgoingPaymentRequestCreate,
    GrantResponse,
    PinVerificationRequest,
    GrantApprovalResponse,
    TransactionResponse,
    UnitRegisterRequest,
    UnitBroadcastPayload,
    UnitSummaryResponse,
    UnitDetailResponse,
    CashoutRequest,
    CashoutResponse,
    SpendTokensRequest,
    SpendTokensResponse
)
from .resolver import resolve_username, get_wallet_address_doc, check_username_available, get_base_url
from .grants import create_outgoing_grant, approve_grant, verify_grant_with_pin, get_grant_details
from .discovery import get_nearby_units, get_unit_detail, sync_unit_broadcast


app = FastAPI(
    title="Spaza Uniti Backend - Customer Identity & Open Payments Network",
    description="Customer onboarding, universal alphanumeric username handles, and two-tier Open Payments authorization engine.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/")
def get_service_info():
    base_url = get_base_url()
    return {
        "service": "Spaza Uniti Customer & Open Payments Engine",
        "network": "Interledger Protocol / Open Payments ZAR",
        "open_payments_version": "1.0",
        "status": "online",
        "endpoints": {
            "register_customer": f"{base_url}/api/customers/register",
            "resolve_handle": f"{base_url}/api/resolve/{{username}}",
            "wallet_discovery": f"{base_url}/{{username}}",
            "outgoing_payment_request": f"{base_url}/api/wallets/{{username}}/outgoing-payments/request"
        }
    }

# -----------------------------------------------------------------------------
# 1. Customer Registration & Handle Provisioning
# -----------------------------------------------------------------------------
@app.post("/api/customers/register", response_model=CustomerResponse)
def register_customer(payload: CustomerRegisterRequest):
    """
    Instantly registers a customer on Spaza Uniti and generates their unique Open Payments ID.
    - Strictly alphanumeric username (@handle)
    - Automatically issued Open Payments wallet address
    - 4-digit PIN for Option B counter fallback
    """
    clean_user = payload.username.lower()

    # Verify uniqueness
    avail = check_username_available(clean_user)
    if not avail["available"]:
        raise HTTPException(status_code=400, detail=f"Username '@{clean_user}' is not available: {avail['reason']}")

    conn = get_db()
    cursor = conn.cursor()

    cust_id = f"cust_{uuid.uuid4().hex[:12]}"
    base_url = get_base_url()
    wallet_url = f"{base_url}/{clean_user}"
    op_id = f"${base_url.replace('http://', '').replace('https://', '')}/{clean_user}"
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    pin_hashed = hash_pin(payload.pin)

    # Initial welcome wallet balance: R100.00
    initial_balance = 100.00

    cursor.execute("""
    INSERT INTO customers (id, username, full_name, cell_number, pin_hash, wallet_address_url, balance, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?);
    """, (cust_id, clean_user, payload.full_name.strip(), payload.cell_number.strip(), pin_hashed, wallet_url, initial_balance, now_str))

    conn.commit()
    conn.close()

    return CustomerResponse(
        customer_id=cust_id,
        username=clean_user,
        handle=f"@{clean_user}",
        full_name=payload.full_name.strip(),
        cell_number=payload.cell_number.strip(),
        open_payments_id=op_id,
        wallet_address_url=wallet_url,
        balance=initial_balance,
        asset_code="ZAR",
        asset_scale=2,
        status="ACTIVE",
        created_at=now_str
    )

@app.get("/api/customers/check-username/{username}")
def check_username(username: str):
    """Real-time validation for alphanumeric username availability."""
    return check_username_available(username)

@app.get("/api/customers/{username}", response_model=CustomerResponse)
def get_customer(username: str):
    clean = username.strip().lower().lstrip("@")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers WHERE username = ?", (clean,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Customer @{clean} not found")

    cursor.execute("SELECT unit_id, ubu_balance FROM customer_tokens WHERE username = ?", (clean,))
    token_rows = cursor.fetchall()
    conn.close()

    tokens_map = {r["unit_id"]: float(r["ubu_balance"]) for r in token_rows}
    total_tokens = sum(tokens_map.values())
    is_cashout_eligible = total_tokens >= 20.0

    base_url = get_base_url()
    return CustomerResponse(
        customer_id=row["id"],
        username=row["username"],
        handle=f"@{row['username']}",
        full_name=row["full_name"],
        cell_number=row["cell_number"],
        open_payments_id=f"${base_url.replace('http://', '').replace('https://', '')}/{row['username']}",
        wallet_address_url=row["wallet_address_url"],
        balance=row["balance"],
        asset_code="ZAR",
        asset_scale=2,
        status=row["status"],
        created_at=row["created_at"],
        ubuntu_tokens=tokens_map,
        total_ubuntu_tokens=total_tokens,
        cashout_eligible=is_cashout_eligible,
        min_cashout_threshold=20.0
    )

@app.post("/api/wallets/{username}/cashout", response_model=CashoutResponse)
def cashout_ubuntu_tokens(username: str, payload: CashoutRequest):
    """
    R20 Ubuntu Token Open Payments Cash-Out:
    Allows community members to convert >= 20.00 UBU into fiat ZAR purchasing power
    (for transport, taxi fare, electricity or emergency cash-out).
    """
    clean = username.strip().lower().lstrip("@")
    if payload.amount < 20.0:
        raise HTTPException(
            status_code=400, 
            detail=f"Minimum cash-out threshold is 20.00 Ubuntu Tokens (R20.00 taxi fare equivalent). Requested: {payload.amount} UBU"
        )

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers WHERE username = ?", (clean,))
    cust = cursor.fetchone()
    if not cust:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Customer @{clean} not found")

    cursor.execute("SELECT * FROM customer_tokens WHERE username = ? AND unit_id = ?", (clean, payload.unit_id))
    tok_row = cursor.fetchone()
    if not tok_row or tok_row["ubu_balance"] < payload.amount:
        avail = tok_row["ubu_balance"] if tok_row else 0.0
        conn.close()
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient Ubuntu Tokens for {payload.unit_id}. Available: {avail} UBU, Requested: {payload.amount} UBU"
        )

    # 1. Deduct tokens
    new_token_bal = tok_row["ubu_balance"] - payload.amount
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
    UPDATE customer_tokens SET ubu_balance = ?, updated_at = ? WHERE username = ? AND unit_id = ?
    """, (new_token_bal, now_str, clean, payload.unit_id))

    # 2. Credit customer's fiat ZAR wallet (1 UBU = 1 ZAR)
    new_zar = cust["balance"] + payload.amount
    cursor.execute("UPDATE customers SET balance = ? WHERE username = ?", (new_zar, clean))

    # 3. Log transaction
    txn_id = f"txn_cashout_{uuid.uuid4().hex[:10]}"
    cursor.execute("""
    INSERT INTO transactions (id, customer_id, username, type, counterparty, amount, purpose, status, ilp_packet_ref, created_at)
    VALUES (?, ?, ?, 'CASHOUT', ?, ?, ?, 'COMPLETED', ?, ?);
    """, (
        txn_id, cust["id"], clean, f"Ubuntu Token Off-Ramp ({payload.unit_id})",
        payload.amount, f"Cash-out: {payload.purpose}", f"ilp_ubu_cashout_{uuid.uuid4().hex[:8]}", now_str
    ))

    conn.commit()
    conn.close()

    return CashoutResponse(
        success=True,
        amount_cashed_out=payload.amount,
        remaining_tokens=new_token_bal,
        unit_id=payload.unit_id,
        new_zar_balance=new_zar,
        transaction_ref=txn_id,
        receipt_message=f"Success! {payload.amount:.2f} Ubuntu Tokens cashed out to R{payload.amount:.2f} ZAR for {payload.purpose}."
    )

@app.post("/api/wallets/{username}/spend-tokens", response_model=SpendTokensResponse)
def spend_ubuntu_tokens(username: str, payload: SpendTokensRequest):
    """
    Spends / redeems unit-scoped Ubuntu Tokens at checkout for instant Rand discount.
    """
    clean = username.strip().lower().lstrip("@")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customer_tokens WHERE username = ? AND unit_id = ?", (clean, payload.unit_id))
    tok_row = cursor.fetchone()
    if not tok_row or tok_row["ubu_balance"] < payload.amount:
        avail = tok_row["ubu_balance"] if tok_row else 0.0
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient Ubuntu Tokens for {payload.unit_id}. Available: {avail} UBU, Requested: {payload.amount} UBU"
        )

    new_token_bal = tok_row["ubu_balance"] - payload.amount
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
    UPDATE customer_tokens SET ubu_balance = ?, updated_at = ? WHERE username = ? AND unit_id = ?
    """, (new_token_bal, now_str, clean, payload.unit_id))

    conn.commit()
    conn.close()

    return SpendTokensResponse(
        success=True,
        amount_spent=payload.amount,
        remaining_tokens=new_token_bal,
        unit_id=payload.unit_id,
        discount_zar_value=payload.amount,
        message=f"Applied {payload.amount:.2f} Ubuntu Tokens (-R{payload.amount:.2f}) from {payload.unit_id}."
    )


@app.get("/api/customers/{username}/transactions", response_model=List[TransactionResponse])
def get_customer_transactions(username: str):
    clean = username.strip().lower().lstrip("@")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM transactions WHERE username = ? ORDER BY created_at DESC LIMIT 50;
    """, (clean,))
    rows = cursor.fetchall()
    conn.close()
    return [TransactionResponse(**dict(r), currency="ZAR") for r in rows]

# -----------------------------------------------------------------------------
# 2. Open Payments Discovery & Merchant Resolver
# -----------------------------------------------------------------------------
@app.get("/api/resolve/{username}", response_model=CustomerResolveResponse)
def resolve_handle(username: str):
    """High-speed resolver for merchants to verify @username and retrieve wallet info."""
    return resolve_username(username)

@app.get("/{username}", response_model=WalletAddressResponse)
def get_open_payments_wallet_address(username: str, request: Request):
    """
    RFC / Open Payments Standard Wallet Address Discovery endpoint.
    e.g. GET https://spazauniti.org/mannini with Accept: application/json
    """
    # Guard against collision with api routes or static assets
    if username in ["api", "consent", "favicon.ico", "docs", "openapi.json"]:
        raise HTTPException(status_code=404, detail="Not a wallet address")

    return get_wallet_address_doc(username)

# -----------------------------------------------------------------------------
# 3. Incoming Payments (Repayment / Receiving Funds - Open & Frictionless)
# -----------------------------------------------------------------------------
@app.post("/api/wallets/{username}/incoming-payments", response_model=IncomingPaymentResponse)
def create_incoming_payment(username: str, payload: IncomingPaymentCreateRequest):
    """
    Open Payments Incoming Payment creation.
    Used by merchants or peer payers to credit/settle money to @username without interactive consent.
    """
    clean = username.strip().lower().lstrip("@")
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM customers WHERE username = ?", (clean,))
    cust = cursor.fetchone()
    if not cust:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Customer @{clean} not found")

    pay_id = f"in_{uuid.uuid4().hex[:12]}"
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # If amount specified, credit immediately to the customer wallet
    amount = payload.amount
    if amount and amount > 0:
        new_balance = round(cust["balance"] + amount, 2)
        cursor.execute("UPDATE customers SET balance = ? WHERE id = ?", (new_balance, cust["id"]))
        
        # Log transaction
        tx_id = f"tx_{uuid.uuid4().hex[:12]}"
        ilp_ref = f"ilp.packet.zar.{uuid.uuid4().hex[:16]}"
        counterparty = payload.payer_ref or "Merchant / Payer"
        cursor.execute("""
        INSERT INTO transactions (id, customer_id, username, type, counterparty, amount, purpose, status, ilp_packet_ref, created_at)
        VALUES (?, ?, ?, 'INCOMING', ?, ?, ?, 'COMPLETED', ?, ?);
        """, (tx_id, cust["id"], clean, counterparty, amount, payload.description or "Incoming Payment", ilp_ref, now_str))

    cursor.execute("""
    INSERT INTO incoming_payments (id, customer_id, username, amount, description, completed, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?);
    """, (pay_id, cust["id"], clean, amount, payload.description or "Settlement", now_str))

    conn.commit()
    conn.close()

    base_url = get_base_url()
    return IncomingPaymentResponse(
        id=f"{base_url}/incoming-payments/{pay_id}",
        wallet_address=f"{base_url}/{clean}",
        amount=amount,
        asset_code="ZAR",
        asset_scale=2,
        completed=True,
        description=payload.description or "Incoming Settlement",
        created_at=now_str,
        new_balance=new_balance
    )


# -----------------------------------------------------------------------------
# 4. Outgoing Payments (Two-Tier Consent Flow: Link or Counter PIN)
# -----------------------------------------------------------------------------
@app.post("/api/wallets/{username}/outgoing-payments/request", response_model=GrantResponse)
def request_outgoing_payment(username: str, payload: OutgoingPaymentRequestCreate):
    """
    Step 1 of Debiting a customer's wallet:
    Merchant initiates payment request. Spaza Uniti creates a pending grant and returns:
    - Option A: interactive_consent_url (for SMS/WhatsApp push notification)
    - Option B: fallback_available="COUNTER_PIN" (for offline/instant counter PIN entry)
    """
    m_wallet = payload.merchant_wallet or payload.recipient_wallet or "$spazauniti.org/unit-104"
    grant_info = create_outgoing_grant(
        username=username,
        amount=payload.amount,
        merchant_id=payload.merchant_id or "unit-104",
        merchant_name=payload.merchant_name or "Mama Zola Spaza",
        merchant_wallet=m_wallet,
        purpose=payload.purpose
    )
    return GrantResponse(**grant_info)


@app.get("/api/grants/{grant_id}")
def check_grant_status(grant_id: str):
    """Allows merchants to poll for consent approval if Option A link is used."""
    return get_grant_details(grant_id)

@app.post("/api/grants/{grant_id}/approve", response_model=GrantApprovalResponse)
def approve_grant_via_link(grant_id: str):
    """Option A (Primary): Shopper approves payment via mobile interactive link."""
    result = approve_grant(grant_id, consent_method="INTERACTIVE_LINK")
    return GrantApprovalResponse(**result)

@app.post("/api/grants/{grant_id}/verify-pin", response_model=GrantApprovalResponse)
def approve_grant_via_pin(grant_id: str, payload: PinVerificationRequest):
    """Option B (Fallback): Shopper enters 4-digit PIN at the counter POS if SMS never arrived."""
    result = verify_grant_with_pin(grant_id, payload.pin)
    return GrantApprovalResponse(**result)

# -----------------------------------------------------------------------------
# 5. Mobile-Friendly Interactive Consent Screen (Option A UI)
# -----------------------------------------------------------------------------
@app.get("/consent/{grant_id}", response_class=HTMLResponse)
def render_consent_screen(grant_id: str):
    """Renders the smartphone interactive authorization screen for Option A."""
    try:
        grant = get_grant_details(grant_id)
    except HTTPException:
        return HTMLResponse("<h2>Grant request expired or not found.</h2>", status_code=404)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Approve Payment • Spaza Uniti</title>
  <style>
    :root {{
      --primary: #15803d;
      --bg: #f8fafc;
      --card: #ffffff;
      --text: #0f172a;
      --muted: #64748b;
    }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 16px;
    }}
    .consent-card {{
      background: var(--card);
      border-radius: 20px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.06);
      max-width: 400px;
      width: 100%;
      padding: 32px 24px;
      text-align: center;
      box-sizing: border-box;
    }}
    .badge {{
      display: inline-block;
      background: #ecfdf5;
      color: var(--primary);
      font-size: 12px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 999px;
      margin-bottom: 16px;
      letter-spacing: 0.5px;
    }}
    .amount-box {{
      font-size: 38px;
      font-weight: 800;
      color: #0f172a;
      margin: 8px 0;
    }}
    .merchant-name {{
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 6px;
    }}
    .purpose {{
      font-size: 14px;
      color: var(--muted);
      margin-bottom: 24px;
    }}
    .btn {{
      display: block;
      width: 100%;
      padding: 14px 0;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
      box-sizing: border-box;
      text-decoration: none;
    }}
    .btn-approve {{
      background: var(--primary);
      color: #ffffff;
      margin-bottom: 12px;
    }}
    .btn-approve:hover {{
      background: #166534;
    }}
    .btn-pin {{
      background: #f1f5f9;
      color: #334155;
      margin-bottom: 12px;
      font-size: 14px;
    }}
    .status-msg {{
      margin-top: 16px;
      font-size: 14px;
      font-weight: 600;
    }}
  </style>
</head>
<body>
  <div class="consent-card">
    <span class="badge">OPEN PAYMENTS AUTHORIZATION</span>
    <div class="merchant-name">{grant['merchant_name']}</div>
    <div class="amount-box">R{grant['amount']:.2f}</div>
    <div class="purpose">{grant['purpose']} • Customer: @{grant['username']}</div>

    <div id="actionArea">
      <button class="btn btn-approve" id="approveBtn" onclick="approve()">Tap to Approve Payment</button>
      <div style="font-size: 12px; color: var(--muted); margin-top: 16px;">
        Or enter your 4-digit PIN on the shopkeeper's counter screen if offline.
      </div>
    </div>
    <div id="statusArea" class="status-msg"></div>
  </div>

  <script>
    async function approve() {{
      const btn = document.getElementById('approveBtn');
      btn.disabled = true;
      btn.textContent = 'Processing Authorization...';
      try {{
        const res = await fetch('/api/grants/{grant_id}/approve', {{ method: 'POST' }});
        const data = await res.json();
        if (res.ok) {{
          document.getElementById('actionArea').innerHTML = '<div style="color: #15803d; font-size: 20px; font-weight: 700;">Payment Approved!</div><p style="color: #64748b; font-size: 13px;">Funds streamed via Interledger to {grant['merchant_name']}.</p>';
        }} else {{
          document.getElementById('statusArea').innerHTML = '<span style="color: #dc2626;">' + (data.detail || 'Failed to approve') + '</span>';
          btn.disabled = false;
          btn.textContent = 'Retry Approval';
        }}
      }} catch (e) {{
        document.getElementById('statusArea').innerHTML = '<span style="color: #dc2626;">Network error. Please use PIN at the counter.</span>';
        btn.disabled = false;
        btn.textContent = 'Retry Approval';
      }}
    }}
  </script>
</body>
</html>
"""
    return HTMLResponse(content=html)

# -----------------------------------------------------------------------------
# 6. Unit Discovery & Storefront Federation (Radius Search & Standardized Pages)
# -----------------------------------------------------------------------------
@app.get("/api/units", response_model=List[UnitSummaryResponse])
def discover_units(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: Optional[float] = None,
    filter: Optional[str] = None
):
    """
    Customer Unit Discovery endpoint:
    - Calculates distance via Haversine formula from customer's GPS coordinates.
    - Filters by radius (e.g. 0.5km, 1km, 3km, 5km) and features (promos, loyalty, jobs).
    - Returns registered units ordered by proximity.
    """
    return get_nearby_units(
        customer_lat=lat,
        customer_lng=lng,
        radius_km=radius_km,
        filter_type=filter
    )

@app.get("/api/units/{unit_id}", response_model=UnitDetailResponse)
def get_standard_unit_page(
    unit_id: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None
):
    """
    Standardized Unit page data:
    Returns store identity, active specials/promos, loyalty program rules, community gigs/jobs, and contact.
    """
    return get_unit_detail(unit_id, customer_lat=lat, customer_lng=lng)

@app.put("/api/units/{unit_id}/broadcast")
def sync_unit_broadcast_updates(unit_id: str, payload: UnitBroadcastPayload):
    """
    Merchant sync webhook:
    Called by SpazaKhokha whenever broadcast_to_uniti is true.
    Atomically updates promos, loyalty rules, jobs, and operating status.
    """
    return sync_unit_broadcast(unit_id, payload.dict())

@app.post("/api/units/register")
def register_merchant_unit(payload: UnitRegisterRequest):
    """Registers a new merchant Unit on Spaza Uniti network with coordinates and Open Payments pointer."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM units WHERE id = ?", (payload.id,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail=f"Unit '{payload.id}' is already registered.")

    base_url = get_base_url()
    wallet_url = f"{base_url}/{payload.id}"
    op_id = f"${base_url.replace('http://', '').replace('https://', '')}/{payload.id}"
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
    INSERT INTO units (
        id, name, tagline, owner_name, phone, whatsapp, address, township, landmark,
        latitude, longitude, wallet_address_url, open_payments_id, operating_hours,
        status, broadcast_enabled, promotions_json, loyalty_json, jobs_json, updated_at, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, '[]', '{}', '[]', ?, ?);
    """, (
        payload.id, payload.name, payload.tagline, payload.owner_name, payload.phone, payload.whatsapp,
        payload.address, payload.township, payload.landmark, payload.latitude, payload.longitude,
        wallet_url, op_id, payload.operating_hours, 1 if payload.broadcast_enabled else 0, now_str, now_str
    ))

    conn.commit()
    conn.close()

    return {
        "unit_id": payload.id,
        "name": payload.name,
        "open_payments_id": op_id,
        "wallet_address_url": wallet_url,
        "status": "REGISTERED",
        "broadcast_enabled": payload.broadcast_enabled,
        "message": f"Unit '{payload.name}' registered successfully on Spaza Uniti."
    }
