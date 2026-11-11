import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from fastapi import HTTPException
from .database import get_db, hash_pin
from .resolver import get_base_url
from .models import (
    FundUbuRequest,
    FamilyMemberCreateRequest,
    FamilyMemberUpdateRequest,
    BeneficiaryInviteRequest,
    BeneficiaryAllocateRequest
)

def _reset_period_if_needed(cursor, link_row) -> float:
    """Resets spent_in_period_ubu if a new day/week/month has started."""
    spent = float(link_row["spent_in_period_ubu"] or 0.0)
    last_date_str = link_row["last_reset_date"]
    period = (link_row["period"] or "DAILY").upper()
    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")

    should_reset = False
    try:
        last_dt = datetime.strptime(last_date_str, "%Y-%m-%d")
        if period == "DAILY" and last_date_str != today_str:
            should_reset = True
        elif period == "WEEKLY" and (now - last_dt).days >= 7:
            should_reset = True
        elif period == "MONTHLY" and (now.year != last_dt.year or now.month != last_dt.month):
            should_reset = True
    except Exception:
        should_reset = True

    if should_reset:
        cursor.execute(
            "UPDATE consumer_links SET spent_in_period_ubu = 0.0, last_reset_date = ? WHERE id = ?",
            (today_str, link_row["id"])
        )
        return 0.0
    return spent

def _row_to_allocation_summary(cursor, row) -> Dict[str, Any]:
    spent = _reset_period_if_needed(cursor, row)
    limit = float(row["allocation_limit_ubu"] or 0.0)
    remaining = max(0.0, round(limit - spent, 2))
    keys = row.keys()
    return {
        "link_id": row["id"],
        "sponsor_username": row["sponsor_username"],
        "member_username": row["member_username"],
        "member_full_name": row["member_full_name"] if "member_full_name" in keys else None,
        "sponsor_full_name": row["sponsor_full_name"] if "sponsor_full_name" in keys else None,
        "link_type": row["link_type"],
        "relationship_label": row["relationship_label"],
        "status": row["status"],
        "allocation_limit_ubu": limit,
        "period": row["period"],
        "spent_in_period_ubu": round(spent, 2),
        "remaining_in_period_ubu": remaining,
        "sponsor_pool_balance_ubu": float(row["sponsor_pool_balance_ubu"]) if "sponsor_pool_balance_ubu" in keys and row["sponsor_pool_balance_ubu"] is not None else None,
        "allowed_categories": row["allowed_categories"],
        "created_at": row["created_at"]
    }

def get_consumer_profile_full(username: str) -> Dict[str, Any]:
    clean = username.strip().lower().lstrip("@")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers WHERE username = ?", (clean,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Customer @{clean} not found")

    # Unit-scoped loyalty reward tokens
    cursor.execute("SELECT unit_id, ubu_balance FROM customer_tokens WHERE username = ?", (clean,))
    token_rows = cursor.fetchall()
    tokens_map = {r["unit_id"]: float(r["ubu_balance"]) for r in token_rows}
    total_tokens = sum(tokens_map.values())

    # Outgoing links where this consumer is the sponsor (Family members & Beneficiaries)
    cursor.execute("""
    SELECT l.*, c.full_name AS member_full_name
    FROM consumer_links l
    LEFT JOIN customers c ON l.member_username = c.username
    WHERE l.sponsor_username = ?
    ORDER BY l.created_at ASC;
    """, (clean,))
    sponsored_rows = cursor.fetchall()

    family_members = []
    beneficiaries = []
    for sr in sponsored_rows:
        summary = _row_to_allocation_summary(cursor, sr)
        if sr["link_type"] == "FAMILY_MEMBER":
            family_members.append(summary)
        else:
            beneficiaries.append(summary)

    # Incoming links where this consumer receives an allowance or pending invitation
    cursor.execute("""
    SELECT l.*, c.full_name AS sponsor_full_name, c.ubu_balance AS sponsor_pool_balance_ubu
    FROM consumer_links l
    JOIN customers c ON l.sponsor_username = c.username
    WHERE l.member_username = ?
    ORDER BY l.created_at DESC;
    """, (clean,))
    incoming_rows = cursor.fetchall()
    incoming_allocations = [_row_to_allocation_summary(cursor, ir) for ir in incoming_rows]
    pending_count = sum(1 for x in incoming_allocations if x["status"] == "PENDING")

    conn.commit()
    conn.close()

    base_url = get_base_url()
    account_type = row["account_type"] if "account_type" in row.keys() else "INDIVIDUAL"
    family_parent = row["family_parent_username"] if "family_parent_username" in row.keys() else None
    ubu_bal = float(row["ubu_balance"]) if "ubu_balance" in row.keys() and row["ubu_balance"] is not None else 0.0

    return {
        "customer_id": row["id"],
        "username": row["username"],
        "handle": f"@{row['username']}",
        "full_name": row["full_name"],
        "cell_number": row["cell_number"],
        "open_payments_id": f"${base_url.replace('http://', '').replace('https://', '')}/{row['username']}",
        "wallet_address_url": row["wallet_address_url"],
        "balance": float(row["balance"]),
        "ubu_balance": round(ubu_bal, 2),
        "account_type": account_type,
        "family_parent_username": family_parent,
        "asset_code": "ZAR",
        "asset_scale": 2,
        "status": row["status"],
        "created_at": row["created_at"],
        "ubuntu_tokens": tokens_map,
        "total_ubuntu_tokens": total_tokens,
        "cashout_eligible": total_tokens >= 20.0,
        "min_cashout_threshold": 20.0,
        "family_members": family_members,
        "beneficiaries": beneficiaries,
        "incoming_allocations": incoming_allocations,
        "pending_invitations_count": pending_count
    }

def fund_ubu_wallet(username: str, payload: FundUbuRequest) -> Dict[str, Any]:
    """
    1 Single Open Payments / Cash-In Inflow into Uniti-Wide Spendable UBU Wallet (1 UBU = R1.00).
    Supports funding from existing Open Payments ZAR balance OR external Open Payments inflow.
    """
    clean = username.strip().lower().lstrip("@")
    source = payload.source.strip().upper()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers WHERE username = ?", (clean,))
    cust = cursor.fetchone()
    if not cust:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Customer @{clean} not found")

    fiat_bal = float(cust["balance"])
    ubu_bal = float(cust["ubu_balance"] or 0.0)

    if source == "WALLET_BALANCE":
        if fiat_bal < payload.amount:
            conn.close()
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient ZAR wallet balance (R{fiat_bal:.2f}) to convert R{payload.amount:.2f} into UBU"
            )
        fiat_bal = round(fiat_bal - payload.amount, 2)

    new_ubu = round(ubu_bal + payload.amount, 2)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute(
        "UPDATE customers SET balance = ?, ubu_balance = ? WHERE id = ?",
        (fiat_bal, new_ubu, cust["id"])
    )

    tx_id = f"tx_ubu_{uuid.uuid4().hex[:10]}"
    ilp_ref = f"ilp.ubu.inflow.{uuid.uuid4().hex[:12]}"
    cursor.execute("""
    INSERT INTO transactions (id, customer_id, username, type, counterparty, amount, purpose, status, ilp_packet_ref, created_at)
    VALUES (?, ?, ?, 'INCOMING', ?, ?, ?, 'COMPLETED', ?, ?);
    """, (tx_id, cust["id"], clean, f"UbuOne Pool ({source})", payload.amount, payload.note or "Deposit to UBU Wallet", ilp_ref, now_str))

    cursor.execute("""
    INSERT INTO ubuone_ledger (id, event_type, unit_id, staff_username, from_username, to_username, amount_ubu, fee_zar, description, source_bucket, created_at)
    VALUES (?, 'UBU_DEPOSIT', NULL, NULL, ?, ?, ?, 0.0, ?, ?, ?);
    """, (f"u1l_{uuid.uuid4().hex[:10]}", source, clean, payload.amount, payload.note or "Single Open Payments UBU Funding", source, now_str))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "username": clean,
        "amount_funded_ubu": round(payload.amount, 2),
        "new_ubu_balance": new_ubu,
        "new_fiat_balance": fiat_bal,
        "transaction_ref": tx_id,
        "message": f"1 Open Payments inflow settled: +{payload.amount:.2f} UBU added to @{clean}'s spendable UBU wallet."
    }

def add_family_member(family_username: str, payload: FamilyMemberCreateRequest) -> Dict[str, Any]:
    fam = family_username.strip().lower().lstrip("@")
    member = payload.member_username.strip().lower().lstrip("@")
    if fam == member:
        raise HTTPException(status_code=400, detail="Cannot add the family vault handle as its own sub-member")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers WHERE username = ?", (fam,))
    fam_row = cursor.fetchone()
    if not fam_row:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Family vault @{fam} not found")
    if (fam_row["account_type"] or "INDIVIDUAL").upper() != "FAMILY":
        conn.close()
        raise HTTPException(status_code=400, detail=f"@{fam} is an INDIVIDUAL account. Use Beneficiary Invitations instead, or create a FAMILY account.")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    today_str = datetime.now().strftime("%Y-%m-%d")
    base_url = get_base_url()

    # Check if member account already exists; if not, provision under family username
    cursor.execute("SELECT * FROM customers WHERE username = ?", (member,))
    mem_row = cursor.fetchone()
    if not mem_row:
        display_name = (payload.full_name or member).strip()
        cust_id = f"cust_{uuid.uuid4().hex[:12]}"
        cursor.execute("""
        INSERT INTO customers (
            id, username, full_name, cell_number, pin_hash, wallet_address_url,
            balance, ubu_balance, account_type, family_parent_username, status, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 0.0, 0.0, 'INDIVIDUAL', ?, 'ACTIVE', ?);
        """, (
            cust_id, member, display_name, (payload.cell_number or "0720000000").strip(),
            hash_pin(payload.pin or "1234"), f"{base_url}/{member}", fam, now_str
        ))
    else:
        cursor.execute("UPDATE customers SET family_parent_username = COALESCE(family_parent_username, ?) WHERE username = ?", (fam, member))

    cursor.execute(
        "SELECT * FROM consumer_links WHERE sponsor_username = ? AND member_username = ? AND link_type = 'FAMILY_MEMBER'",
        (fam, member)
    )
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail=f"@{member} is already linked under @{fam}")

    link_id = f"lnk_{uuid.uuid4().hex[:10]}"
    cursor.execute("""
    INSERT INTO consumer_links (
        id, sponsor_username, member_username, link_type, relationship_label,
        status, allocation_limit_ubu, period, spent_in_period_ubu, last_reset_date,
        allowed_categories, created_at
    )
    VALUES (?, ?, ?, 'FAMILY_MEMBER', ?, 'ACCEPTED', ?, ?, 0.0, ?, ?, ?);
    """, (
        link_id, fam, member, payload.relationship_label.strip(),
        payload.daily_limit_ubu, payload.period.upper(), today_str,
        payload.allowed_categories.strip(), now_str
    ))

    conn.commit()
    conn.close()
    return get_consumer_profile_full(fam)

def update_family_member(family_username: str, member_username: str, payload: FamilyMemberUpdateRequest) -> Dict[str, Any]:
    fam = family_username.strip().lower().lstrip("@")
    member = member_username.strip().lower().lstrip("@")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM consumer_links WHERE sponsor_username = ? AND member_username = ? AND link_type = 'FAMILY_MEMBER'",
        (fam, member)
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Family member @{member} not found under @{fam}")

    new_limit = payload.allocation_limit_ubu if payload.allocation_limit_ubu is not None else row["allocation_limit_ubu"]
    new_status = payload.status.upper() if payload.status and payload.status.upper() in ("ACCEPTED", "FROZEN") else row["status"]
    new_cats = payload.allowed_categories if payload.allowed_categories is not None else row["allowed_categories"]
    new_rel = payload.relationship_label if payload.relationship_label is not None else row["relationship_label"]

    cursor.execute("""
    UPDATE consumer_links
    SET allocation_limit_ubu = ?, status = ?, allowed_categories = ?, relationship_label = ?
    WHERE id = ?;
    """, (new_limit, new_status, new_cats, new_rel, row["id"]))
    conn.commit()
    conn.close()
    return get_consumer_profile_full(fam)

def invite_beneficiary(sponsor_username: str, payload: BeneficiaryInviteRequest) -> Dict[str, Any]:
    """
    Allows an individual adult (or family admin) to search & invite an existing account
    (girlfriend, sibling, friend, etc.) as a beneficiary.
    """
    sponsor = sponsor_username.strip().lower().lstrip("@")
    ben = payload.beneficiary_username.strip().lower().lstrip("@")
    if sponsor == ben:
        raise HTTPException(status_code=400, detail="Cannot invite your own username as a beneficiary")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM customers WHERE username = ?", (sponsor,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail=f"Sponsor @{sponsor} not found")

    cursor.execute("SELECT * FROM customers WHERE username = ?", (ben,))
    ben_row = cursor.fetchone()
    if not ben_row:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Account @{ben} not found. Beneficiaries must have a registered account first.")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    today_str = datetime.now().strftime("%Y-%m-%d")

    cursor.execute(
        "SELECT * FROM consumer_links WHERE sponsor_username = ? AND member_username = ? AND link_type = 'BENEFICIARY'",
        (sponsor, ben)
    )
    existing = cursor.fetchone()
    if existing:
        if existing["status"] in ("PENDING", "ACCEPTED"):
            conn.close()
            raise HTTPException(status_code=400, detail=f"Beneficiary link with @{ben} is already {existing['status']}")
        cursor.execute("""
        UPDATE consumer_links
        SET status = 'PENDING', relationship_label = ?, allocation_limit_ubu = ?, period = ?, allowed_categories = ?
        WHERE id = ?;
        """, (
            payload.relationship_label.strip(), payload.allowance_limit_ubu,
            payload.period.upper(), payload.allowed_categories.strip(), existing["id"]
        ))
    else:
        link_id = f"ben_{uuid.uuid4().hex[:10]}"
        cursor.execute("""
        INSERT INTO consumer_links (
            id, sponsor_username, member_username, link_type, relationship_label,
            status, allocation_limit_ubu, period, spent_in_period_ubu, last_reset_date,
            allowed_categories, created_at
        )
        VALUES (?, ?, ?, 'BENEFICIARY', ?, 'PENDING', ?, ?, 0.0, ?, ?, ?);
        """, (
            link_id, sponsor, ben, payload.relationship_label.strip(),
            payload.allowance_limit_ubu, payload.period.upper(), today_str,
            payload.allowed_categories.strip(), now_str
        ))

    conn.commit()
    conn.close()
    return get_consumer_profile_full(sponsor)

def respond_to_invitation(link_id: str, username: str, action: str) -> Dict[str, Any]:
    clean = username.strip().lower().lstrip("@")
    act = action.strip().upper()
    if act not in ("ACCEPT", "DECLINE"):
        raise HTTPException(status_code=400, detail="action must be ACCEPT or DECLINE")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM consumer_links WHERE id = ?", (link_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Invitation not found")
    if row["member_username"] != clean:
        conn.close()
        raise HTTPException(status_code=403, detail="You can only respond to invitations addressed to your handle")
    if row["status"] != "PENDING":
        conn.close()
        raise HTTPException(status_code=400, detail=f"Invitation is already {row['status']}")

    new_status = "ACCEPTED" if act == "ACCEPT" else "DECLINED"
    cursor.execute("UPDATE consumer_links SET status = ? WHERE id = ?", (new_status, link_id))
    conn.commit()
    conn.close()
    return get_consumer_profile_full(clean)

def allocate_to_beneficiary(sponsor_username: str, link_id: str, payload: BeneficiaryAllocateRequest) -> Dict[str, Any]:
    sponsor = sponsor_username.strip().lower().lstrip("@")
    mode = payload.mode.strip().upper()
    if mode not in ("TRANSFER", "ALLOWANCE_CAP"):
        raise HTTPException(status_code=400, detail="mode must be TRANSFER or ALLOWANCE_CAP")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM consumer_links WHERE id = ? AND sponsor_username = ?", (link_id, sponsor))
    link = cursor.fetchone()
    if not link:
        conn.close()
        raise HTTPException(status_code=404, detail="Beneficiary link not found")
    if link["status"] != "ACCEPTED":
        conn.close()
        raise HTTPException(status_code=400, detail=f"Beneficiary @{link['member_username']} has not accepted the invitation yet (status: {link['status']})")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if mode == "ALLOWANCE_CAP":
        cursor.execute("UPDATE consumer_links SET allocation_limit_ubu = ? WHERE id = ?", (payload.amount_ubu, link_id))
        conn.commit()
        conn.close()
        return {
            "success": True,
            "mode": mode,
            "message": f"Updated {link['period'].lower()} allowance cap for @{link['member_username']} to {payload.amount_ubu:.2f} UBU.",
            "profile": get_consumer_profile_full(sponsor)
        }

    # Mode == TRANSFER (Instant zero-fee UBU gift into beneficiary's personal UBU wallet)
    if payload.amount_ubu <= 0:
        conn.close()
        raise HTTPException(status_code=400, detail="Transfer amount must be greater than 0")

    cursor.execute("SELECT * FROM customers WHERE username = ?", (sponsor,))
    sponsor_row = cursor.fetchone()
    cursor.execute("SELECT * FROM customers WHERE username = ?", (link["member_username"],))
    ben_row = cursor.fetchone()
    if not sponsor_row or not ben_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Account record missing")

    sponsor_ubu = float(sponsor_row["ubu_balance"] or 0.0)
    if sponsor_ubu < payload.amount_ubu:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient spendable UBU. Available: {sponsor_ubu:.2f} UBU, Requested: {payload.amount_ubu:.2f} UBU"
        )

    new_sponsor_ubu = round(sponsor_ubu - payload.amount_ubu, 2)
    new_ben_ubu = round(float(ben_row["ubu_balance"] or 0.0) + payload.amount_ubu, 2)
    cursor.execute("UPDATE customers SET ubu_balance = ? WHERE username = ?", (new_sponsor_ubu, sponsor))
    cursor.execute("UPDATE customers SET ubu_balance = ? WHERE username = ?", (new_ben_ubu, link["member_username"]))

    ilp_ref = f"ilp.ubu.p2p.{uuid.uuid4().hex[:12]}"
    note = payload.note or f"Zero-fee UBU allocation ({link['relationship_label']})"
    cursor.execute("""
    INSERT INTO transactions (id, customer_id, username, type, counterparty, amount, purpose, status, ilp_packet_ref, created_at)
    VALUES (?, ?, ?, 'OUTGOING', ?, ?, ?, 'COMPLETED', ?, ?);
    """, (f"tx_{uuid.uuid4().hex[:10]}", sponsor_row["id"], sponsor, f"@{link['member_username']} ({link['relationship_label']})", payload.amount_ubu, note, ilp_ref, now_str))
    cursor.execute("""
    INSERT INTO transactions (id, customer_id, username, type, counterparty, amount, purpose, status, ilp_packet_ref, created_at)
    VALUES (?, ?, ?, 'INCOMING', ?, ?, ?, 'COMPLETED', ?, ?);
    """, (f"tx_{uuid.uuid4().hex[:10]}", ben_row["id"], link["member_username"], f"@{sponsor} (Sponsor)", payload.amount_ubu, note, ilp_ref, now_str))

    cursor.execute("""
    INSERT INTO ubuone_ledger (id, event_type, unit_id, staff_username, from_username, to_username, amount_ubu, fee_zar, description, source_bucket, created_at)
    VALUES (?, 'BENEFICIARY_TRANSFER', NULL, NULL, ?, ?, ?, 0.0, ?, 'PERSONAL_UBU', ?);
    """, (f"u1l_{uuid.uuid4().hex[:10]}", sponsor, link["member_username"], payload.amount_ubu, note, now_str))

    conn.commit()
    conn.close()
    return {
        "success": True,
        "mode": mode,
        "message": f"Sent {payload.amount_ubu:.2f} UBU instantly to @{link['member_username']} at R0 fee!",
        "profile": get_consumer_profile_full(sponsor)
    }

def remove_beneficiary_link(username: str, link_id: str) -> Dict[str, Any]:
    clean = username.strip().lower().lstrip("@")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM consumer_links WHERE id = ?", (link_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Link not found")
    if clean not in (row["sponsor_username"], row["member_username"]):
        conn.close()
        raise HTTPException(status_code=403, detail="Not authorized to remove this link")
    cursor.execute("DELETE FROM consumer_links WHERE id = ?", (link_id,))
    conn.commit()
    conn.close()
    return {"status": "removed", "link_id": link_id}

def debit_consumer_ubu(
    cursor,
    cust_row,
    amount_ubu: float,
    source_mode: str = "AUTO",
    sponsor_username: Optional[str] = None
) -> Tuple[str, str, Dict[str, Any]]:
    """
    Executes inside an open DB transaction.
    Supports spending from:
      - PERSONAL_UBU: customer's own ubu_balance
      - FAMILY_POOL / BENEFICIARY_POOL: sponsor's pool up to allocation_limit_ubu
      - AUTO: tries PERSONAL_UBU first if balance suffices, else falls back to active FAMILY/BENEFICIARY allowances.
    Returns (source_bucket, debited_vault_username, metadata_dict).
    """
    uname = cust_row["username"]
    mode = (source_mode or "AUTO").strip().upper()
    personal_ubu = float(cust_row["ubu_balance"] or 0.0)

    def try_personal() -> Optional[Tuple[str, str, Dict[str, Any]]]:
        if personal_ubu >= amount_ubu:
            new_bal = round(personal_ubu - amount_ubu, 2)
            cursor.execute("UPDATE customers SET ubu_balance = ? WHERE username = ?", (new_bal, uname))
            return ("PERSONAL_UBU", uname, {"remaining_personal_ubu": new_bal})
        return None

    def try_allowance(link_types: List[str]) -> Optional[Tuple[str, str, Dict[str, Any]]]:
        placeholders = ",".join("?" for _ in link_types)
        params: List[Any] = [uname, *link_types]
        sql = f"""
        SELECT l.*, s.ubu_balance AS sponsor_ubu_bal
        FROM consumer_links l
        JOIN customers s ON l.sponsor_username = s.username
        WHERE l.member_username = ?
          AND l.status = 'ACCEPTED'
          AND l.link_type IN ({placeholders})
          AND l.allocation_limit_ubu > 0
        """
        if sponsor_username:
            sql += " AND l.sponsor_username = ?"
            params.append(sponsor_username.strip().lower().lstrip("@"))
        sql += " ORDER BY l.created_at ASC"
        cursor.execute(sql, tuple(params))
        rows = cursor.fetchall()

        for lr in rows:
            spent = _reset_period_if_needed(cursor, lr)
            limit = float(lr["allocation_limit_ubu"] or 0.0)
            remaining_cap = round(limit - spent, 2)
            sponsor_pool = float(lr["sponsor_ubu_bal"] or 0.0)
            if remaining_cap >= amount_ubu and sponsor_pool >= amount_ubu:
                new_sponsor_bal = round(sponsor_pool - amount_ubu, 2)
                new_spent = round(spent + amount_ubu, 2)
                cursor.execute("UPDATE customers SET ubu_balance = ? WHERE username = ?", (new_sponsor_bal, lr["sponsor_username"]))
                cursor.execute("UPDATE consumer_links SET spent_in_period_ubu = ? WHERE id = ?", (new_spent, lr["id"]))
                bucket = "FAMILY_POOL" if lr["link_type"] == "FAMILY_MEMBER" else "BENEFICIARY_POOL"
                return (bucket, lr["sponsor_username"], {
                    "sponsor_username": lr["sponsor_username"],
                    "relationship": lr["relationship_label"],
                    "period": lr["period"],
                    "spent_in_period_ubu": new_spent,
                    "allocation_limit_ubu": limit,
                    "remaining_in_period_ubu": round(limit - new_spent, 2),
                    "sponsor_pool_remaining_ubu": new_sponsor_bal
                })
        return None

    if mode == "PERSONAL_UBU":
        res = try_personal()
        if not res:
            raise HTTPException(status_code=400, detail=f"Insufficient Personal Spendable UBU ({personal_ubu:.2f} UBU available, need {amount_ubu:.2f} UBU)")
        return res

    if mode == "FAMILY_POOL":
        res = try_allowance(["FAMILY_MEMBER"])
        if not res:
            raise HTTPException(status_code=400, detail="Insufficient remaining Family Allowance or Family Vault UBU balance")
        return res

    if mode == "BENEFICIARY_POOL":
        res = try_allowance(["BENEFICIARY"])
        if not res:
            raise HTTPException(status_code=400, detail="Insufficient remaining Beneficiary Allowance or Sponsor UBU balance")
        return res

    # AUTO strategy
    res = try_personal()
    if res:
        return res
    res = try_allowance(["FAMILY_MEMBER", "BENEFICIARY"])
    if res:
        return res

    raise HTTPException(
        status_code=400,
        detail=f"Insufficient spendable UBU for @{uname} (Personal: {personal_ubu:.2f} UBU; no active allowance covers {amount_ubu:.2f} UBU)"
    )

