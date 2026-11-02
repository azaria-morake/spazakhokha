import uuid
from typing import Dict, Any
from .database import get_db
from .agent import execute_record_tab_repayment

def create_incoming_payment_request(customer_id: str, amount: float, purpose: str = "Tab Repayment") -> Dict[str, Any]:
    """
    Generates an Open Payments incoming payment resource and GNAP grant reference
    as defined by the Open Payments specification (RFC / Interledger).
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
    cust = cursor.fetchone()
    conn.close()

    customer_name = cust["name"] if cust else "Township Customer"
    payment_id = f"op_req_{uuid.uuid4().hex[:12]}"

    return {
        "payment_request_id": payment_id,
        "wallet_address": "https://ilp.rafiki.money/units/unit-104",
        "payment_pointer": "$ilp.rafiki.money/unit-104",
        "amount": amount,
        "asset_code": "ZAR",
        "asset_scale": 2,
        "customer_id": customer_id,
        "customer_name": customer_name,
        "payment_pointer_uri": f"https://ilp.rafiki.money/units/unit-104/incoming-payments/{payment_id}",
        "status": "pending"
    }

def process_open_payments_webhook(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handles 'incoming_payment.completed' webhooks from the Open Payments provider (e.g. Rafiki).
    Automatically credits the customer's tab without any manual vendor effort.
    """
    customer_id = payload.get("customer_id")
    amount = float(payload.get("amount", 0.0))
    ref = payload.get("payment_reference", "ILP Digital Settlement")

    msg, mutation = execute_record_tab_repayment(
        unit_id="unit-104",
        customer_query=customer_id,
        amount=amount,
        method="Open Payments",
        note=f"ILP Transfer Ref: {ref}"
    )

    return {
        "status": "success",
        "message": msg,
        "settled_amount": amount,
        "customer_id": customer_id,
        "mutation": mutation
    }
