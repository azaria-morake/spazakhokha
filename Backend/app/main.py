from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
import sqlite3

from .database import init_db, get_db
from .models import (
    CustomerCreate, CustomerResponse,
    PurchaseCreate, PurchaseResponse,
    RepaymentCreate, RepaymentResponse,
    TransactionResponse,
    PromotionCreate, PromotionResponse,
    LoyaltyProgramResponse, LoyaltyProgramUpdate,
    AgentChatRequest, AgentChatResponse,
    OpenPaymentsRequestCreate, OpenPaymentsRequestResponse,
    OpenPaymentsWebhookPayload,
    StoreSettingsModel, StoreSettingsUpdate
)
from .agent import parse_and_execute_agent
from .open_payments import create_incoming_payment_request, process_open_payments_webhook
from .broadcast_sync import get_store_settings, sync_to_spaza_uniti


app = FastAPI(
    title="SpazaKhokha & Spaza Uniti Backend API",
    description="Agentic AI operating system and Open Payments integration for township spaza shops.",
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
    try:
        sync_to_spaza_uniti()
    except Exception:
        pass

@app.get("/")
def health_check():
    settings = get_store_settings()
    return {
        "status": "online",
        "service": "SpazaKhokha Agentic Backend",
        "node": "Unit #104",
        "platform": "Spaza Uniti",
        "broadcast_to_uniti": settings.get("broadcast_to_uniti", True),
        "open_payments_pointer": "$ilp.rafiki.money/unit-104",
        "interledger": "enabled"
    }

# -----------------------------------------------------------------------------
# Store Settings & Spaza Uniti Broadcast Configuration
# -----------------------------------------------------------------------------
@app.get("/api/settings")
def get_settings():
    return get_store_settings()

@app.put("/api/settings")
def update_settings(payload: StoreSettingsUpdate):
    conn = get_db()
    cursor = conn.cursor()

    current = get_store_settings()
    new_broadcast = payload.broadcast_to_uniti if payload.broadcast_to_uniti is not None else current.get("broadcast_to_uniti", True)
    new_name = payload.store_name if payload.store_name is not None else current.get("store_name", "Mama Zola Spaza")
    new_status = payload.status if payload.status is not None else current.get("status", "OPEN")
    new_hours = payload.operating_hours if payload.operating_hours is not None else current.get("operating_hours", "06:30 - 20:00 Daily")
    new_url = payload.uniti_backend_url if payload.uniti_backend_url is not None else current.get("uniti_backend_url", "http://localhost:8001")

    cursor.execute("""
    UPDATE store_settings
    SET broadcast_to_uniti = ?, store_name = ?, status = ?, operating_hours = ?, uniti_backend_url = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = 'default';
    """, (1 if new_broadcast else 0, new_name, new_status, new_hours, new_url))

    conn.commit()
    conn.close()

    # Trigger live sync to Spaza Uniti discovery network
    sync_result = sync_to_spaza_uniti()

    updated = get_store_settings()
    updated["sync_result"] = sync_result
    return updated

@app.post("/api/settings/sync")
def force_sync():
    result = sync_to_spaza_uniti()
    return result


# -----------------------------------------------------------------------------
# Dashboard & Metrics
# -----------------------------------------------------------------------------
@app.get("/api/dashboard")
def get_dashboard_metrics():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM customers")
    customer_count = cursor.fetchone()[0]

    cursor.execute("SELECT SUM(balance) FROM customers")
    total_outstanding = cursor.fetchone()[0] or 0.0

    cursor.execute("SELECT COUNT(*) FROM customers WHERE balance > 0")
    owing_count = cursor.fetchone()[0]

    cursor.execute("SELECT SUM(amount) FROM purchases")
    purchases_total = cursor.fetchone()[0] or 0.0
    sales_estimate = purchases_total + 240.0

    cursor.execute("SELECT COUNT(*) FROM promotions WHERE active = 1")
    active_promos = cursor.fetchone()[0]

    conn.close()

    return {
        "sales": round(sales_estimate, 2),
        "outstanding": round(total_outstanding, 2),
        "customers_count": customer_count,
        "customers_owing": owing_count,
        "active_promotions": active_promos
    }

# -----------------------------------------------------------------------------
# Customer Management
# -----------------------------------------------------------------------------
@app.get("/api/customers", response_model=List[CustomerResponse])
def get_customers():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/api/customers", response_model=CustomerResponse)
def create_customer(payload: CustomerCreate):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM customers")
    count = cursor.fetchone()[0] + 1
    cust_id = f"CUST-{count:03d}"

    cursor.execute("""
    INSERT INTO customers (id, unit_id, name, phone, credit_limit, balance, stamps, notes)
    VALUES (?, 'unit-104', ?, ?, ?, 0.0, 0, ?);
    """, (cust_id, payload.name, payload.phone, payload.credit_limit, payload.notes))

    conn.commit()
    cursor.execute("SELECT * FROM customers WHERE id = ?", (cust_id,))
    row = cursor.fetchone()
    conn.close()

    return dict(row)

# -----------------------------------------------------------------------------
# Purchases & Credit Tabs
# -----------------------------------------------------------------------------
@app.get("/api/purchases", response_model=List[PurchaseResponse])
def get_purchases():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM purchases ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/api/purchases")
def create_purchase(payload: PurchaseCreate):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM customers WHERE id = ?", (payload.customer_id,))
    cust = cursor.fetchone()
    if not cust:
        conn.close()
        raise HTTPException(status_code=404, detail="Customer not found")

    new_balance = round(cust["balance"] + payload.amount, 2)
    new_stamps = cust["stamps"]
    if "bread" in payload.description.lower():
        new_stamps = (new_stamps + 1) % 10

    cursor.execute("UPDATE customers SET balance = ?, stamps = ? WHERE id = ?", (new_balance, new_stamps, cust["id"]))

    cursor.execute("SELECT COUNT(*) FROM purchases")
    p_count = cursor.fetchone()[0] + 1
    p_id = f"PUR-{p_count}"

    cursor.execute("""
    INSERT INTO purchases (id, customer_id, customer_name, description, amount)
    VALUES (?, ?, ?, ?, ?);
    """, (p_id, cust["id"], cust["name"], payload.description, payload.amount))

    t_id = f"TXN-{p_count + 100}"
    cursor.execute("""
    INSERT INTO transactions (id, type, customer_name, details, amount, method, source)
    VALUES (?, 'purchase', ?, ?, ?, 'Credit Tab', 'Manual UI');
    """, (t_id, cust["name"], payload.description, payload.amount))

    conn.commit()
    conn.close()

    return {
        "status": "success",
        "purchase_id": p_id,
        "new_balance": new_balance,
        "stamps": new_stamps
    }

# -----------------------------------------------------------------------------
# Repayments
# -----------------------------------------------------------------------------
@app.get("/api/repayments", response_model=List[RepaymentResponse])
def get_repayments():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM repayments ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/api/repayments")
def create_repayment(payload: RepaymentCreate):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM customers WHERE id = ?", (payload.customer_id,))
    cust = cursor.fetchone()
    if not cust:
        conn.close()
        raise HTTPException(status_code=404, detail="Customer not found")

    if payload.amount > cust["balance"]:
        conn.close()
        raise HTTPException(status_code=400, detail="Repayment cannot exceed tab balance")

    new_balance = round(cust["balance"] - payload.amount, 2)
    cursor.execute("UPDATE customers SET balance = ? WHERE id = ?", (new_balance, cust["id"]))

    cursor.execute("SELECT COUNT(*) FROM repayments")
    r_count = cursor.fetchone()[0] + 1
    r_id = f"RP-{r_count:04d}"

    cursor.execute("""
    INSERT INTO repayments (id, customer_id, customer_name, amount, method, note)
    VALUES (?, ?, ?, ?, ?, ?);
    """, (r_id, cust["id"], cust["name"], payload.amount, payload.method, payload.note or "Counter repayment"))

    t_id = f"TXN-{r_count + 200}"
    cursor.execute("""
    INSERT INTO transactions (id, type, customer_name, details, amount, method, source)
    VALUES (?, 'repayment', ?, ?, ?, ?, 'Counter POS');
    """, (t_id, cust["name"], payload.note or "Tab repayment", payload.amount, payload.method))

    conn.commit()
    conn.close()

    return {
        "status": "success",
        "repayment_id": r_id,
        "new_balance": new_balance
    }

# -----------------------------------------------------------------------------
# Transactions Audit Trail
# -----------------------------------------------------------------------------
@app.get("/api/transactions", response_model=List[TransactionResponse])
def get_transactions():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM transactions ORDER BY created_at DESC LIMIT 50")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

# -----------------------------------------------------------------------------
# Spaza Uniti Offerings & Promotions
# -----------------------------------------------------------------------------
@app.get("/api/promotions", response_model=List[PromotionResponse])
def get_promotions():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM promotions WHERE active = 1 ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/api/promotions", response_model=PromotionResponse)
def create_promotion(payload: PromotionCreate):
    conn = get_db()
    cursor = conn.cursor()

    discount_pct = max(5, int(((payload.original_price - payload.promo_price) / payload.original_price) * 100)) if payload.original_price > 0 else 15

    cursor.execute("SELECT COUNT(*) FROM promotions")
    promo_count = cursor.fetchone()[0] + 1
    promo_id = f"PROMO-{promo_count:03d}"

    cursor.execute("""
    INSERT INTO promotions (id, unit_id, title, category, original_price, promo_price, discount_pct, days_left, active)
    VALUES (?, 'unit-104', ?, ?, ?, ?, ?, ?, 1);
    """, (promo_id, payload.title, payload.category, payload.original_price, payload.promo_price, discount_pct, payload.days_left))

    conn.commit()
    cursor.execute("SELECT * FROM promotions WHERE id = ?", (promo_id,))
    row = cursor.fetchone()
    conn.close()

    try:
        sync_to_spaza_uniti()
    except Exception:
        pass

    return dict(row)

@app.get("/api/loyalty", response_model=LoyaltyProgramResponse)
def get_loyalty():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM loyalty_programs WHERE unit_id = 'unit-104'")
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="No loyalty program configured")
    return dict(row)

@app.put("/api/loyalty", response_model=LoyaltyProgramResponse)
def update_loyalty(payload: LoyaltyProgramUpdate):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE loyalty_programs SET reward_description = ? WHERE unit_id = 'unit-104'", (payload.reward_description,))
    conn.commit()
    cursor.execute("SELECT * FROM loyalty_programs WHERE unit_id = 'unit-104'")
    row = cursor.fetchone()
    conn.close()

    try:
        sync_to_spaza_uniti()
    except Exception:
        pass

    return dict(row)

# -----------------------------------------------------------------------------
# Agentic AI Co-Pilot Endpoint
# -----------------------------------------------------------------------------
@app.post("/api/agent/chat", response_model=AgentChatResponse)
def agent_chat(payload: AgentChatRequest):
    result = parse_and_execute_agent(payload.user_input, payload.unit_id, payload.history)
    if result.get("tool_called") == "create_promotion":
        try:
            sync_to_spaza_uniti()
        except Exception:
            pass
    return AgentChatResponse(**result)

# -----------------------------------------------------------------------------
# Open Payments & Interledger Gateway
# -----------------------------------------------------------------------------
@app.post("/api/open-payments/create-request", response_model=OpenPaymentsRequestResponse)
def create_op_request(payload: OpenPaymentsRequestCreate):
    return create_incoming_payment_request(payload.customer_id, payload.amount, payload.purpose)

@app.post("/api/open-payments/simulate")
def simulate_payment(payload: Dict[str, Any]):
    return process_open_payments_webhook(payload)

@app.post("/api/open-payments/webhook")
def open_payments_webhook(payload: OpenPaymentsWebhookPayload):
    return process_open_payments_webhook(payload.dict())
