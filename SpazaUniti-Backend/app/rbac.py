import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from fastapi import Header, HTTPException, Depends
from .database import get_db, hash_pin, verify_pin
from .models import UbuFlowLoginRequest, StaffCreateRequest

def login_staff(payload: UbuFlowLoginRequest) -> Dict[str, Any]:
    clean_user = payload.username.strip().lower().lstrip("@")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM unit_staff WHERE lower(username) = ?", (clean_user,))
    staff = cursor.fetchone()

    if not staff or not verify_pin(payload.passcode.strip(), staff["passcode_hash"]):
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid operator username or passcode")

    if not staff["active"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Operator account is suspended. Contact your Unit Owner.")

    token = f"uf_{uuid.uuid4().hex}"
    now = datetime.now()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")
    expires_str = (now + timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
    INSERT INTO ubuflow_sessions (token, staff_id, username, full_name, unit_id, role, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    """, (token, staff["id"], staff["username"], staff["full_name"], staff["unit_id"], staff["role"], now_str, expires_str))

    unit_name = None
    if staff["unit_id"]:
        cursor.execute("SELECT name FROM units WHERE id = ?", (staff["unit_id"],))
        u = cursor.fetchone()
        unit_name = u["name"] if u else staff["unit_id"]

    conn.commit()
    conn.close()

    return {
        "token": token,
        "staff": {
            "id": staff["id"],
            "unit_id": staff["unit_id"],
            "unit_name": unit_name or "SpazaUniti Network",
            "username": staff["username"],
            "full_name": staff["full_name"],
            "role": staff["role"],
            "active": bool(staff["active"])
        }
    }

def logout_staff(token: str) -> Dict[str, str]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM ubuflow_sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()
    return {"status": "logged_out"}

def extract_token(
    x_ubuflow_token: Optional[str] = Header(None, alias="X-UbuFlow-Token"),
    authorization: Optional[str] = Header(None)
) -> str:
    if x_ubuflow_token:
        return x_ubuflow_token.strip()
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    raise HTTPException(status_code=401, detail="Missing UbuFlow RBAC authentication token")

def get_current_staff(token: str = Depends(extract_token)) -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT s.*, u.active AS staff_still_active
    FROM ubuflow_sessions s
    JOIN unit_staff u ON s.staff_id = u.id
    WHERE s.token = ?;
    """, (token,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid or expired UbuFlow session. Please sign in.")
    if not row["staff_still_active"]:
        raise HTTPException(status_code=403, detail="Operator access has been revoked by Unit Owner.")

    expires = datetime.strptime(row["expires_at"], "%Y-%m-%d %H:%M:%S")
    if datetime.now() > expires:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")

    return {
        "staff_id": row["staff_id"],
        "username": row["username"],
        "full_name": row["full_name"],
        "unit_id": row["unit_id"],
        "role": row["role"],
        "token": row["token"]
    }

def require_roles(allowed_roles: List[str]):
    def checker(staff: Dict[str, Any] = Depends(get_current_staff)) -> Dict[str, Any]:
        if staff["role"] not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"RBAC Denied: Role '{staff['role']}' cannot perform this action. Required: {', '.join(allowed_roles)}"
            )
        return staff
    return checker

def assert_unit_scope(staff: Dict[str, Any], unit_id: str):
    if staff["role"] == "NETWORK_ADMIN":
        return
    if staff.get("unit_id") != unit_id:
        raise HTTPException(
            status_code=403,
            detail=f"RBAC Denied: Operator belongs to '{staff.get('unit_id')}', cannot access '{unit_id}'"
        )

def list_unit_staff(unit_id: str) -> List[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM unit_staff WHERE unit_id = ? ORDER BY created_at ASC", (unit_id,))
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r["id"],
            "unit_id": r["unit_id"],
            "username": r["username"],
            "full_name": r["full_name"],
            "role": r["role"],
            "active": bool(r["active"]),
            "created_at": r["created_at"]
        }
        for r in rows
    ]

def create_unit_staff(unit_id: str, payload: StaffCreateRequest) -> Dict[str, Any]:
    clean_user = payload.username.strip().lower().lstrip("@")
    role = payload.role.strip().upper()
    if role not in ("UNIT_CASHIER", "UNIT_OWNER"):
        raise HTTPException(status_code=400, detail="Staff role must be UNIT_CASHIER or UNIT_OWNER")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM unit_staff WHERE lower(username) = ?", (clean_user,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail=f"Operator username '{clean_user}' already exists")

    staff_id = f"staff_{uuid.uuid4().hex[:10]}"
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
    INSERT INTO unit_staff (id, unit_id, username, full_name, role, passcode_hash, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?);
    """, (staff_id, unit_id, clean_user, payload.full_name.strip(), role, hash_pin(payload.passcode.strip()), now_str))
    conn.commit()
    conn.close()

    return {
        "id": staff_id,
        "unit_id": unit_id,
        "username": clean_user,
        "full_name": payload.full_name.strip(),
        "role": role,
        "active": True,
        "created_at": now_str
    }

def toggle_unit_staff(unit_id: str, staff_id: str, acting_staff_id: str) -> Dict[str, Any]:
    if staff_id == acting_staff_id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own active operator session")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM unit_staff WHERE id = ? AND unit_id = ?", (staff_id, unit_id))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Staff member not found for this Unit")

    new_active = 0 if row["active"] else 1
    cursor.execute("UPDATE unit_staff SET active = ? WHERE id = ?", (new_active, staff_id))
    conn.commit()
    conn.close()

    return {
        "id": row["id"],
        "unit_id": row["unit_id"],
        "username": row["username"],
        "full_name": row["full_name"],
        "role": row["role"],
        "active": bool(new_active),
        "created_at": row["created_at"]
    }
