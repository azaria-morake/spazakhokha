import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from fastapi import HTTPException, Depends
from .database import get_db, verify_pin
from .rbac import extract_token
from .models import ConsumerLoginRequest, ConsumerPayUnitRequest
from .consumers import get_consumer_profile_full, debit_consumer_ubu

ALLOWED_FAMILY_ROLES = ("FAMILY_ADMIN", "FAMILY_MEMBER")


def _resolve_consumer_role(cursor, cust_row) -> Tuple[str, Optional[str], Any]:
    """
    Resolves live consumer RBAC role:
      - FAMILY_ADMIN: Family Vault owner (@morake_ext_5) OR a sub-member promoted to FAMILY_ADMIN (@mannimorake)
      - FAMILY_MEMBER: Restricted child / dependent under a family vault (@lethabomorake)
      - FROZEN: Access temporarily suspended by a Family Admin
      - ADULT_INDIVIDUAL: Autonomous adult account managing personal UBU & beneficiaries
    Returns (role, family_vault_username, link_row).
    """
    account_type = (cust_row["account_type"] or "INDIVIDUAL").upper()
    uname = cust_row["username"]

    if account_type == "FAMILY":
        return ("FAMILY_ADMIN", uname, None)

    parent = cust_row["family_parent_username"]
    if parent:
        cursor.execute(
            """
            SELECT * FROM consumer_links
            WHERE sponsor_username = ? AND member_username = ? AND link_type = 'FAMILY_MEMBER'
            """,
            (parent, uname),
        )
        link = cursor.fetchone()
        if link:
            if (link["status"] or "").upper() == "FROZEN":
                return ("FROZEN", parent, link)
            f_role = (link["family_role"] or "FAMILY_MEMBER").upper() if "family_role" in link.keys() else "FAMILY_MEMBER"
            if f_role not in ALLOWED_FAMILY_ROLES:
                f_role = "FAMILY_MEMBER"
            return (f_role, parent, link)

    return ("ADULT_INDIVIDUAL", None, None)


def login_consumer(payload: ConsumerLoginRequest) -> Dict[str, Any]:
    clean = payload.username.strip().lower().lstrip("@")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers WHERE lower(username) = ?", (clean,))
    cust = cursor.fetchone()

    if not cust or not verify_pin(payload.pin.strip(), cust["pin_hash"]):
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid consumer @handle or 4-digit PIN")

    if (cust["status"] or "ACTIVE").upper() != "ACTIVE":
        conn.close()
        raise HTTPException(status_code=403, detail="Consumer account is disabled")

    role, family_vault, _ = _resolve_consumer_role(cursor, cust)
    if role == "FROZEN":
        conn.close()
        raise HTTPException(
            status_code=403,
            detail=f"RBAC Blocked: @{clean} is currently FROZEN by a Family Admin under @{family_vault}."
        )

    token = f"u1c_{uuid.uuid4().hex}"
    now = datetime.now()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")
    expires_str = (now + timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute(
        """
        INSERT INTO ubuone_consumer_sessions (
            token, customer_id, username, full_name, account_type, consumer_role,
            family_parent_username, created_at, expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
        (
            token,
            cust["id"],
            cust["username"],
            cust["full_name"],
            cust["account_type"] or "INDIVIDUAL",
            role,
            family_vault,
            now_str,
            expires_str,
        ),
    )
    conn.commit()
    conn.close()

    profile = get_consumer_profile_full(clean)
    return {
        "token": token,
        "actor": {
            "customer_id": cust["id"],
            "username": cust["username"],
            "full_name": cust["full_name"],
            "account_type": cust["account_type"] or "INDIVIDUAL",
            "consumer_role": role,
            "family_vault_username": family_vault,
        },
        "profile": profile,
    }


def logout_consumer(token: str) -> Dict[str, str]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM ubuone_consumer_sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()
    return {"status": "logged_out"}


def get_current_consumer(token: str = Depends(extract_token)) -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM ubuone_consumer_sessions WHERE token = ?", (token,))
    sess = cursor.fetchone()
    if not sess:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid or expired UbuOne consumer session")

    expires = datetime.strptime(sess["expires_at"], "%Y-%m-%d %H:%M:%S")
    if datetime.now() > expires:
        conn.close()
        raise HTTPException(status_code=401, detail="Consumer session expired. Please sign in again.")

    cursor.execute("SELECT * FROM customers WHERE username = ?", (sess["username"],))
    cust = cursor.fetchone()
    if not cust or (cust["status"] or "ACTIVE").upper() != "ACTIVE":
        conn.close()
        raise HTTPException(status_code=403, detail="Consumer account unavailable")

    live_role, family_vault, _ = _resolve_consumer_role(cursor, cust)
    conn.close()

    if live_role == "FROZEN":
        raise HTTPException(
            status_code=403,
            detail=f"RBAC Blocked: @{cust['username']} is FROZEN by a Family Admin."
        )

    return {
        "customer_id": cust["id"],
        "username": cust["username"],
        "full_name": cust["full_name"],
        "account_type": cust["account_type"] or "INDIVIDUAL",
        "consumer_role": live_role,
        "family_vault_username": family_vault,
        "token": token,
    }


def assert_family_scope(actor: Dict[str, Any], family_username: str) -> str:
    fam = family_username.strip().lower().lstrip("@")
    if actor["username"] == fam:
        return fam
    if actor.get("family_vault_username") == fam:
        return fam
    raise HTTPException(
        status_code=403,
        detail=f"RBAC Denied: @{actor['username']} does not belong to Family Vault @{fam}"
    )


def assert_family_admin(actor: Dict[str, Any], family_username: str) -> str:
    fam = assert_family_scope(actor, family_username)
    if actor.get("consumer_role") != "FAMILY_ADMIN":
        raise HTTPException(
            status_code=403,
            detail=f"RBAC Denied: Role '{actor.get('consumer_role')}' is restricted. Only a FAMILY_ADMIN can manage members, roles, limits, or pool funding for @{fam}."
        )
    return fam


def get_family_overview(family_username: str, actor: Dict[str, Any]) -> Dict[str, Any]:
    fam = assert_family_scope(actor, family_username)
    fam_profile = get_consumer_profile_full(fam)
    all_members = fam_profile.get("family_members", [])
    member_handles = [m["member_username"] for m in all_members]

    conn = get_db()
    cursor = conn.cursor()

    if actor["consumer_role"] == "FAMILY_ADMIN":
        handles = [fam, *member_handles]
        placeholders = ",".join("?" for _ in handles)
        cursor.execute(
            f"""
            SELECT * FROM ubuone_ledger
            WHERE from_username IN ({placeholders}) OR to_username IN ({placeholders})
            ORDER BY created_at DESC LIMIT 40;
            """,
            (*handles, *handles),
        )
        ledger_rows = [dict(r) for r in cursor.fetchall()]
        visible_members = all_members
        my_alloc = next((m for m in all_members if m["member_username"] == actor["username"]), None)
    else:
        # Strict RBAC scope: FAMILY_MEMBER sees ONLY their own allowance and own transactions
        cursor.execute(
            """
            SELECT * FROM ubuone_ledger
            WHERE from_username = ? OR to_username = ?
            ORDER BY created_at DESC LIMIT 40;
            """,
            (actor["username"], actor["username"]),
        )
        ledger_rows = [dict(r) for r in cursor.fetchall()]
        visible_members = []
        my_alloc = next((m for m in all_members if m["member_username"] == actor["username"]), None)

    conn.close()

    total_allocated_daily = sum(float(m.get("allocation_limit_ubu") or 0.0) for m in all_members if m.get("status") == "ACCEPTED")
    total_spent_period = sum(float(m.get("spent_in_period_ubu") or 0.0) for m in all_members)
    pool_deposits = sum(float(r["amount_ubu"] or 0.0) for r in ledger_rows if r["event_type"] == "UBU_DEPOSIT" and r["to_username"] == fam)

    return {
        "family_vault": {
            "username": fam_profile["username"],
            "handle": fam_profile["handle"],
            "full_name": fam_profile["full_name"],
            "open_payments_id": fam_profile["open_payments_id"],
            "ubu_balance": fam_profile["ubu_balance"],
            "zar_balance": fam_profile["balance"],
        },
        "actor_role": actor["consumer_role"],
        "actor_username": actor["username"],
        "my_allocation": my_alloc,
        "family_members": visible_members,
        "ledger": ledger_rows,
        "metrics": {
            "member_count": len(all_members),
            "admin_count": 1 + sum(1 for m in all_members if m.get("family_role") == "FAMILY_ADMIN"),
            "total_allocated_limits_ubu": round(total_allocated_daily, 2),
            "total_spent_period_ubu": round(total_spent_period, 2),
            "pool_deposits_ubu": round(pool_deposits, 2),
        },
    }


def get_consumer_workspace(username: str, actor: Dict[str, Any]) -> Dict[str, Any]:
    clean = username.strip().lower().lstrip("@")
    if actor["username"] != clean:
        # Allow a FAMILY_ADMIN to view workspace of their sub-member if needed
        profile_target = get_consumer_profile_full(clean)
        if not (
            actor["consumer_role"] == "FAMILY_ADMIN"
            and profile_target.get("family_parent_username") == actor.get("family_vault_username")
        ):
            raise HTTPException(status_code=403, detail=f"RBAC Denied: Cannot inspect workspace for @{clean}")
    else:
        profile_target = get_consumer_profile_full(clean)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM transactions WHERE username = ? ORDER BY created_at DESC LIMIT 40",
        (clean,),
    )
    tx_rows = [dict(r) for r in cursor.fetchall()]

    cursor.execute(
        """
        SELECT * FROM ubuone_ledger
        WHERE from_username = ? OR to_username = ?
        ORDER BY created_at DESC LIMIT 40
        """,
        (clean, clean),
    )
    ledger_rows = [dict(r) for r in cursor.fetchall()]

    cursor.execute(
        """
        SELECT id, name, tagline, township, open_payments_id, broadcast_enabled, status, ubu_balance
        FROM units WHERE status = 'OPEN' ORDER BY id ASC
        """
    )
    unit_rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    my_family_link = None
    if profile_target.get("family_parent_username"):
        my_family_link = next(
            (
                inc
                for inc in profile_target.get("incoming_allocations", [])
                if inc.get("link_type") == "FAMILY_MEMBER"
                and inc.get("sponsor_username") == profile_target.get("family_parent_username")
            ),
            None,
        )

    return {
        "profile": profile_target,
        "consumer_role": actor["consumer_role"] if actor["username"] == clean else (my_family_link or {}).get("family_role", "FAMILY_MEMBER"),
        "family_vault_username": profile_target.get("family_parent_username") or (profile_target["username"] if profile_target["account_type"] == "FAMILY" else None),
        "my_family_link": my_family_link,
        "transactions": tx_rows,
        "ledger": ledger_rows,
        "units": unit_rows,
    }


def pay_unit_from_consumer(username: str, actor: Dict[str, Any], payload: ConsumerPayUnitRequest) -> Dict[str, Any]:
    clean = username.strip().lower().lstrip("@")
    if actor["username"] != clean:
        raise HTTPException(status_code=403, detail="RBAC Denied: Can only initiate purchases from your own signed-in handle")

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM customers WHERE username = ?", (clean,))
    cust = cursor.fetchone()
    if not cust:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Customer @{clean} not found")

    cursor.execute("SELECT * FROM units WHERE id = ?", (payload.unit_id.strip(),))
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

    # Reward loyalty Ubuntu Tokens (10% up to 2 UBU per transaction)
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
        VALUES (?, 'COUNTER_SALE', ?, 'self_checkout', ?, ?, ?, 0.0, ?, ?, ?);
        """,
        (ledger_id, unit["id"], clean, unit["id"], round(payload.amount_ubu, 2), desc, source_bucket, now_str),
    )

    ilp_ref = f"ilp.ubuone.self.{uuid.uuid4().hex[:10]}"
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
        "debit_details": debit_meta,
        "reward_tokens_earned": reward_earned,
        "new_unit_balance": new_unit_ubu,
        "message": f"Paid {payload.amount_ubu:.2f} UBU to {unit['name']} from {source_bucket} at R0.00 fee!",
    }
