import os
import re
from typing import Dict, Any, List, Optional
from fastapi import HTTPException
from .database import get_db

USERNAME_PATTERN = r"^[a-zA-Z0-9][a-zA-Z0-9_]{1,22}[a-zA-Z0-9]$"

def get_base_url() -> str:
    return os.environ.get("SPAZA_UNITI_BASE_URL", "http://localhost:8001")

def resolve_username(username: str) -> Dict[str, Any]:
    clean = username.strip().lower().lstrip("@")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers WHERE username = ?", (clean,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {
            "found": False,
            "username": clean,
            "handle": f"@{clean}",
            "status": "NOT_FOUND"
        }

    return {
        "found": True,
        "customer_id": row["id"],
        "username": row["username"],
        "handle": f"@{row['username']}",
        "full_name": row["full_name"],
        "account_type": row["account_type"] if "account_type" in row.keys() else "INDIVIDUAL",
        "wallet_address_url": row["wallet_address_url"],
        "open_payments_id": f"${get_base_url().replace('http://', '').replace('https://', '')}/{row['username']}",
        "asset_code": "ZAR",
        "asset_scale": 2,
        "status": row["status"]
    }

def search_consumers(query: str, exclude_username: Optional[str] = None) -> List[Dict[str, Any]]:
    """Search existing active accounts by handle or name for beneficiary invites."""
    clean_q = query.strip().lower().lstrip("@")
    if not clean_q:
        return []

    excl = exclude_username.strip().lower().lstrip("@") if exclude_username else ""
    like_pat = f"%{clean_q}%"

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, username, full_name, account_type, status
    FROM customers
    WHERE status = 'ACTIVE'
      AND (lower(username) LIKE ? OR lower(full_name) LIKE ?)
      AND lower(username) != ?
    ORDER BY username ASC
    LIMIT 15;
    """, (like_pat, like_pat, excl))
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "customer_id": r["id"],
            "username": r["username"],
            "handle": f"@{r['username']}",
            "full_name": r["full_name"],
            "account_type": r["account_type"],
            "status": r["status"]
        }
        for r in rows
    ]

def get_wallet_address_doc(username: str) -> Dict[str, Any]:
    """Standard Open Payments Wallet Address Resource specification."""
    clean = username.strip().lower().lstrip("@")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers WHERE username = ?", (clean,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail=f"Open Payments Wallet Address '{username}' does not exist.")

    base_url = get_base_url()
    return {
        "id": f"{base_url}/{row['username']}",
        "publicName": row["full_name"],
        "assetCode": "ZAR",
        "assetScale": 2,
        "authServer": f"{base_url}/auth",
        "resourceServer": base_url
    }

def check_username_available(username: str) -> Dict[str, Any]:
    clean = username.strip().lower().lstrip("@")
    if not re.match(USERNAME_PATTERN, clean):
        return {
            "available": False,
            "username": clean,
            "reason": "Must be 3-24 characters (letters, numbers, or internal underscores, no spaces)"
        }

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM customers WHERE username = ?", (clean,))
    exists = cursor.fetchone() is not None
    conn.close()

    return {
        "available": not exists,
        "username": clean,
        "handle": f"@{clean}",
        "reason": "Username already taken" if exists else "Available"
    }
