import json
import math
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from .database import get_db

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates spherical distance between two coordinate pairs in kilometers."""
    R = 6371.0  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

def get_nearby_units(
    customer_lat: Optional[float] = None,
    customer_lng: Optional[float] = None,
    radius_km: Optional[float] = None,
    filter_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Returns registered Units for customer discovery.
    Calculates live distance and sorts by proximity when coordinates are supplied.
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM units WHERE broadcast_enabled = 1;
    """)
    rows = cursor.fetchall()
    conn.close()

    results = []
    for r in rows:
        unit = dict(r)
        
        # Parse nested JSON structures safely
        try:
            promos = json.loads(unit.get("promotions_json") or "[]")
        except Exception:
            promos = []
            
        try:
            loyalty = json.loads(unit.get("loyalty_json") or "{}")
        except Exception:
            loyalty = {}
            
        try:
            jobs = json.loads(unit.get("jobs_json") or "[]")
        except Exception:
            jobs = []

        dist_km = None
        dist_meters = None
        if customer_lat is not None and customer_lng is not None:
            dist_km = haversine_distance(customer_lat, customer_lng, unit["latitude"], unit["longitude"])
            dist_meters = int(dist_km * 1000)

        # Apply radius filter if customer supplied radius
        if radius_km is not None and dist_km is not None and dist_km > radius_km:
            continue

        # Extract top promo & loyalty summary
        active_promos = [p for p in promos if p.get("active", True)]
        top_promo = active_promos[0]["title"] if active_promos else None
        has_loyalty = bool(loyalty.get("active", False) and loyalty.get("title"))
        loyalty_summary = loyalty.get("reward_description") if has_loyalty else None

        # Apply feature filters if specified
        if filter_type == "promos" and len(active_promos) == 0:
            continue
        if filter_type == "loyalty" and not has_loyalty:
            continue
        if filter_type == "jobs" and len(jobs) == 0:
            continue

        results.append({
            "id": unit["id"],
            "name": unit["name"],
            "tagline": unit.get("tagline"),
            "address": unit["address"],
            "township": unit["township"],
            "landmark": unit.get("landmark"),
            "latitude": unit["latitude"],
            "longitude": unit["longitude"],
            "distance_km": dist_km,
            "distance_meters": dist_meters,
            "open_payments_id": unit["open_payments_id"],
            "wallet_address_url": unit["wallet_address_url"],
            "status": unit["status"],
            "operating_hours": unit["operating_hours"],
            "broadcast_enabled": bool(unit["broadcast_enabled"]),
            "promotions_count": len(active_promos),
            "has_loyalty": has_loyalty,
            "jobs_count": len(jobs),
            "top_promotion": top_promo,
            "loyalty_summary": loyalty_summary
        })

    # Sort by distance if customer coordinates provided, else by name
    if customer_lat is not None and customer_lng is not None:
        results.sort(key=lambda u: u["distance_km"] if u["distance_km"] is not None else 999999)
    else:
        results.sort(key=lambda u: u["name"])

    return results

def get_unit_detail(
    unit_id: str,
    customer_lat: Optional[float] = None,
    customer_lng: Optional[float] = None
) -> Dict[str, Any]:
    """Retrieves full standardized Unit profile, promos, loyalty, and jobs."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM units WHERE id = ?", (unit_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail=f"Unit '{unit_id}' not found on Spaza Uniti")

    unit = dict(row)
    try:
        promos = json.loads(unit.get("promotions_json") or "[]")
    except Exception:
        promos = []

    try:
        loyalty_raw = json.loads(unit.get("loyalty_json") or "{}")
        if isinstance(loyalty_raw, list):
            loyalty_list = loyalty_raw
            loyalty = loyalty_list[0] if loyalty_list else None
        elif isinstance(loyalty_raw, dict):
            if "programs" in loyalty_raw:
                loyalty_list = loyalty_raw.get("programs", [])
                loyalty = loyalty_raw.get("primary") or (loyalty_list[0] if loyalty_list else None)
            else:
                loyalty = loyalty_raw
                loyalty_list = [loyalty_raw] if (loyalty_raw and loyalty_raw.get("title")) else []
        else:
            loyalty = None
            loyalty_list = []
    except Exception:
        loyalty = None
        loyalty_list = []

    try:
        jobs = json.loads(unit.get("jobs_json") or "[]")
    except Exception:
        jobs = []

    dist_km = None
    if customer_lat is not None and customer_lng is not None:
        dist_km = haversine_distance(customer_lat, customer_lng, unit["latitude"], unit["longitude"])

    return {
        "id": unit["id"],
        "name": unit["name"],
        "tagline": unit.get("tagline"),
        "owner_name": unit["owner_name"],
        "phone": unit["phone"],
        "whatsapp": unit.get("whatsapp"),
        "address": unit["address"],
        "township": unit["township"],
        "landmark": unit.get("landmark"),
        "latitude": unit["latitude"],
        "longitude": unit["longitude"],
        "distance_km": dist_km,
        "open_payments_id": unit["open_payments_id"],
        "wallet_address_url": unit["wallet_address_url"],
        "status": unit["status"],
        "operating_hours": unit["operating_hours"],
        "broadcast_enabled": bool(unit["broadcast_enabled"]),
        "promotions": promos,
        "loyalty_program": loyalty,
        "loyalty_programs": loyalty_list,
        "jobs": jobs,
        "updated_at": unit["updated_at"]
    }

def sync_unit_broadcast(unit_id: str, payload_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sync endpoint called by SpazaKhokha whenever broadcast_to_uniti is enabled.
    Atomically updates promos, loyalty rules, jobs, and operating status.
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM units WHERE id = ?", (unit_id,))
    existing = cursor.fetchone()

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    promos_str = json.dumps(payload_dict.get("promotions", []))
    programs = payload_dict.get("loyalty_programs") or []
    if not programs and payload_dict.get("loyalty_program"):
        programs = [payload_dict.get("loyalty_program")]
    loyalty_str = json.dumps({
        "programs": programs,
        "primary": payload_dict.get("loyalty_program") or (programs[0] if programs else {})
    })
    jobs_str = json.dumps(payload_dict.get("jobs", []))
    broadcast_enabled = 1 if payload_dict.get("broadcast_enabled", True) else 0
    status = payload_dict.get("status", "OPEN")

    if existing:
        cursor.execute("""
        UPDATE units
        SET broadcast_enabled = ?, status = ?, promotions_json = ?, loyalty_json = ?, jobs_json = ?, updated_at = ?
        WHERE id = ?;
        """, (broadcast_enabled, status, promos_str, loyalty_str, jobs_str, now_str, unit_id))
    else:
        # Create minimal unit entry if not registered yet
        cursor.execute("""
        INSERT INTO units (
            id, name, owner_name, phone, address, township, latitude, longitude,
            wallet_address_url, open_payments_id, status, broadcast_enabled,
            promotions_json, loyalty_json, jobs_json, updated_at, created_at
        )
        VALUES (?, ?, 'Spaza Merchant', '0000000000', 'Township Location', 'Soweto', -26.2234, 27.8681,
                ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (unit_id, unit_id.title(), f"http://localhost:8001/{unit_id}", f"$spazauniti.org/{unit_id}",
              status, broadcast_enabled, promos_str, loyalty_str, jobs_str, now_str, now_str))

    conn.commit()
    conn.close()

    promos_list = payload_dict.get("promotions", [])
    jobs_list = payload_dict.get("jobs", [])

    return {
        "unit_id": unit_id,
        "broadcast_enabled": bool(broadcast_enabled),
        "status": status,
        "promotions_synced": len(promos_list),
        "loyalty_synced": bool(payload_dict.get("loyalty_program")),
        "jobs_synced": len(jobs_list),
        "updated_at": now_str,
        "message": f"Unit {unit_id} broadcast successfully updated on Spaza Uniti network."
    }
