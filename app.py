"""
SpazaKhokha Core Settlement & Allowance Service (FastAPI).

Provides P-256 ECDSA offline allowance issuance, cryptographic payment note verification,
and asynchronous batch settlement over the Interledger Open Payments protocol
(Incoming Payment -> Quote -> Outgoing Payment).
"""
import json
import os
import secrets
import sys
import threading
import time
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent
sys.path[:0] = [str(ROOT), str(ROOT / "scripts")]
load_dotenv()
import offline_crypto as oc  # noqa: E402

PUBLIC_URL = os.getenv("PUBLIC_URL", "http://localhost:3300").rstrip("/")
DB, LOCK = ROOT / "data.json", threading.Lock()
ISSUER = oc.load_or_create_issuer_key(str(ROOT / "issuer.pem"))
ISSUER_PUB = oc.public_key_b64u(ISSUER)
app = FastAPI(title="SpazaKhokha")

LANDING = """<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>SpazaKhokha</title><style>body{margin:0;background:#0b132b;color:#f8fafc;font-family:system-ui,sans-serif;display:flex;justify-content:center;padding:24px}
main{max-width:420px;width:100%}h1{margin:8px 0 4px}p{color:#94a3b8}a{display:block;text-align:center;padding:18px;border-radius:12px;font-weight:700;text-decoration:none;margin-top:14px;font-size:1.1rem}
.c{background:#10b981;color:#0b132b}.m{background:#f59e0b;color:#0b132b}</style></head><body><main><h1>SpazaKhokha</h1><p>Offline-first Open Payments for spaza shops.</p>
<a class="c" href="/customer">I am a customer</a><a class="m" href="/merchant">I am a shop owner</a></main></body></html>"""
MIN_ALLOWANCE_CENTS, MAX_ALLOWANCE_CENTS = 500, 50000  # customers may lock R5 to R500


# ------------------------------------------------------------------ storage
def load():
    try:
        d = json.loads(DB.read_text())
    except Exception:
        d = {}
    d.setdefault("allowances", {})
    d.setdefault("ledger", {"settled": {}, "seen": [], "counters": []})
    return d


def save(d):
    DB.write_text(json.dumps(d))


def ledger_from(d):
    L, s = oc.Ledger(), d["ledger"]
    L.settled, L.seen = dict(s["settled"]), {tuple(k) for k in s["seen"]}
    L.counters = {(a, int(c)): r for a, c, r in s["counters"]}
    return L


def ledger_to(d, L):
    d["ledger"] = {"settled": L.settled, "seen": [list(k) for k in L.seen],
                   "counters": [[a, c, r] for (a, c), r in L.counters.items()]}


def cert_for(a):
    return oc.sign_certificate(ISSUER, allowance_id=a["id"], device_pub=a["device_pub"],
                               limit=a["limit"], tx_cap=a["tx_cap"], expires_at=a["expires_at"])


# --------------------------------------------------------- Open Payments bits
def norm_wallet(w):
    w = (w or "").strip().rstrip("/")
    return "https://" + w[1:] if w.startswith("$") else w


def op_identity(customer_wallet):
    """
    The registered client that signs requests for this customer wallet.
    The configured test customer wallet signs with its own key. Any other customer wallet is
    accessed by the shop's registered client with that customer's consent (a third-party client,
    as in the Open Payments boutique demo), so any customer wallet address can be used.
    """
    import process_payment as pp
    if customer_wallet == pp.CUSTOMER_WALLET:
        return pp.make_client(pp.CUSTOMER_WALLET, pp.CUSTOMER_KEY_ID, pp.CUSTOMER_KEY_PATH), pp.CUSTOMER_WALLET
    return pp.make_client(pp.SHOP_WALLET, pp.STORE_KEY_ID, pp.STORE_KEY_PATH), pp.SHOP_WALLET


def start_wallet_grant(a):
    """Ask the customer's wallet for ONE outgoing-payment grant limited to the allowance."""
    import process_payment as pp
    from open_payments_sdk.models.auth import GrantRequest
    cw = a["customer_wallet"]
    client, client_wallet = op_identity(cw)
    info = client.wallet.get_wallet_address(cw)
    pending = client.grants.post_grant_request(GrantRequest.model_validate({
        "access_token": {"access": [{"type": "outgoing-payment", "actions": ["create", "read"], "identifier": cw,
            "limits": {"debitAmount": {"value": str(a["limit"]), "assetCode": pp.val(info.assetCode), "assetScale": pp.val(info.assetScale)}}}]},
        "client": client_wallet,
        "interact": {"start": ["redirect"], "finish": {"method": "redirect",
            "uri": f"{PUBLIC_URL}/callback/{a['id']}", "nonce": secrets.token_hex(8)}},
    }), str(info.authServer))
    p = getattr(pending, "root", pending)
    a["continue_uri"], a["continue_token"] = str(p.cont.uri), p.cont.access_token.value
    return str(p.interact.redirect)


class OPContext:
    """Created once per settlement batch: fresh non-interactive tokens, then one payment per note."""

    def __init__(self):
        import process_payment as pp
        from grant_reuse_experiment import create_incoming_payment
        from open_payments_sdk.models.auth import GrantRequest
        from open_payments_sdk.models.resource import OutgoingPaymentRequest
        self.pp, self.cip, self.GR, self.OPR = pp, create_incoming_payment, GrantRequest, OutgoingPaymentRequest
        self.shop = pp.make_client(pp.SHOP_WALLET, pp.STORE_KEY_ID, pp.STORE_KEY_PATH)
        si = self.shop.wallet.get_wallet_address(pp.SHOP_WALLET)
        self.shop_rs = str(si.resourceServer)
        self.in_tok = self.grant(self.shop, pp.SHOP_WALLET, si.authServer, "incoming-payment")
        self.cache = {}

    def grant(self, client, wallet, auth, kind):
        return self.pp.extract_token(client.grants.post_grant_request(self.GR.model_validate({
            "access_token": {"access": [{"type": kind, "actions": ["create", "read"]}]}, "client": wallet}), str(auth)))

    def _cust(self, cw):
        if cw not in self.cache:
            client, client_wallet = op_identity(cw)
            info = client.wallet.get_wallet_address(cw)
            self.cache[cw] = (client, str(info.resourceServer), self.grant(client, client_wallet, info.authServer, "quote"))
        return self.cache[cw]

    def pay(self, a, wallet, cents, label):
        if wallet != self.pp.SHOP_WALLET:
            raise ValueError("no keys for that wallet in this prototype")
        cw = a.get("customer_wallet") or self.pp.CUSTOMER_WALLET
        client, rs, quote_token = self._cust(cw)
        ip = self.cip(self.shop, self.shop_rs, self.in_tok, cents, label)
        q = client.quotes.post_create_quote(quote={"walletAddress": cw, "receiver": ip, "method": "ilp"},
                                            resource_server_endpoint=rs, access_token=quote_token)
        req = self.OPR.model_validate({"walletAddress": cw, "quoteId": str(q.id), "metadata": {"description": label}})
        return str(client.outgoing_payments.post_create_payment(
            payment=req, resource_server_endpoint=rs, access_token=a["op_token"]).id)


# ---------------------------------------------------------------------- API
class NewAllowance(BaseModel):
    device_pub: str
    customer_wallet: str = ""
    limit_cents: int = 0  # amount the customer chooses to lock; 0 = default
    return_to: str = "/"
    mode: str = "demo"  # "demo" = no wallet approval, "wallet" = real Open Payments grant


@app.get("/api/issuer")
def issuer():
    return {"pub": ISSUER_PUB}


@app.post("/api/allowances")
def new_allowance(b: NewAllowance):
    try:
        oc._load_public(b.device_pub)
    except Exception:
        raise HTTPException(400, "bad device key")
    mode = "wallet" if b.mode == "wallet" else "demo"
    limit = b.limit_cents or (5000 if mode == "wallet" else 10000)
    if not (MIN_ALLOWANCE_CENTS <= limit <= MAX_ALLOWANCE_CENTS):
        raise HTTPException(400, f"amount must be between R{MIN_ALLOWANCE_CENTS // 100} and R{MAX_ALLOWANCE_CENTS // 100}")
    a = {"id": "al_" + secrets.token_hex(4), "device_pub": b.device_pub, "limit": limit,
         "tx_cap": min(5000, limit), "expires_at": int(time.time()) + 7 * 86400, "mode": mode,
         "return_to": b.return_to if b.return_to in ("/", "/customer") else "/"}
    out = {"allowance_id": a["id"]}
    if mode == "wallet":
        try:
            import process_payment as pp
            a["customer_wallet"] = norm_wallet(b.customer_wallet) or pp.CUSTOMER_WALLET
            out["approval_url"] = start_wallet_grant(a)
        except Exception as e:
            raise HTTPException(502, f"wallet grant failed: {str(e)[:200]}")
    else:
        out["cert"] = cert_for(a)
    with LOCK:
        d = load(); d["allowances"][a["id"]] = a; save(d)
    return out


@app.get("/callback/{aid}")
def callback(aid: str, interact_ref: str):
    with LOCK:
        d = load(); a = d["allowances"].get(aid)
        if not a or "continue_uri" not in a:
            raise HTTPException(404, "unknown allowance")
        import process_payment as pp
        c, _ = op_identity(a.get("customer_wallet") or pp.CUSTOMER_WALLET)
        res = pp.continue_grant(c.grants, a["continue_uri"], a.pop("continue_token"), interact_ref)
        a["op_token"], a["active"] = res.access_token.value, True  # access token lifetime is about 10 minutes; rotation is not yet implemented
        save(d)
    return RedirectResponse(f"{a.get('return_to', '/')}?allowance={aid}")


@app.get("/api/allowances/{aid}")
def get_allowance(aid: str):
    a = load()["allowances"].get(aid)
    if not a or (a["mode"] == "wallet" and not a.get("active")):
        raise HTTPException(404, "not ready")
    return {"cert": cert_for(a)}


class SettleBody(BaseModel):
    wallet: str
    packages: list[dict]


@app.post("/api/settle")
def settle(body: SettleBody):
    with LOCK:
        d = load(); L = ledger_from(d)
        results = oc.process_batch(body.packages, issuer_public_key=ISSUER_PUB, merchant_wallet=body.wallet, ledger=L)
        out, ctx = [], None
        for r in results:
            item = {"status": r.status, "reason": r.reason, "amount": r.amount or 0, "flag": r.flag, "detail": None}
            if r.status == oc.PAYABLE:
                a = d["allowances"].get(r.allowance_id)
                if not a or a["mode"] == "demo":
                    item.update(status="SETTLED_DEMO", detail="demo allowance: no Open Payments transfer")
                else:
                    try:
                        ctx = ctx or OPContext()
                        item.update(status="SUBMITTED", detail=ctx.pay(a, body.wallet, r.amount, f"{r.allowance_id}#{r.counter}"))  # accepted by the wallet; completion is confirmed in the wallet
                    except Exception as e:  # undo the ledger commit so the owner can retry later
                        L.settled[r.allowance_id] -= r.amount
                        L.seen.discard((r.allowance_id, r.request_id, body.wallet))
                        resp = getattr(e, "response", None)
                        msg = f"HTTP {resp.status_code} {resp.text[:120]}" if resp is not None else str(e)[:160]
                        item.update(status="PAYMENT_FAILED", detail=msg + (" (access token may have expired; token rotation is not yet implemented)" if "401" in msg else ""))
            out.append(item)
        ledger_to(d, L); save(d)
    return {"results": out}


@app.get("/", response_class=HTMLResponse)
def home():
    return LANDING


@app.get("/api/config")
def config():
    return {"shop_wallet": os.getenv("SHOP_WALLET", "https://ilp.interledger-test.dev/spazakhokha-shop")}


@app.get("/customer")
def customer_page():
    return FileResponse(ROOT / "static" / "customer.html")


@app.get("/merchant")
def merchant_page():
    return FileResponse(ROOT / "static" / "merchant.html")


app.mount("/", StaticFiles(directory=ROOT / "static", html=True), name="static")
