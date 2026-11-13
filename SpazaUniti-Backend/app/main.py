import os
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from .database import init_db, get_db, hash_pin
from .models import (
    CustomerRegisterRequest,
    CustomerResponse,
    FundUbuRequest,
    FundUbuResponse,
    FamilyMemberCreateRequest,
    FamilyMemberUpdateRequest,
    BeneficiaryInviteRequest,
    InvitationRespondRequest,
    BeneficiaryAllocateRequest,
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
    SpendTokensResponse,
    UbuOneLoginRequest,
    ConsumerLoginRequest,
    ConsumerPayUnitRequest,
    StaffResponse,
    StaffCreateRequest,
    CounterChargeRequest,
    ChangeInUbuRequest,
    UnitSettlementRequest,
    UnitLoyaltyCreateRequest,
    UnitPromoCreateRequest
)
from .resolver import (
    resolve_username,
    search_consumers,
    get_wallet_address_doc,
    check_username_available,
    get_base_url
)
from .grants import create_outgoing_grant, approve_grant, verify_grant_with_pin, get_grant_details
from .discovery import get_nearby_units, get_unit_detail, sync_unit_broadcast
from .consumers import (
    get_consumer_profile_full,
    fund_ubu_wallet,
    add_family_member,
    update_family_member,
    invite_beneficiary,
    respond_to_invitation,
    allocate_to_beneficiary,
    remove_beneficiary_link,
    debit_consumer_ubu
)
from .rbac import (
    login_staff,
    logout_staff,
    get_current_staff,
    require_roles,
    assert_unit_scope,
    extract_token,
    list_unit_staff,
    create_unit_staff,
    toggle_unit_staff
)
from .consumer_rbac import (
    login_consumer,
    logout_consumer,
    get_current_consumer,
    assert_family_admin,
    get_family_overview,
    get_consumer_workspace,
    pay_unit_from_consumer
)
from .ubuone import (
    get_unit_overview,
    process_counter_charge,
    issue_change_in_ubu,
    create_unit_settlement,
    get_unit_loyalty_programs,
    create_unit_loyalty_program,
    toggle_unit_loyalty_program,
    delete_unit_loyalty_program,
    get_unit_promotions,
    create_unit_promotion,
    delete_unit_promotion,
    toggle_unit_broadcast,
    get_network_admin_summary
)

app = FastAPI(
    title="UbuOne x Spaza Uniti Engine",
    description="Consolidated Open Payments, Two-Bucket UBU Micro-Ledger, Consumer Family/Beneficiary Wallets, and Unit RBAC Operations.",
    version="2.0.0"
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
        "service": "UbuOne x Spaza Uniti Core Engine",
        "tagline": "Built for R1 Moments. Powered by Open Payments.",
        "network": "Interledger Protocol / Open Payments ZAR + UBU Edge Ledger",
        "open_payments_version": "1.0",
        "status": "online",
        "endpoints": {
            "register_customer": f"{base_url}/api/customers/register",
            "search_consumers": f"{base_url}/api/customers/search?q=lerato",
            "ubuone_login": f"{base_url}/api/ubuone/auth/login",
            "resolve_handle": f"{base_url}/api/resolve/{{username}}",
            "wallet_discovery": f"{base_url}/{{username}}"
        }
    }

# -----------------------------------------------------------------------------
# 1. Consumer Onboarding, Search & Multi-Class UBU Wallets
# -----------------------------------------------------------------------------
@app.post("/api/customers/register", response_model=CustomerResponse)
def register_customer(payload: CustomerRegisterRequest):
    """
    Registers either an INDIVIDUAL adult consumer or a FAMILY Vault (@morake_ext_5).
    Issues Open Payments wallet pointer + Uniti-Wide Spendable UBU wallet.
    """
    clean_user = payload.username.lower()
    avail = check_username_available(clean_user)
    if not avail["available"]:
        raise HTTPException(status_code=400, detail=f"Username '@{clean_user}' is not available: {avail['reason']}")

    conn = get_db()
    cursor = conn.cursor()

    cust_id = f"cust_{uuid.uuid4().hex[:12]}"
    base_url = get_base_url()
    wallet_url = f"{base_url}/{clean_user}"
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    pin_hashed = hash_pin(payload.pin)

    initial_fiat = 100.00
    initial_ubu = 200.00 if payload.account_type == "FAMILY" else 100.00

    cursor.execute("""
    INSERT INTO customers (
        id, username, full_name, cell_number, pin_hash, wallet_address_url,
        balance, ubu_balance, account_type, family_parent_username, status, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'ACTIVE', ?);
    """, (
        cust_id, clean_user, payload.full_name.strip(), payload.cell_number.strip(),
        pin_hashed, wallet_url, initial_fiat, initial_ubu, payload.account_type, now_str
    ))

    conn.commit()
    conn.close()
    return get_consumer_profile_full(clean_user)

@app.get("/api/customers/check-username/{username}")
def check_username(username: str):
    return check_username_available(username)

@app.get("/api/customers/search")
def search_customer_handles(q: str = "", exclude: Optional[str] = None):
    """Search existing consumer handles so an individual adult can invite a beneficiary."""
    return search_consumers(q, exclude_username=exclude)

@app.get("/api/customers/{username}", response_model=CustomerResponse)
def get_customer(username: str):
    return get_consumer_profile_full(username)

@app.post("/api/wallets/{username}/fund-ubu", response_model=FundUbuResponse)
def fund_consumer_ubu(username: str, payload: FundUbuRequest):
    """Single Open Payments / Cash-In inflow -> Uniti-Wide Spendable UBU Pool."""
    return fund_ubu_wallet(username, payload)

@app.post("/api/wallets/{username}/pay-unit-ubu")
def api_wallet_pay_unit_ubu(username: str, payload: ConsumerPayUnitRequest):
    """
    Direct zero-fee UBU payment from customer's Spendable UBU pool (or Family allowance)
    to a Spaza Uniti node. Debits customers.ubu_balance, credits units.ubu_balance,
    records to ubuone_ledger and transactions.
    """
    clean = username.strip().lower().lstrip("@")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers WHERE username = ?", (clean,))
    cust = cursor.fetchone()
    if not cust:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Customer @{clean} not found")

    unit_target = payload.unit_id.strip()
    cursor.execute("SELECT * FROM units WHERE id = ?", (unit_target,))
    unit = cursor.fetchone()
    if not unit:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Spaza Unit '{payload.unit_id}' not found")

    source_bucket, debited_vault, debit_meta = debit_consumer_ubu(
        cursor=cursor,
        cust_row=cust,
        amount_ubu=payload.amount_ubu,
        source_mode=payload.source_mode,
        sponsor_username=payload.sponsor_username,
    )

    new_unit_ubu = round(float(unit["ubu_balance"] or 0.0) + payload.amount_ubu, 2)
    cursor.execute("UPDATE units SET ubu_balance = ? WHERE id = ?", (new_unit_ubu, unit["id"]))

    reward_earned = round(min(payload.amount_ubu * 0.1, 2.0), 2)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if reward_earned > 0:
        cursor.execute(
            "SELECT * FROM customer_tokens WHERE username = ? AND unit_id = ?",
            (clean, unit["id"]),
        )
        tok = cursor.fetchone()
        if tok:
            cursor.execute(
                "UPDATE customer_tokens SET ubu_balance = ?, updated_at = ? WHERE username = ? AND unit_id = ?",
                (round(float(tok["ubu_balance"]) + reward_earned, 2), now_str, clean, unit["id"]),
            )
        else:
            cursor.execute(
                "INSERT INTO customer_tokens (id, username, unit_id, ubu_balance, updated_at) VALUES (?, ?, ?, ?, ?)",
                (f"tok_{uuid.uuid4().hex[:10]}", clean, unit["id"], reward_earned, now_str),
            )

    ledger_id = f"u1l_{uuid.uuid4().hex[:10]}"
    desc = f"{payload.items_description.strip()} ({unit['name']})"
    cursor.execute(
        """
        INSERT INTO ubuone_ledger (
            id, event_type, unit_id, staff_username, from_username, to_username,
            amount_ubu, fee_zar, description, source_bucket, created_at
        )
        VALUES (?, 'COUNTER_SALE', ?, 'spaza_uniti_online', ?, ?, ?, 0.0, ?, ?, ?);
        """,
        (ledger_id, unit["id"], clean, unit["id"], round(payload.amount_ubu, 2), desc, source_bucket, now_str),
    )

    ilp_ref = f"ilp.ubuone.online.{uuid.uuid4().hex[:10]}"
    cursor.execute(
        """
        INSERT INTO transactions (id, customer_id, username, type, counterparty, amount, purpose, status, ilp_packet_ref, created_at)
        VALUES (?, ?, ?, 'OUTGOING', ?, ?, ?, 'COMPLETED', ?, ?);
        """,
        (
            f"tx_{uuid.uuid4().hex[:10]}",
            cust["id"],
            clean,
            unit["name"],
            round(payload.amount_ubu, 2),
            f"{payload.items_description.strip()} (via {source_bucket})",
            ilp_ref,
            now_str,
        ),
    )

    conn.commit()

    # Read back updated customer balances
    cursor.execute("SELECT ubu_balance, balance FROM customers WHERE username = ?", (clean,))
    cust_updated = cursor.fetchone()
    conn.close()

    return {
        "success": True,
        "ledger_id": ledger_id,
        "unit_id": unit["id"],
        "unit_name": unit["name"],
        "amount_ubu": round(payload.amount_ubu, 2),
        "fee_zar": 0.0,
        "source_bucket": source_bucket,
        "debited_vault": debited_vault,
        "new_customer_ubu_balance": cust_updated["ubu_balance"] if cust_updated else 0.0,
        "new_customer_zar_balance": cust_updated["balance"] if cust_updated else 0.0,
        "new_unit_balance": new_unit_ubu,
        "reward_earned": reward_earned,
        "receipt_message": f"Paid {payload.amount_ubu:.2f} UBU cleanly to {unit['name']}! Zero transaction fee applied."
    }

# -----------------------------------------------------------------------------
# 2. FAMILY Vault Members & INDIVIDUAL Beneficiary Invitations/Allocations
# -----------------------------------------------------------------------------
@app.post("/api/consumers/families/{family_username}/members", response_model=CustomerResponse)
def api_add_family_member(family_username: str, payload: FamilyMemberCreateRequest):
    return add_family_member(family_username, payload)

@app.put("/api/consumers/families/{family_username}/members/{member_username}", response_model=CustomerResponse)
def api_update_family_member(family_username: str, member_username: str, payload: FamilyMemberUpdateRequest):
    return update_family_member(family_username, member_username, payload)

@app.post("/api/consumers/{sponsor_username}/beneficiaries/invite", response_model=CustomerResponse)
def api_invite_beneficiary(sponsor_username: str, payload: BeneficiaryInviteRequest):
    return invite_beneficiary(sponsor_username, payload)

@app.post("/api/consumers/invitations/{link_id}/respond", response_model=CustomerResponse)
def api_respond_invitation(link_id: str, username: str, payload: InvitationRespondRequest):
    return respond_to_invitation(link_id, username, payload.action)

@app.post("/api/consumers/{sponsor_username}/beneficiaries/{link_id}/allocate")
def api_allocate_beneficiary(sponsor_username: str, link_id: str, payload: BeneficiaryAllocateRequest):
    return allocate_to_beneficiary(sponsor_username, link_id, payload)

@app.delete("/api/consumers/{username}/beneficiaries/{link_id}")
def api_remove_beneficiary(username: str, link_id: str):
    return remove_beneficiary_link(username, link_id)

# -----------------------------------------------------------------------------
# 3. Unit-Scoped Loyalty Tokens: R20 Taxi Cash-Out & Cart Discount Spend
# -----------------------------------------------------------------------------
@app.post("/api/wallets/{username}/cashout", response_model=CashoutResponse)
def cashout_ubuntu_tokens(username: str, payload: CashoutRequest):
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

    new_token_bal = tok_row["ubu_balance"] - payload.amount
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        "UPDATE customer_tokens SET ubu_balance = ?, updated_at = ? WHERE username = ? AND unit_id = ?",
        (new_token_bal, now_str, clean, payload.unit_id)
    )

    new_zar = cust["balance"] + payload.amount
    cursor.execute("UPDATE customers SET balance = ? WHERE username = ?", (new_zar, clean))

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
    cursor.execute(
        "UPDATE customer_tokens SET ubu_balance = ?, updated_at = ? WHERE username = ? AND unit_id = ?",
        (new_token_bal, now_str, clean, payload.unit_id)
    )
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
    cursor.execute("SELECT * FROM transactions WHERE username = ? ORDER BY created_at DESC LIMIT 50;", (clean,))
    rows = cursor.fetchall()
    conn.close()
    return [TransactionResponse(**dict(r), currency="ZAR") for r in rows]

# -----------------------------------------------------------------------------
# 4. UbuOne Operator Portal (RBAC Auth + Counter Till + Settlements + Offerings)
# -----------------------------------------------------------------------------
@app.post("/api/ubuone/auth/login")
def ubuone_login(payload: UbuOneLoginRequest):
    return login_staff(payload)

@app.get("/api/ubuone/auth/me")
def ubuone_me(staff: Dict[str, Any] = Depends(get_current_staff)):
    return staff

@app.post("/api/ubuone/auth/logout")
def ubuone_logout(token: str = Depends(extract_token)):
    return logout_staff(token)

@app.get("/api/ubuone/units/{unit_id}/overview")
def ubuone_unit_overview(
    unit_id: str,
    staff: Dict[str, Any] = Depends(require_roles(["UNIT_CASHIER", "UNIT_OWNER", "NETWORK_ADMIN"]))
):
    assert_unit_scope(staff, unit_id)
    return get_unit_overview(unit_id, staff)

@app.post("/api/ubuone/units/{unit_id}/counter/charge")
def ubuone_counter_charge(
    unit_id: str,
    payload: CounterChargeRequest,
    staff: Dict[str, Any] = Depends(require_roles(["UNIT_CASHIER", "UNIT_OWNER", "NETWORK_ADMIN"]))
):
    assert_unit_scope(staff, unit_id)
    return process_counter_charge(unit_id, staff, payload)

@app.post("/api/ubuone/units/{unit_id}/counter/change-in-ubu")
def ubuone_change_in_ubu(
    unit_id: str,
    payload: ChangeInUbuRequest,
    staff: Dict[str, Any] = Depends(require_roles(["UNIT_CASHIER", "UNIT_OWNER", "NETWORK_ADMIN"]))
):
    assert_unit_scope(staff, unit_id)
    return issue_change_in_ubu(unit_id, staff, payload)

@app.post("/api/ubuone/units/{unit_id}/settlements")
def ubuone_unit_settlement(
    unit_id: str,
    payload: UnitSettlementRequest,
    staff: Dict[str, Any] = Depends(require_roles(["UNIT_OWNER", "NETWORK_ADMIN"]))
):
    assert_unit_scope(staff, unit_id)
    return create_unit_settlement(unit_id, staff, payload)

@app.get("/api/ubuone/units/{unit_id}/staff", response_model=List[StaffResponse])
def ubuone_list_staff(
    unit_id: str,
    staff: Dict[str, Any] = Depends(require_roles(["UNIT_OWNER", "NETWORK_ADMIN"]))
):
    assert_unit_scope(staff, unit_id)
    return list_unit_staff(unit_id)

@app.post("/api/ubuone/units/{unit_id}/staff", response_model=StaffResponse)
def ubuone_create_staff(
    unit_id: str,
    payload: StaffCreateRequest,
    staff: Dict[str, Any] = Depends(require_roles(["UNIT_OWNER", "NETWORK_ADMIN"]))
):
    assert_unit_scope(staff, unit_id)
    return create_unit_staff(unit_id, payload)

@app.put("/api/ubuone/units/{unit_id}/staff/{staff_id}/toggle", response_model=StaffResponse)
def ubuone_toggle_staff(
    unit_id: str,
    staff_id: str,
    staff: Dict[str, Any] = Depends(require_roles(["UNIT_OWNER", "NETWORK_ADMIN"]))
):
    assert_unit_scope(staff, unit_id)
    return toggle_unit_staff(unit_id, staff_id, acting_staff_id=staff["staff_id"])

@app.get("/api/ubuone/units/{unit_id}/loyalty")
def ubuone_get_loyalty(
    unit_id: str,
    staff: Dict[str, Any] = Depends(require_roles(["UNIT_CASHIER", "UNIT_OWNER", "NETWORK_ADMIN"]))
):
    assert_unit_scope(staff, unit_id)
    return get_unit_loyalty_programs(unit_id)

@app.post("/api/ubuone/units/{unit_id}/loyalty")
def ubuone_create_loyalty(
    unit_id: str,
    payload: UnitLoyaltyCreateRequest,
    staff: Dict[str, Any] = Depends(require_roles(["UNIT_OWNER", "NETWORK_ADMIN"]))
):
    assert_unit_scope(staff, unit_id)
    return create_unit_loyalty_program(unit_id, payload)

@app.put("/api/ubuone/units/{unit_id}/loyalty/{program_id}/toggle")
def ubuone_toggle_loyalty(
    unit_id: str,
    program_id: str,
    staff: Dict[str, Any] = Depends(require_roles(["UNIT_OWNER", "NETWORK_ADMIN"]))
):
    assert_unit_scope(staff, unit_id)
    return toggle_unit_loyalty_program(unit_id, program_id)

@app.delete("/api/ubuone/units/{unit_id}/loyalty/{program_id}")
def ubuone_delete_loyalty(
    unit_id: str,
    program_id: str,
    staff: Dict[str, Any] = Depends(require_roles(["UNIT_OWNER", "NETWORK_ADMIN"]))
):
    assert_unit_scope(staff, unit_id)
    return delete_unit_loyalty_program(unit_id, program_id)

@app.get("/api/ubuone/units/{unit_id}/promotions")
def ubuone_get_promos(
    unit_id: str,
    staff: Dict[str, Any] = Depends(require_roles(["UNIT_CASHIER", "UNIT_OWNER", "NETWORK_ADMIN"]))
):
    assert_unit_scope(staff, unit_id)
    return get_unit_promotions(unit_id)

@app.post("/api/ubuone/units/{unit_id}/promotions")
def ubuone_create_promo(
    unit_id: str,
    payload: UnitPromoCreateRequest,
    staff: Dict[str, Any] = Depends(require_roles(["UNIT_OWNER", "NETWORK_ADMIN"]))
):
    assert_unit_scope(staff, unit_id)
    return create_unit_promotion(unit_id, payload)

@app.delete("/api/ubuone/units/{unit_id}/promotions/{promo_id}")
def ubuone_delete_promo(
    unit_id: str,
    promo_id: str,
    staff: Dict[str, Any] = Depends(require_roles(["UNIT_OWNER", "NETWORK_ADMIN"]))
):
    assert_unit_scope(staff, unit_id)
    return delete_unit_promotion(unit_id, promo_id)

@app.put("/api/ubuone/units/{unit_id}/broadcast")
def ubuone_toggle_broadcast(
    unit_id: str,
    enabled: bool = True,
    staff: Dict[str, Any] = Depends(require_roles(["UNIT_OWNER", "NETWORK_ADMIN"]))
):
    assert_unit_scope(staff, unit_id)
    return toggle_unit_broadcast(unit_id, enabled)

@app.get("/api/ubuone/admin/overview")
def ubuone_network_overview(
    staff: Dict[str, Any] = Depends(require_roles(["NETWORK_ADMIN"]))
):
    return get_network_admin_summary()

# -----------------------------------------------------------------------------
# 4b. UbuOne Consumer, Family RBAC & Adult Individual Account Routes
# -----------------------------------------------------------------------------
@app.post("/api/ubuone/auth/consumer/login")
def ubuone_consumer_login(payload: ConsumerLoginRequest):
    return login_consumer(payload)

@app.get("/api/ubuone/auth/consumer/me")
def ubuone_consumer_me(actor: Dict[str, Any] = Depends(get_current_consumer)):
    return {
        "actor": actor,
        "profile": get_consumer_profile_full(actor["username"])
    }

@app.post("/api/ubuone/auth/consumer/logout")
def ubuone_consumer_logout(token: str = Depends(extract_token)):
    return logout_consumer(token)

@app.get("/api/ubuone/families/{family_username}/overview")
def ubuone_family_overview(
    family_username: str,
    actor: Dict[str, Any] = Depends(get_current_consumer)
):
    return get_family_overview(family_username, actor)

@app.post("/api/ubuone/families/{family_username}/members", response_model=CustomerResponse)
def ubuone_family_add_member(
    family_username: str,
    payload: FamilyMemberCreateRequest,
    actor: Dict[str, Any] = Depends(get_current_consumer)
):
    fam = assert_family_admin(actor, family_username)
    return add_family_member(fam, payload)

@app.put("/api/ubuone/families/{family_username}/members/{member_username}", response_model=CustomerResponse)
def ubuone_family_update_member(
    family_username: str,
    member_username: str,
    payload: FamilyMemberUpdateRequest,
    actor: Dict[str, Any] = Depends(get_current_consumer)
):
    fam = assert_family_admin(actor, family_username)
    return update_family_member(fam, member_username, payload)

@app.post("/api/ubuone/families/{family_username}/fund", response_model=FundUbuResponse)
def ubuone_family_fund_pool(
    family_username: str,
    payload: FundUbuRequest,
    actor: Dict[str, Any] = Depends(get_current_consumer)
):
    fam = assert_family_admin(actor, family_username)
    return fund_ubu_wallet(fam, payload)

@app.get("/api/ubuone/consumers/{username}/workspace")
def ubuone_consumer_workspace(
    username: str,
    actor: Dict[str, Any] = Depends(get_current_consumer)
):
    return get_consumer_workspace(username, actor)

@app.post("/api/ubuone/consumers/{username}/pay-unit")
def ubuone_consumer_pay_unit(
    username: str,
    payload: ConsumerPayUnitRequest,
    actor: Dict[str, Any] = Depends(get_current_consumer)
):
    return pay_unit_from_consumer(username, actor, payload)

@app.post("/api/ubuone/consumers/{username}/fund-ubu", response_model=FundUbuResponse)
def ubuone_consumer_fund_ubu(
    username: str,
    payload: FundUbuRequest,
    actor: Dict[str, Any] = Depends(get_current_consumer)
):
    clean = username.strip().lower().lstrip("@")
    if actor["username"] != clean:
        raise HTTPException(status_code=403, detail="RBAC Denied: Can only fund your own UBU wallet")
    if actor["consumer_role"] == "FAMILY_MEMBER":
        raise HTTPException(status_code=403, detail="RBAC Denied: Restricted Family Members cannot directly mint or fund pools without Family Admin privileges")
    return fund_ubu_wallet(clean, payload)

@app.post("/api/ubuone/adults/{sponsor_username}/beneficiaries/invite", response_model=CustomerResponse)
def ubuone_adult_invite_beneficiary(
    sponsor_username: str,
    payload: BeneficiaryInviteRequest,
    actor: Dict[str, Any] = Depends(get_current_consumer)
):
    clean = sponsor_username.strip().lower().lstrip("@")
    if actor["username"] != clean:
        raise HTTPException(status_code=403, detail="RBAC Denied: Cannot send beneficiary invitations from another handle")
    if actor["consumer_role"] == "FAMILY_MEMBER":
        raise HTTPException(status_code=403, detail="RBAC Denied: Restricted Family Members cannot create beneficiary sponsorships")
    return invite_beneficiary(clean, payload)

@app.post("/api/ubuone/adults/invitations/{link_id}/respond", response_model=CustomerResponse)
def ubuone_adult_respond_invitation(
    link_id: str,
    payload: InvitationRespondRequest,
    actor: Dict[str, Any] = Depends(get_current_consumer)
):
    return respond_to_invitation(link_id, actor["username"], payload.action)

@app.post("/api/ubuone/adults/{sponsor_username}/beneficiaries/{link_id}/allocate")
def ubuone_adult_allocate_beneficiary(
    sponsor_username: str,
    link_id: str,
    payload: BeneficiaryAllocateRequest,
    actor: Dict[str, Any] = Depends(get_current_consumer)
):
    clean = sponsor_username.strip().lower().lstrip("@")
    if actor["username"] != clean:
        raise HTTPException(status_code=403, detail="RBAC Denied: Cannot allocate funds from another handle")
    if actor["consumer_role"] == "FAMILY_MEMBER":
        raise HTTPException(status_code=403, detail="RBAC Denied: Restricted Family Members cannot allocate beneficiary allowances")
    return allocate_to_beneficiary(clean, link_id, payload)

@app.delete("/api/ubuone/adults/{username}/beneficiaries/{link_id}")
def ubuone_adult_remove_beneficiary(
    username: str,
    link_id: str,
    actor: Dict[str, Any] = Depends(get_current_consumer)
):
    clean = username.strip().lower().lstrip("@")
    if actor["username"] != clean:
        raise HTTPException(status_code=403, detail="RBAC Denied: Cannot revoke links belonging to another handle")
    return remove_beneficiary_link(clean, link_id)

# -----------------------------------------------------------------------------
# 5. Open Payments Discovery & Two-Tier Grant Authorization
# -----------------------------------------------------------------------------
@app.get("/api/resolve/{username}", response_model=CustomerResolveResponse)
def resolve_handle(username: str):
    return resolve_username(username)

@app.post("/api/wallets/{username}/incoming-payments", response_model=IncomingPaymentResponse)
def create_incoming_payment(username: str, payload: IncomingPaymentCreateRequest):
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
    amount = payload.amount
    new_balance = cust["balance"]
    if amount and amount > 0:
        new_balance = round(cust["balance"] + amount, 2)
        cursor.execute("UPDATE customers SET balance = ? WHERE id = ?", (new_balance, cust["id"]))
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

@app.post("/api/wallets/{username}/outgoing-payments/request", response_model=GrantResponse)
def request_outgoing_payment(username: str, payload: OutgoingPaymentRequestCreate):
    m_wallet = payload.merchant_wallet or payload.recipient_wallet or "$spazauniti.org/unit-104"
    grant_info = create_outgoing_grant(
        username=username,
        amount=payload.amount,
        merchant_id=payload.merchant_id or "unit-104",
        merchant_name=payload.merchant_name or "Khumalo Spaza Store",
        merchant_wallet=m_wallet,
        purpose=payload.purpose
    )
    return GrantResponse(**grant_info)

@app.get("/api/grants/{grant_id}")
def check_grant_status(grant_id: str):
    return get_grant_details(grant_id)

@app.post("/api/grants/{grant_id}/approve", response_model=GrantApprovalResponse)
def approve_grant_via_link(grant_id: str):
    result = approve_grant(grant_id, consent_method="INTERACTIVE_LINK")
    return GrantApprovalResponse(**result)

@app.post("/api/grants/{grant_id}/verify-pin", response_model=GrantApprovalResponse)
def approve_grant_via_pin(grant_id: str, payload: PinVerificationRequest):
    result = verify_grant_with_pin(grant_id, payload.pin)
    return GrantApprovalResponse(**result)

@app.get("/consent/{grant_id}", response_class=HTMLResponse)
def render_consent_screen(grant_id: str):
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
    :root {{ --primary: #15803d; --bg: #f8fafc; --card: #ffffff; --text: #0f172a; --muted: #64748b; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px; }}
    .consent-card {{ background: var(--card); border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.06); max-width: 400px; width: 100%; padding: 32px 24px; text-align: center; box-sizing: border-box; }}
    .badge {{ display: inline-block; background: #ecfdf5; color: var(--primary); font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 999px; margin-bottom: 16px; }}
    .amount-box {{ font-size: 38px; font-weight: 800; color: #0f172a; margin: 8px 0; }}
    .merchant-name {{ font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 6px; }}
    .purpose {{ font-size: 14px; color: var(--muted); margin-bottom: 24px; }}
    .btn-approve {{ display: block; width: 100%; padding: 14px 0; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; border: none; background: var(--primary); color: #fff; margin-bottom: 12px; }}
  </style>
</head>
<body>
  <div class="consent-card">
    <span class="badge">OPEN PAYMENTS AUTHORIZATION</span>
    <div class="merchant-name">{grant['merchant_name']}</div>
    <div class="amount-box">R{grant['amount']:.2f}</div>
    <div class="purpose">{grant['purpose']} • Customer: @{grant['username']}</div>
    <div id="actionArea">
      <button class="btn-approve" id="approveBtn" onclick="approve()">Tap to Approve Payment</button>
    </div>
    <div id="statusArea"></div>
  </div>
  <script>
    async function approve() {{
      const btn = document.getElementById('approveBtn');
      btn.disabled = true; btn.textContent = 'Processing Authorization...';
      try {{
        const res = await fetch('/api/grants/{grant_id}/approve', {{ method: 'POST' }});
        const data = await res.json();
        if (res.ok) {{
          document.getElementById('actionArea').innerHTML = '<div style="color: #15803d; font-size: 20px; font-weight: 700;">Payment Approved!</div>';
        }} else {{
          document.getElementById('statusArea').textContent = data.detail || 'Failed';
          btn.disabled = false; btn.textContent = 'Retry';
        }}
      }} catch (e) {{
        btn.disabled = false; btn.textContent = 'Retry';
      }}
    }}
  </script>
</body>
</html>"""
    return HTMLResponse(content=html)

# -----------------------------------------------------------------------------
# 6. Unit Discovery & Storefront Federation + Open Payments Wallet URI
# -----------------------------------------------------------------------------
@app.get("/api/units", response_model=List[UnitSummaryResponse])
def discover_units(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: Optional[float] = None,
    filter: Optional[str] = None
):
    return get_nearby_units(customer_lat=lat, customer_lng=lng, radius_km=radius_km, filter_type=filter)

@app.get("/api/units/{unit_id}", response_model=UnitDetailResponse)
def get_standard_unit_page(unit_id: str, lat: Optional[float] = None, lng: Optional[float] = None):
    return get_unit_detail(unit_id, customer_lat=lat, customer_lng=lng)

@app.put("/api/units/{unit_id}/broadcast")
def sync_unit_broadcast_updates(unit_id: str, payload: UnitBroadcastPayload):
    return sync_unit_broadcast(unit_id, payload.dict())

@app.post("/api/units/register")
def register_merchant_unit(payload: UnitRegisterRequest):
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
        status, broadcast_enabled, promotions_json, loyalty_json, jobs_json, ubu_balance, updated_at, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, '[]', '{}', '[]', 0.0, ?, ?);
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

@app.get("/{username}", response_model=WalletAddressResponse)
def get_open_payments_wallet_address(username: str, request: Request):
    if username in ["api", "consent", "favicon.ico", "docs", "openapi.json"]:
        raise HTTPException(status_code=404, detail="Not a wallet address")
    return get_wallet_address_doc(username)
