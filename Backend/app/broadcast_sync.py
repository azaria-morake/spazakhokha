import logging
from typing import Dict, Any, Optional
import httpx
from .database import get_db

logger = logging.getLogger("spazakhokha.broadcast")

def get_store_settings() -> Dict[str, Any]:
    """Retrieves current store settings including broadcast toggle."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM store_settings WHERE id = 'default'")
    row = cursor.fetchone()
    conn.close()
    if row:
        res = dict(row)
        res["broadcast_to_uniti"] = bool(res["broadcast_to_uniti"])
        return res
    return {
        "id": "default",
        "unit_id": "unit-104",
        "store_name": "Mama Zola Spaza",
        "broadcast_to_uniti": True,
        "uniti_backend_url": "http://localhost:8001",
        "status": "OPEN",
        "operating_hours": "06:30 - 20:00 Daily"
    }

def sync_to_spaza_uniti() -> Dict[str, Any]:
    """
    Broadcasts current promotions, loyalty rules, jobs, and operating status
    to the centralized SpazaUniti discovery network.
    Respects the shop admin's boolean toggle (broadcast_to_uniti).
    """
    settings = get_store_settings()
    unit_id = settings.get("unit_id", "unit-104")
    broadcast_enabled = settings.get("broadcast_to_uniti", True)
    backend_url = settings.get("uniti_backend_url", "http://localhost:8001").rstrip("/")

    conn = get_db()
    cursor = conn.cursor()

    promotions_list = []
    if broadcast_enabled:
        cursor.execute("SELECT * FROM promotions WHERE active = 1 ORDER BY created_at DESC")
        p_rows = cursor.fetchall()
        for p in p_rows:
            promotions_list.append({
                "id": p["id"],
                "title": p["title"],
                "category": p["category"],
                "original_price": float(p["original_price"]),
                "promo_price": float(p["promo_price"]),
                "discount_pct": int(p["discount_pct"]),
                "days_left": int(p["days_left"]),
                "active": True
            })

    loyalty_dict = None
    if broadcast_enabled:
        cursor.execute("SELECT * FROM loyalty_programs WHERE unit_id = ? AND active = 1", (unit_id,))
        l_row = cursor.fetchone()
        if l_row:
            loyalty_dict = {
                "title": l_row["title"],
                "reward_description": l_row["reward_description"],
                "stamps_required": int(l_row["stamps_required"]),
                "active": True
            }

    conn.close()

    # Community township jobs broadcasted by Mama Zola
    jobs_list = []
    if broadcast_enabled:
        jobs_list = [
            {
                "title": "Weekend Inventory Packer",
                "pay": "R120 / half-day shift",
                "schedule": "Saturdays & Sundays 07:00 - 12:00",
                "description": "Help unpack bread crates, restock shelves, and tally simba inventory."
            },
            {
                "title": "Morning Bread & Dairy Runner",
                "pay": "R80 / delivery round",
                "schedule": "Mon-Fri 06:30 - 08:30",
                "description": "Walk early morning milk and Albany bread orders to elderly pensioners in Zone 2."
            }
        ]

    payload = {
        "broadcast_enabled": broadcast_enabled,
        "status": settings.get("status", "OPEN"),
        "promotions": promotions_list,
        "loyalty_program": loyalty_dict,
        "jobs": jobs_list
    }

    url = f"{backend_url}/api/units/{unit_id}/broadcast"
    try:
        with httpx.Client(timeout=3.5) as client:
            resp = client.put(url, json=payload)
            if resp.status_code == 200:
                logger.info(f"Successfully broadcasted unit {unit_id} to Spaza Uniti: {resp.json()}")
                return {
                    "synced": True,
                    "broadcast_enabled": broadcast_enabled,
                    "unit_id": unit_id,
                    "response": resp.json()
                }
            else:
                logger.warning(f"Failed broadcast sync: {resp.status_code} {resp.text}")
                return {
                    "synced": False,
                    "broadcast_enabled": broadcast_enabled,
                    "error": f"HTTP {resp.status_code}: {resp.text}"
                }
    except Exception as e:
        logger.error(f"Error reaching Spaza Uniti backend at {url}: {e}")
        return {
            "synced": False,
            "broadcast_enabled": broadcast_enabled,
            "error": str(e)
        }
