import json
import uuid
from datetime import datetime
from typing import Dict, Any, List
from fastapi import HTTPException
from .database import get_db, verify_pin
from .consumers import debit_consumer_ubu
from .models import (
    CounterChargeRequest,
    ChangeInUbuRequest,
    UnitSettlementRequest,
    UnitLoyaltyCreateRequest,
    UnitPromoCreateRequest
)

def _load_loyalty_list(loyalty_json_str: str) -> List[Dict[str, Any]]:
    try:
        raw = json.loads(loyalty_json_str or "{}")
        if isinstance(raw, list):
            return raw
        if isinstance(raw, dict):
            if "programs" in raw and isinstance(raw["programs"], list):
                return raw["programs"]
            if raw.get("title"):
                return [raw]
    except Exception:
        pass
    return []

def _save_loyalty_list(cursor, unit_id: str, programs: List[Dict[str, Any]]):
    active_progs = [p for p in programs if p.get("active", True)]
    primary = active_progs[0] if active_progs else (programs[0] if programs else {})
    payload = json.dumps({"programs": programs, "primary": primary})
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("UPDATE units SET loyalty_json = ?, updated_at = ? WHERE id = ?", (payload, now_str, unit_id))

def get_unit_overview(unit_id: str, staff: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM units WHERE id = ?", (unit_id,))
    unit = cursor.fetchone()
    if not unit:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Unit '{unit_id}' not found")

    if staff["role"] == "UNIT_CASHIER":
        cursor.execute("""
        SELECT * FROM ubuone_ledger
        WHERE unit_id = ? AND staff_username = ?
        ORDER BY created_at DESC LIMIT 50;
        """, (unit_id, staff["username"]))
    else:
        cursor.execute("""
        SELECT * FROM ubuone_ledger
        WHERE unit_id = ?
        ORDER BY created_at DESC LIMIT 100;
        """, (unit_id,))
    ledger_rows = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT COUNT(*) FROM unit_staff WHERE unit_id = ? AND active = 1", (unit_id,))
    active_staff_count = cursor.fetchone()[0]
    conn.close()

    counter_sales = [r for r in ledger_rows if r["event_type"] == "COUNTER_SALE"]
    today_prefix = datetime.now().strftime("%Y-%m-%d")
    today_volume = sum(float(r["amount_ubu"]) for r in counter_sales if (r["created_at"] or "").startswith(today_prefix))
    micro_under_10 = sum(1 for r in counter_sales if float(r["amount_ubu"]) <= 10.0)
    change_issued = sum(float(r["amount_ubu"]) for r in ledger_rows if r["event_type"] == "CHANGE_IN_UBU")

    promos = json.loads(unit["promotions_json"] or "[]")
    loyalty = _load_loyalty_list(unit["loyalty_json"])

    return {
        "unit_id": unit["id"],
        "unit_name": unit["name"],
        "township": unit["township"],
        "open_payments_id": unit["open_payments_id"],
        "status": unit["status"],
        "broadcast_enabled": bool(unit["broadcast_enabled"]),
        "unit_ubu_balance": round(float(unit["ubu_balance"] or 0.0), 2) if staff["role"] in ("UNIT_OWNER", "NETWORK_ADMIN") else None,
        "metrics": {
            "today_counter_volume_ubu": round(today_volume, 2),
            "counter_tx_count": len(counter_sales),
            "micro_under_10_count": micro_under_10,
            "change_in_ubu_issued": round(change_issued, 2),
            "active_loyalty_count": len([p for p in loyalty if p.get("active", True)]),
            "active_promos_count": len([p for p in promos if p.get("active", True)]),
            "active_staff_count": active_staff_count
        },
        "ledger": ledger_rows
    }

def process_counter_charge(unit_id: str, staff: Dict[str, Any], payload: CounterChargeRequest) -> Dict[str, Any]:
    """
    Executes a zero-fee UBU counter purchase (e.g. R1 Lollipop via @lethabomorake + 4-digit PIN).
    Accessible to UNIT_CASHIER & UNIT_OWNER.
    """
    clean_cust = payload.customer_username.strip().lower().lstrip("@")
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM units WHERE id = ?", (unit_id,))
    unit = cursor.fetchone()
    if not unit:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Unit '{unit_id}' not found")

    cursor.execute("SELECT * FROM customers WHERE username = ?", (clean_cust,))
    cust = cursor.fetchone()
    if not cust:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Customer handle '@{clean_cust}' not found")

    if not verify_pin(payload.pin.strip(), cust["pin_hash"]):
        conn.close()
        raise HTTPException(status_code=401, detail="Incorrect customer 4-digit Counter Security PIN")

    source_bucket, debited_vault, debit_meta = debit_consumer_ubu(
        cursor=cursor,
        cust_row=cust,
        amount_ubu=payload.amount_ubu,
        source_mode=payload.source_mode,
        sponsor_username=payload.sponsor_username
    )

    new_unit_ubu = round(float(unit["ubu_balance"] or 0.0) + payload.amount_ubu, 2)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("UPDATE units SET ubu_balance = ?, updated_at = ? WHERE id = ?", (new_unit_ubu, now_str, unit_id))

    loyalty_earned = round(max(0.10, payload.amount_ubu * 0.10), 2)
    cursor.execute("SELECT * FROM customer_tokens WHERE username = ? AND unit_id = ?", (clean_cust, unit_id))
    tok_row = cursor.fetchone()
    if tok_row:
        new_tok_bal = round(float(tok_row["ubu_balance"]) + loyalty_earned, 2)
        cursor.execute("UPDATE customer_tokens SET ubu_balance = ?, updated_at = ? WHERE id = ?", (new_tok_bal, now_str, tok_row["id"]))
    else:
        new_tok_bal = loyalty_earned
        cursor.execute(
            "INSERT INTO customer_tokens (id, username, unit_id, ubu_balance, updated_at) VALUES (?, ?, ?, ?, ?)",
            (f"tok_{uuid.uuid4().hex[:8]}", clean_cust, unit_id, new_tok_bal, now_str)
        )

    ledger_id = f"u1l_{uuid.uuid4().hex[:10]}"
    desc = f"{payload.items_description} ({source_bucket}: @{debited_vault})"
    cursor.execute("""
    INSERT INTO ubuone_ledger (
        id, event_type, unit_id, staff_username, from_username, to_username,
        amount_ubu, fee_zar, description, source_bucket, created_at
    )
    VALUES (?, 'COUNTER_SALE', ?, ?, ?, ?, ?, 0.0, ?, ?, ?);
    """, (ledger_id, unit_id, staff["username"], clean_cust, unit_id, payload.amount_ubu, desc, source_bucket, now_str))

    tx_owner = debited_vault
    cursor.execute("SELECT id FROM customers WHERE username = ?", (tx_owner,))
    owner_row = cursor.fetchone()
    if owner_row:
        cursor.execute("""
        INSERT INTO transactions (id, customer_id, username, type, counterparty, amount, purpose, status, ilp_packet_ref, created_at)
        VALUES (?, ?, ?, 'OUTGOING', ?, ?, ?, 'COMPLETED', ?, ?);
        """, (
            f"tx_{uuid.uuid4().hex[:10]}", owner_row["id"], tx_owner,
            unit["name"], payload.amount_ubu,
            f"Counter UBU (@{clean_cust}): {payload.items_description}",
            f"ilp.ubuone.counter.{uuid.uuid4().hex[:12]}", now_str
        ))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "ledger_id": ledger_id,
        "customer_username": clean_cust,
        "amount_ubu": round(payload.amount_ubu, 2),
        "fee_zar": 0.0,
        "source_bucket": source_bucket,
        "debited_vault": debited_vault,
        "debit_details": debit_meta,
        "unit_reward_ubu_earned": loyalty_earned,
        "customer_unit_reward_balance": new_tok_bal,
        "message": f"Charged {payload.amount_ubu:.2f} UBU (R{payload.amount_ubu:.2f}) from @{clean_cust} ({source_bucket}) at R0 fee!",
        "created_at": now_str
    }

def issue_change_in_ubu(unit_id: str, staff: Dict[str, Any], payload: ChangeInUbuRequest) -> Dict[str, Any]:
    """
    Cashier returns exact loose cash change in Uniti-Wide Spendable UBU directly to @handle.
    """
    if payload.cash_received <= payload.sale_total:
        raise HTTPException(status_code=400, detail="cash_received must exceed sale_total to issue Change-in-UBU")

    change_ubu = round(payload.cash_received - payload.sale_total, 2)
    clean_cust = payload.customer_username.strip().lower().lstrip("@")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM units WHERE id = ?", (unit_id,))
    unit = cursor.fetchone()
    if not unit:
        conn.close()
        raise HTTPException(status_code=404, detail="Unit not found")

    cursor.execute("SELECT * FROM customers WHERE username = ?", (clean_cust,))
    cust = cursor.fetchone()
    if not cust:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Customer handle '@{clean_cust}' not found")

    unit_ubu = float(unit["ubu_balance"] or 0.0)
    if unit_ubu < change_ubu:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Unit UBU float ({unit_ubu:.2f} UBU) is lower than change {change_ubu:.2f} UBU")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    new_unit_ubu = round(unit_ubu - change_ubu, 2)
    new_cust_ubu = round(float(cust["ubu_balance"] or 0.0) + change_ubu, 2)

    cursor.execute("UPDATE units SET ubu_balance = ?, updated_at = ? WHERE id = ?", (new_unit_ubu, now_str, unit_id))
    cursor.execute("UPDATE customers SET ubu_balance = ? WHERE username = ?", (new_cust_ubu, clean_cust))

    ledger_id = f"u1l_{uuid.uuid4().hex[:10]}"
    desc = f"R{payload.cash_received:.2f} cash for R{payload.sale_total:.2f} sale -> {change_ubu:.2f} UBU change ({payload.note})"
    cursor.execute("""
    INSERT INTO ubuone_ledger (
        id, event_type, unit_id, staff_username, from_username, to_username,
        amount_ubu, fee_zar, description, source_bucket, created_at
    )
    VALUES (?, 'CHANGE_IN_UBU', ?, ?, ?, ?, ?, 0.0, ?, 'CASH_DRAWER', ?);
    """, (ledger_id, unit_id, staff["username"], unit_id, clean_cust, change_ubu, desc, now_str))

    cursor.execute("""
    INSERT INTO transactions (id, customer_id, username, type, counterparty, amount, purpose, status, ilp_packet_ref, created_at)
    VALUES (?, ?, ?, 'INCOMING', ?, ?, ?, 'COMPLETED', ?, ?);
    """, (
        f"tx_{uuid.uuid4().hex[:10]}", cust["id"], clean_cust,
        f"{unit['name']} (Change-in-UBU)", change_ubu, desc,
        f"ilp.ubuone.change.{uuid.uuid4().hex[:12]}", now_str
    ))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "ledger_id": ledger_id,
        "customer_username": clean_cust,
        "change_ubu": change_ubu,
        "new_customer_ubu_balance": new_cust_ubu,
        "message": f"Issued {change_ubu:.2f} UBU change directly to @{clean_cust} (No coins needed)!",
        "created_at": now_str
    }

def create_unit_settlement(unit_id: str, staff: Dict[str, Any], payload: UnitSettlementRequest) -> Dict[str, Any]:
    """
    UNIT_OWNER / NETWORK_ADMIN ONLY.
    Closed-loop Wholesaler Open Payments (R0 fee) vs Batched Bank EFT (R3.50 flat fee).
    """
    stype = payload.settlement_type.strip().upper()
    if stype not in ("BATCHED_BANK_EFT", "WHOLESALER_OPEN_PAYMENTS"):
        raise HTTPException(status_code=400, detail="settlement_type must be BATCHED_BANK_EFT or WHOLESALER_OPEN_PAYMENTS")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM units WHERE id = ?", (unit_id,))
    unit = cursor.fetchone()
    if not unit:
        conn.close()
        raise HTTPException(status_code=404, detail="Unit not found")

    avail_ubu = float(unit["ubu_balance"] or 0.0)
    if avail_ubu < payload.amount_ubu:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Insufficient Unit UBU balance ({avail_ubu:.2f} UBU available)")

    fee_zar = 0.0 if stype == "WHOLESALER_OPEN_PAYMENTS" else 3.50
    if payload.amount_ubu <= fee_zar:
        conn.close()
        raise HTTPException(status_code=400, detail="Settlement amount must exceed bank fee")

    net_payout = round(payload.amount_ubu - fee_zar, 2)
    new_unit_ubu = round(avail_ubu - payload.amount_ubu, 2)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("UPDATE units SET ubu_balance = ?, updated_at = ? WHERE id = ?", (new_unit_ubu, now_str, unit_id))

    ledger_id = f"u1l_{uuid.uuid4().hex[:10]}"
    desc = f"{stype} -> {payload.destination_pointer} (Net R{net_payout:.2f} settled, Fee R{fee_zar:.2f})"
    cursor.execute("""
    INSERT INTO ubuone_ledger (
        id, event_type, unit_id, staff_username, from_username, to_username,
        amount_ubu, fee_zar, description, source_bucket, created_at
    )
    VALUES (?, 'UNIT_SETTLEMENT', ?, ?, ?, ?, ?, ?, ?, 'OPEN_PAYMENTS', ?);
    """, (ledger_id, unit_id, staff["username"], unit_id, payload.destination_pointer, payload.amount_ubu, fee_zar, desc, now_str))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "settlement_id": ledger_id,
        "settlement_type": stype,
        "gross_ubu": round(payload.amount_ubu, 2),
        "fee_zar": fee_zar,
        "net_settled_zar": net_payout,
        "remaining_unit_ubu": new_unit_ubu,
        "message": f"Settled {payload.amount_ubu:.2f} UBU to {payload.destination_pointer} (Fee: R{fee_zar:.2f})."
    }

def get_unit_loyalty_programs(unit_id: str) -> List[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT loyalty_json FROM units WHERE id = ?", (unit_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Unit not found")
    return _load_loyalty_list(row["loyalty_json"])

def create_unit_loyalty_program(unit_id: str, payload: UnitLoyaltyCreateRequest) -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT loyalty_json FROM units WHERE id = ?", (unit_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Unit not found")

    programs = _load_loyalty_list(row["loyalty_json"])
    threshold = payload.reward_threshold_ubu if payload.reward_threshold_ubu is not None else payload.item_price_zar
    rate = payload.token_rate_per_event if payload.token_rate_per_event is not None else round(threshold / max(1, payload.stamps_or_count), 2)

    new_prog = {
        "id": f"LOYALTY-{uuid.uuid4().hex[:6].upper()}",
        "unit_id": unit_id,
        "title": payload.title.strip(),
        "program_type": payload.program_type,
        "community_pact": payload.community_pact.strip(),
        "target_item": payload.target_item.strip(),
        "item_price_zar": float(payload.item_price_zar),
        "reward_threshold_ubu": float(threshold),
        "token_rate_per_event": float(rate),
        "stamps_or_count": int(payload.stamps_or_count),
        "stamps_required": int(payload.stamps_or_count),
        "reward_description": f"{payload.community_pact.strip()} ({float(threshold):.2f} UBU Reward)",
        "active": bool(payload.active)
    }
    programs.insert(0, new_prog)
    _save_loyalty_list(cursor, unit_id, programs)
    conn.commit()
    conn.close()
    return new_prog

def toggle_unit_loyalty_program(unit_id: str, program_id: str) -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT loyalty_json FROM units WHERE id = ?", (unit_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Unit not found")

    programs = _load_loyalty_list(row["loyalty_json"])
    target = None
    for p in programs:
        if p.get("id") == program_id:
            p["active"] = not p.get("active", True)
            target = p
            break
    if not target:
        conn.close()
        raise HTTPException(status_code=404, detail="Loyalty program not found")

    _save_loyalty_list(cursor, unit_id, programs)
    conn.commit()
    conn.close()
    return target

def delete_unit_loyalty_program(unit_id: str, program_id: str) -> Dict[str, str]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT loyalty_json FROM units WHERE id = ?", (unit_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Unit not found")

    programs = _load_loyalty_list(row["loyalty_json"])
    filtered = [p for p in programs if p.get("id") != program_id]
    if len(filtered) == len(programs):
        conn.close()
        raise HTTPException(status_code=404, detail="Loyalty program not found")

    _save_loyalty_list(cursor, unit_id, filtered)
    conn.commit()
    conn.close()
    return {"status": "deleted", "id": program_id}

def get_unit_promotions(unit_id: str) -> List[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT promotions_json FROM units WHERE id = ?", (unit_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Unit not found")
    return json.loads(row["promotions_json"] or "[]")

def create_unit_promotion(unit_id: str, payload: UnitPromoCreateRequest) -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT promotions_json FROM units WHERE id = ?", (unit_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Unit not found")

    promos = json.loads(row["promotions_json"] or "[]")
    discount_pct = round(((payload.original_price - payload.promo_price) / max(0.01, payload.original_price)) * 100)
    new_promo = {
        "id": f"PROMO-{uuid.uuid4().hex[:6].upper()}",
        "title": payload.title.strip(),
        "category": payload.category,
        "original_price": float(payload.original_price),
        "promo_price": float(payload.promo_price),
        "discount_pct": max(1, int(discount_pct)),
        "days_left": int(payload.days_left),
        "active": True
    }
    promos.insert(0, new_promo)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("UPDATE units SET promotions_json = ?, updated_at = ? WHERE id = ?", (json.dumps(promos), now_str, unit_id))
    conn.commit()
    conn.close()
    return new_promo

def delete_unit_promotion(unit_id: str, promo_id: str) -> Dict[str, str]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT promotions_json FROM units WHERE id = ?", (unit_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Unit not found")

    promos = json.loads(row["promotions_json"] or "[]")
    filtered = [p for p in promos if p.get("id") != promo_id]
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("UPDATE units SET promotions_json = ?, updated_at = ? WHERE id = ?", (json.dumps(filtered), now_str, unit_id))
    conn.commit()
    conn.close()
    return {"status": "deleted", "id": promo_id}

def toggle_unit_broadcast(unit_id: str, enabled: bool) -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("UPDATE units SET broadcast_enabled = ?, updated_at = ? WHERE id = ?", (1 if enabled else 0, now_str, unit_id))
    conn.commit()
    conn.close()
    return {"unit_id": unit_id, "broadcast_enabled": enabled}

def get_network_admin_summary() -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, owner_name, township, open_payments_id, status, broadcast_enabled, ubu_balance FROM units ORDER BY id")
    units = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT COUNT(*), COALESCE(SUM(ubu_balance), 0) FROM customers")
    cust_count, total_cust_ubu = cursor.fetchone()

    cursor.execute("SELECT COUNT(*), COALESCE(SUM(amount_ubu), 0) FROM ubuone_ledger WHERE event_type = 'COUNTER_SALE'")
    counter_count, counter_vol = cursor.fetchone()

    cursor.execute("SELECT * FROM ubuone_ledger ORDER BY created_at DESC LIMIT 30")
    recent_ledger = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return {
        "units": units,
        "total_units": len(units),
        "total_consumers": cust_count,
        "total_consumer_ubu_float": round(float(total_cust_ubu), 2),
        "total_unit_ubu_float": round(sum(float(u["ubu_balance"] or 0.0) for u in units), 2),
        "counter_sales_count": counter_count,
        "counter_sales_volume_ubu": round(float(counter_vol), 2),
        "recent_ledger": recent_ledger
    }
