import os
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from fastapi import HTTPException
from .database import get_db, verify_pin

def create_outgoing_grant(
    username: str,
    amount: float,
    merchant_id: str,
    merchant_name: str,
    merchant_wallet: str,
    purpose: str
) -> Dict[str, Any]:
    clean_user = username.strip().lower().lstrip("@")
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM customers WHERE username = ?", (clean_user,))
    cust = cursor.fetchone()
    if not cust:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Customer @{clean_user} not found on Spaza Uniti")

    if cust["balance"] < amount:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient wallet balance. Available: R{cust['balance']:.2f}, Required: R{amount:.2f}"
        )

    grant_id = f"grant_{uuid.uuid4().hex[:12]}"
    now = datetime.now()
    created_at = now.strftime("%Y-%m-%d %H:%M:%S")
    expires_at = (now + timedelta(minutes=5)).strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
    INSERT INTO payment_grants (id, customer_id, username, merchant_id, merchant_name, merchant_wallet, amount, purpose, status, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_CONSENT', ?, ?);
    """, (grant_id, cust["id"], clean_user, merchant_id, merchant_name, merchant_wallet, amount, purpose, created_at, expires_at))

    conn.commit()
    conn.close()

    base_url = os.environ.get("SPAZA_UNITI_BASE_URL", "http://localhost:8001")
    interactive_url = f"{base_url}/consent/{grant_id}"

    return {
        "grant_id": grant_id,
        "username": clean_user,
        "handle": f"@{clean_user}",
        "amount": amount,
        "currency": "ZAR",
        "merchant_id": merchant_id,
        "merchant_name": merchant_name,
        "purpose": purpose,
        "status": "PENDING_CONSENT",
        "consent_method": None,
        "interactive_consent_url": interactive_url,
        "fallback_available": "COUNTER_PIN",
        "created_at": created_at,
        "expires_at": expires_at
    }

def approve_grant(grant_id: str, consent_method: str = "INTERACTIVE_LINK") -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM payment_grants WHERE id = ?", (grant_id,))
    grant = cursor.fetchone()
    if not grant:
        conn.close()
        raise HTTPException(status_code=404, detail="Grant request not found")

    if grant["status"] != "PENDING_CONSENT":
        conn.close()
        raise HTTPException(status_code=400, detail=f"Grant is already {grant['status']}")

    expires = datetime.strptime(grant["expires_at"], "%Y-%m-%d %H:%M:%S")
    if datetime.now() > expires:
        cursor.execute("UPDATE payment_grants SET status = 'EXPIRED' WHERE id = ?", (grant_id,))
        conn.commit()
        conn.close()
        raise HTTPException(status_code=410, detail="Grant has expired")

    cursor.execute("SELECT * FROM customers WHERE id = ?", (grant["customer_id"],))
    cust = cursor.fetchone()
    if not cust or cust["balance"] < grant["amount"]:
        conn.close()
        raise HTTPException(status_code=400, detail="Insufficient funds at execution time")

    # Deduct balance
    new_balance = round(cust["balance"] - grant["amount"], 2)
    cursor.execute("UPDATE customers SET balance = ? WHERE id = ?", (new_balance, cust["id"]))

    # Update grant status
    cursor.execute("""
    UPDATE payment_grants 
    SET status = 'APPROVED', consent_method = ?
    WHERE id = ?;
    """, (consent_method, grant_id))

    # Log ILP transaction
    tx_id = f"tx_{uuid.uuid4().hex[:12]}"
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ilp_ref = f"ilp.packet.zar.{uuid.uuid4().hex[:16]}"

    cursor.execute("""
    INSERT INTO transactions (id, customer_id, username, type, counterparty, amount, purpose, status, ilp_packet_ref, created_at)
    VALUES (?, ?, ?, 'OUTGOING', ?, ?, ?, 'COMPLETED', ?, ?);
    """, (tx_id, cust["id"], cust["username"], grant["merchant_name"], grant["amount"], grant["purpose"], ilp_ref, now_str))

    # Mirror into UbuOne unified ledger so Unit & Consumer dashboards reflect Spaza Uniti purchases immediately
    merchant_unit_id = grant["merchant_id"] if grant["merchant_id"] else "unit-104"
    ledger_id = f"u1l_{uuid.uuid4().hex[:10]}"
    desc = f"Spaza Uniti Checkout: {grant['purpose']}"
    cursor.execute("""
    INSERT INTO ubuone_ledger (
        id, event_type, unit_id, staff_username, from_username, to_username,
        amount_ubu, fee_zar, description, source_bucket, created_at
    )
    VALUES (?, 'COUNTER_SALE', ?, 'spaza_uniti_online', ?, ?, ?, 0.0, ?, 'OPEN_PAYMENTS_ZAR', ?);
    """, (ledger_id, merchant_unit_id, cust["username"], merchant_unit_id, grant["amount"], desc, now_str))

    cursor.execute(
        "UPDATE units SET ubu_balance = round(COALESCE(ubu_balance, 0.0) + ?, 2) WHERE id = ?",
        (grant["amount"], merchant_unit_id)
    )

    conn.commit()
    conn.close()

    method_label = "SMS/WhatsApp Interactive Link" if consent_method == "INTERACTIVE_LINK" else "4-Digit Counter PIN"

    return {
        "grant_id": grant_id,
        "status": "APPROVED",
        "transaction_id": tx_id,
        "amount": grant["amount"],
        "currency": "ZAR",
        "new_wallet_balance": new_balance,
        "new_balance": new_balance,
        "merchant_name": grant["merchant_name"],
        "consent_method": consent_method,
        "message": f"Payment of R{grant['amount']:.2f} to {grant['merchant_name']} approved successfully via {method_label}!"
    }


def verify_grant_with_pin(grant_id: str, pin: str) -> Dict[str, Any]:
    """Option B fallback: verifies 4-digit PIN at the counter and unlocks the grant."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT g.*, c.pin_hash 
    FROM payment_grants g 
    JOIN customers c ON g.customer_id = c.id 
    WHERE g.id = ?;
    """, (grant_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Grant request not found")

    if not verify_pin(pin, row["pin_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect 4-digit counter security PIN")

    return approve_grant(grant_id, consent_method="COUNTER_PIN")

def get_grant_details(grant_id: str) -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT g.*, c.full_name, c.wallet_address_url, c.balance as current_balance
    FROM payment_grants g
    JOIN customers c ON g.customer_id = c.id
    WHERE g.id = ?;
    """, (grant_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Grant not found")

    return dict(row)
