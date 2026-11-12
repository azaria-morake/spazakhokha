import json
import os
import secrets
import sys
import threading
import time
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

import offline_crypto as oc  # noqa: E402

router = APIRouter(tags=["SpazaKhokha Offline Engine"])

DB_PATH = ROOT / "data.json"
LOCK = threading.Lock()
ISSUER = oc.load_or_create_issuer_key(str(ROOT / "issuer.pem"))
ISSUER_PUB = oc.public_key_b64u(ISSUER)
MIN_ALLOWANCE_CENTS, MAX_ALLOWANCE_CENTS = 500, 50000


def _load_db() -> dict:
    try:
        d = json.loads(DB_PATH.read_text())
    except Exception:
        d = {}
    d.setdefault("allowances", {})
    d.setdefault("ledger", {"settled": {}, "seen": [], "counters": []})
    return d


def _save_db(d: dict) -> None:
    DB_PATH.write_text(json.dumps(d, indent=2))


def _ledger_from(d: dict) -> oc.Ledger:
    L, s = oc.Ledger(), d["ledger"]
    L.settled = dict(s["settled"])
    L.seen = {tuple(k) for k in s["seen"]}
    L.counters = {(a, int(c)): r for a, c, r in s["counters"]}
    return L


def _ledger_to(d: dict, L: oc.Ledger) -> None:
    d["ledger"] = {
        "settled": L.settled,
        "seen": [list(k) for k in L.seen],
        "counters": [[a, c, r] for (a, c), r in L.counters.items()],
    }


def _cert_for(a: dict) -> dict:
    return oc.sign_certificate(
        ISSUER,
        allowance_id=a["id"],
        device_pub=a["device_pub"],
        limit=a["limit"],
        tx_cap=a["tx_cap"],
        expires_at=a["expires_at"],
    )


class NewAllowanceRequest(BaseModel):
    device_pub: str
    customer_wallet: str = ""
    limit_cents: int = 0
    return_to: str = "http://localhost:3000"
    mode: str = "demo"


@router.get("/api/issuer")
def get_issuer_public_key():
    return {"pub": ISSUER_PUB}


@router.get("/api/config")
def get_offline_config():
    return {
        "shop_wallet": os.getenv("SHOP_WALLET", "https://ilp.interledger-test.dev/spazakhokha-shop"),
        "issuer_pub": ISSUER_PUB,
    }


@router.post("/api/allowances")
def create_allowance(b: NewAllowanceRequest):
    try:
        oc._load_public(b.device_pub)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid device P-256 public key")

    mode = "wallet" if b.mode == "wallet" else "demo"
    limit = b.limit_cents or (5000 if mode == "wallet" else 10000)
    if not (MIN_ALLOWANCE_CENTS <= limit <= MAX_ALLOWANCE_CENTS):
        raise HTTPException(
            status_code=400,
            detail=f"Amount must be between R{MIN_ALLOWANCE_CENTS // 100} and R{MAX_ALLOWANCE_CENTS // 100}",
        )

    allowance = {
        "id": "al_" + secrets.token_hex(4),
        "device_pub": b.device_pub,
        "limit": limit,
        "tx_cap": min(5000, limit),
        "expires_at": int(time.time()) + 7 * 86400,
        "mode": mode,
        "return_to": b.return_to or "http://localhost:3000",
    }
    out: Dict[str, Any] = {"allowance_id": allowance["id"], "issuer_pub": ISSUER_PUB}

    if mode == "wallet":
        try:
            import app as root_app
            allowance["customer_wallet"] = root_app.norm_wallet(b.customer_wallet) or root_app.op_identity("")[1]
            out["approval_url"] = root_app.start_wallet_grant(allowance)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Open Payments grant failed: {str(e)[:200]}")
    else:
        out["cert"] = _cert_for(allowance)

    with LOCK:
        d = _load_db()
        d["allowances"][allowance["id"]] = allowance
        _save_db(d)

    return out


@router.get("/callback/{aid}")
def open_payments_callback(aid: str, interact_ref: str):
    with LOCK:
        d = _load_db()
        a = d["allowances"].get(aid)
        if not a or "continue_uri" not in a:
            raise HTTPException(status_code=404, detail="Unknown allowance")
        import app as root_app
        c, _ = root_app.op_identity(a.get("customer_wallet") or "")
        res = root_app.continue_grant(c.grants, a["continue_uri"], a.pop("continue_token"), interact_ref)
        a["op_token"] = res.access_token.value
        a["active"] = True
        _save_db(d)
    return RedirectResponse(f"{a.get('return_to', 'http://localhost:3000')}?allowance={aid}")


@router.get("/api/allowances/{aid}")
def fetch_allowance_cert(aid: str):
    a = _load_db()["allowances"].get(aid)
    if not a or (a["mode"] == "wallet" and not a.get("active")):
        raise HTTPException(status_code=404, detail="Allowance certificate not ready")
    return {"cert": _cert_for(a), "issuer_pub": ISSUER_PUB}


class SettleBatchRequest(BaseModel):
    wallet: str
    packages: List[dict]
    unit_id: str = "unit-104"


@router.post("/api/settle")
def settle_offline_batch(body: SettleBatchRequest):
    with LOCK:
        d = _load_db()
        L = _ledger_from(d)
        results = oc.process_batch(
            body.packages,
            issuer_public_key=ISSUER_PUB,
            merchant_wallet=body.wallet,
            ledger=L,
        )
        out = []
        ctx = None
        total_settled_zar = 0.0

        for r in results:
            item = {
                "status": r.status,
                "reason": r.reason,
                "amount": r.amount or 0,
                "flag": r.flag,
                "detail": None,
            }
            if r.status == oc.PAYABLE:
                a = d["allowances"].get(r.allowance_id)
                if not a or a["mode"] == "demo":
                    item.update(status="SETTLED_DEMO", detail="Demo allowance verified & settled")
                    total_settled_zar += (r.amount or 0) / 100.0
                else:
                    try:
                        import app as root_app
                        ctx = ctx or root_app.OPContext()
                        payment_url = ctx.pay(a, body.wallet, r.amount, f"{r.allowance_id}#{r.counter}")
                        item.update(status="SUBMITTED", detail=payment_url)
                        total_settled_zar += (r.amount or 0) / 100.0
                    except Exception as e:
                        L.settled[r.allowance_id] -= r.amount
                        L.seen.discard((r.allowance_id, r.request_id, body.wallet))
                        resp = getattr(e, "response", None)
                        msg = f"HTTP {resp.status_code} {resp.text[:120]}" if resp is not None else str(e)[:160]
                        item.update(status="PAYMENT_FAILED", detail=msg)
            out.append(item)

        _ledger_to(d, L)
        _save_db(d)

    return {"results": out, "total_settled_zar": round(total_settled_zar, 2)}
