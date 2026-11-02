import os
import re
from typing import Dict, Any, Optional
from fastapi import HTTPException
from .database import get_db

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
        "wallet_address_url": row["wallet_address_url"],
        "open_payments_id": f"${get_base_url().replace('http://', '').replace('https://', '')}/{row['username']}",
        "asset_code": "ZAR",
        "asset_scale": 2,
        "status": row["status"]
    }

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
    if not re.match(r"^[a-zA-Z0-9]{3,20}$", clean):
        return {
            "available": False,
            "username": clean,
            "reason": "Must be strictly alphanumeric (3-20 characters, no symbols or spaces)"
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
