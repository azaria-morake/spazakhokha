"""
SpazaKhokha offline payment protocol, v1 (lean hackathon version): server side.

Mirrors frontend/offline.js. Amounts are integer cents, times are Unix seconds.

What lives here
  * issuer key handling and signing allowance certificates
  * verifying signatures and limits on a payment package (cert + note)
  * settlement: de-duplicate, apply the loss rule, say what is payable

Signed messages are {"payload": "<JSON string>", "sig": "<base64url, 64 bytes raw r||s>"}.
The signature covers the exact payload string, so JS and Python never need to
agree on JSON formatting.

Requires: cryptography
"""

from __future__ import annotations

import base64
import json
import os
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import (
    decode_dss_signature,
    encode_dss_signature,
)

CURVE = ec.SECP256R1()
SIGN_ALG = ec.ECDSA(hashes.SHA256())

# Reason codes (same strings as REASON in offline.js, plus settlement statuses)
MALFORMED = "MALFORMED"
BAD_ISSUER_SIGNATURE = "BAD_ISSUER_SIGNATURE"
BAD_NOTE_SIGNATURE = "BAD_NOTE_SIGNATURE"
EXPIRED = "EXPIRED"
WRONG_ALLOWANCE = "WRONG_ALLOWANCE"
WRONG_MERCHANT = "WRONG_MERCHANT"
OVER_TX_CAP = "OVER_TX_CAP"
OVER_LIMIT = "OVER_LIMIT"

COUNTER_REUSE = "COUNTER_REUSE"

PAYABLE = "PAYABLE"
DUPLICATE = "DUPLICATE"
SHORT_PAID = "SHORT_PAID"
REJECTED = "REJECTED"

DEFAULT_GRACE_SECONDS = 14 * 24 * 3600  # owner may settle this long after expiry
CLOCK_SKEW_SECONDS = 24 * 3600  # tolerance for phone clocks on note timestamps


# ------------------------------------------------------------------ helpers

def b64u_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def b64u_decode(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _is_cents(n: Any) -> bool:
    return isinstance(n, int) and not isinstance(n, bool) and n > 0


def _is_str(s: Any) -> bool:
    return isinstance(s, str) and len(s) > 0


def _is_int(n: Any) -> bool:
    return isinstance(n, int) and not isinstance(n, bool)


def _parse(payload: Any) -> Optional[dict]:
    try:
        obj = json.loads(payload)
        return obj if isinstance(obj, dict) else None
    except (TypeError, ValueError):
        return None


# ------------------------------------------------------------------ keys

def generate_issuer_key() -> ec.EllipticCurvePrivateKey:
    return ec.generate_private_key(CURVE)


def public_key_b64u(private_key: ec.EllipticCurvePrivateKey) -> str:
    """Uncompressed 65-byte point, base64url. This is what the apps cache."""
    raw = private_key.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    return b64u_encode(raw)


def load_or_create_issuer_key(path: str) -> ec.EllipticCurvePrivateKey:
    """Persist the issuer key as PEM. Keep this file out of Git (add *.pem to .gitignore)."""
    if os.path.exists(path):
        with open(path, "rb") as f:
            return serialization.load_pem_private_key(f.read(), password=None)
    key = generate_issuer_key()
    pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as f:
        f.write(pem)
    return key


def _load_public(pub_b64u: str) -> ec.EllipticCurvePublicKey:
    return ec.EllipticCurvePublicKey.from_encoded_point(CURVE, b64u_decode(pub_b64u))


# ------------------------------------------------------------- signing

def sign_payload(private_key: ec.EllipticCurvePrivateKey, obj: dict) -> dict:
    payload = json.dumps(obj, separators=(",", ":"), sort_keys=True)
    der = private_key.sign(payload.encode("utf-8"), SIGN_ALG)
    r, s = decode_dss_signature(der)
    raw = r.to_bytes(32, "big") + s.to_bytes(32, "big")  # WebCrypto format
    return {"payload": payload, "sig": b64u_encode(raw)}


def verify_signed(public_b64u: str, signed: Any) -> bool:
    try:
        if not isinstance(signed, dict) or not _is_str(signed.get("payload")) or not _is_str(signed.get("sig")):
            return False
        raw = b64u_decode(signed["sig"])
        if len(raw) != 64:
            return False
        der = encode_dss_signature(int.from_bytes(raw[:32], "big"), int.from_bytes(raw[32:], "big"))
        _load_public(public_b64u).verify(der, signed["payload"].encode("utf-8"), SIGN_ALG)
        return True
    except (InvalidSignature, ValueError, TypeError):
        return False


def sign_certificate(
    issuer_key: ec.EllipticCurvePrivateKey,
    *,
    allowance_id: str,
    device_pub: str,
    limit: int,
    tx_cap: int,
    expires_at: int,
) -> dict:
    """Mint the allowance certificate the customer app stores. Amounts in cents."""
    if not (_is_cents(limit) and _is_cents(tx_cap) and tx_cap <= limit):
        raise ValueError("limit and tx_cap must be positive cents, with tx_cap <= limit")
    return sign_payload(
        issuer_key,
        {
            "v": 1,
            "allowance_id": allowance_id,
            "device_pub": device_pub,
            "limit": limit,
            "tx_cap": tx_cap,
            "expires_at": expires_at,
        },
    )


# ----------------------------------------------------------- verification

@dataclass
class Verified:
    ok: bool
    reason: Optional[str] = None
    cert: Optional[dict] = None
    note: Optional[dict] = None


def verify_package(package: dict, *, issuer_public_key: str) -> Verified:
    """
    Checks that do not depend on the clock or on other notes:
    both signatures, shape, allowance match, per-transaction cap, and that the
    note's own running total fits the limit.
    """
    if not isinstance(package, dict) or "cert" not in package or "note" not in package:
        return Verified(False, MALFORMED)

    if not verify_signed(issuer_public_key, package["cert"]):
        return Verified(False, BAD_ISSUER_SIGNATURE)
    cert = _parse(package["cert"].get("payload"))
    if (
        cert is None or cert.get("v") != 1 or not _is_str(cert.get("allowance_id"))
        or not _is_str(cert.get("device_pub")) or not _is_cents(cert.get("limit"))
        or not _is_cents(cert.get("tx_cap")) or not _is_int(cert.get("expires_at"))
    ):
        return Verified(False, MALFORMED)

    if not verify_signed(cert["device_pub"], package["note"]):
        return Verified(False, BAD_NOTE_SIGNATURE)
    note = _parse(package["note"].get("payload"))
    if (
        note is None or note.get("v") != 1 or not _is_str(note.get("allowance_id"))
        or not _is_str(note.get("request_id")) or not _is_str(note.get("wallet"))
        or not _is_cents(note.get("amount")) or not _is_int(note.get("counter"))
        or note["counter"] < 1 or not _is_int(note.get("spent_before"))
        or note["spent_before"] < 0 or not _is_int(note.get("ts"))
    ):
        return Verified(False, MALFORMED)

    if note["allowance_id"] != cert["allowance_id"]:
        return Verified(False, WRONG_ALLOWANCE)
    if note["amount"] > cert["tx_cap"]:
        return Verified(False, OVER_TX_CAP)
    if note["spent_before"] + note["amount"] > cert["limit"]:
        return Verified(False, OVER_LIMIT)

    return Verified(True, None, cert, note)


# -------------------------------------------------------------- settlement

@dataclass
class Ledger:
    """
    In-memory stand-in for the database table Person 3 will create.
    In a real DB do each note's check-and-commit inside one transaction, and only
    keep the commit if the Open Payments outgoing payment succeeds.
    """

    settled: dict = field(default_factory=dict)  # allowance_id -> cents already payable
    seen: set = field(default_factory=set)  # (allowance_id, request_id, wallet): one payment
    counters: dict = field(default_factory=dict)  # (allowance_id, counter) -> request_id


@dataclass
class SettlementResult:
    status: str  # PAYABLE | DUPLICATE | SHORT_PAID | REJECTED
    reason: Optional[str] = None
    allowance_id: Optional[str] = None
    counter: Optional[int] = None
    request_id: Optional[str] = None
    amount: Optional[int] = None  # cents to pay (0 if not payable)
    flag: Optional[str] = None  # COUNTER_REUSE: device reused a counter, likely a rollback


def process_batch(
    packages: list,
    *,
    issuer_public_key: str,
    merchant_wallet: str,
    ledger: Ledger,
    now: Optional[int] = None,
    grace_seconds: int = DEFAULT_GRACE_SECONDS,
) -> list:
    """
    Decide what is payable from an owner's uploaded batch, in the order presented
    ("first presented wins, up to the allowance limit").

    merchant_wallet is the uploading owner's registered wallet address; notes
    addressed to a different wallet are rejected, so one owner cannot claim
    another owner's payments.
    """
    now = int(time.time()) if now is None else now
    results = []

    for pkg in packages:
        v = verify_package(pkg, issuer_public_key=issuer_public_key)
        if not v.ok:
            results.append(SettlementResult(REJECTED, v.reason))
            continue

        cert, note = v.cert, v.note
        base = dict(
            allowance_id=cert["allowance_id"], counter=note["counter"],
            request_id=note["request_id"],
        )

        if note["wallet"] != merchant_wallet:
            results.append(SettlementResult(REJECTED, WRONG_MERCHANT, **base, amount=0))
            continue
        if now > cert["expires_at"] + grace_seconds or note["ts"] > cert["expires_at"] + CLOCK_SKEW_SECONDS:
            results.append(SettlementResult(REJECTED, EXPIRED, **base, amount=0))
            continue

        # A payment is identified by its one-time request ID (plus allowance and shop),
        # NOT by the counter: a customer who rolled back their phone can issue two
        # different payments with the same counter, and those must compete for the
        # allowance's headroom rather than be thrown away as "duplicates".
        key = (cert["allowance_id"], note["request_id"], note["wallet"])
        if key in ledger.seen:
            results.append(SettlementResult(DUPLICATE, None, **base, amount=0))
            continue

        counter_key = (cert["allowance_id"], note["counter"])
        other = ledger.counters.get(counter_key)
        flag = COUNTER_REUSE if other is not None and other != note["request_id"] else None
        ledger.counters.setdefault(counter_key, note["request_id"])

        ledger.seen.add(key)
        total = ledger.settled.get(cert["allowance_id"], 0)
        if total + note["amount"] > cert["limit"]:
            # presented, but nothing left to pay it from: first presented wins
            results.append(SettlementResult(SHORT_PAID, OVER_LIMIT, **base, amount=0, flag=flag))
            continue

        ledger.settled[cert["allowance_id"]] = total + note["amount"]
        results.append(SettlementResult(PAYABLE, None, **base, amount=note["amount"], flag=flag))

    return results
# ------------------------------------------------------------- testing / cli

def sign_note(
    device_private_key: ec.EllipticCurvePrivateKey,
    *,
    allowance_id: str,
    request_id: str,
    merchant_wallet: str,
    amount: int,
    counter: int,
    spent_before: int,
    ts: Optional[int] = None,
) -> dict:
    """Helper to simulate the customer device signing a payment note."""
    return sign_payload(
        device_private_key,
        {
            "v": 1,
            "allowance_id": allowance_id,
            "request_id": request_id,
            "wallet": merchant_wallet,
            "amount": amount,
            "counter": counter,
            "spent_before": spent_before,
            "ts": int(time.time()) if ts is None else ts,
        },
    )


if __name__ == "__main__":
    print("=" * 60)
    print(" TESTING SPAZAKHOKHA OFFLINE CRYPTO PROTOCOL (P-256 ECDSA)")
    print("=" * 60)

    # 1. Setup Issuer & Device Keys
    issuer_priv = generate_issuer_key()
    issuer_pub_b64u = public_key_b64u(issuer_priv)

    device_priv = ec.generate_private_key(CURVE)
    device_pub_b64u = public_key_b64u(device_priv)

    SHOP = "https://ilp.interledger-test.dev/spazakhokha-shop"
    now_ts = int(time.time())
    exp_ts = now_ts + 3600  # 1 hour validity

    # 2. Mint Allowance Certificate (R50.00 cap, R25.00 tx cap)
    cert = sign_certificate(
        issuer_priv,
        allowance_id="allowance_test_101",
        device_pub=device_pub_b64u,
        limit=5000,
        tx_cap=2500,
        expires_at=exp_ts,
    )
    print("\n[OK] Allowance Certificate minted.")

    # 3. Customer Signs Note 1 (R12.00)
    note1 = sign_note(
        device_priv,
        allowance_id="allowance_test_101",
        request_id="req_001",
        merchant_wallet=SHOP,
        amount=1200,
        counter=1,
        spent_before=0,
    )
    pkg1 = {"cert": cert, "note": note1}
    v1 = verify_package(pkg1, issuer_public_key=issuer_pub_b64u)
    print(f"[OK] Package 1 verification: ok={v1.ok}, reason={v1.reason}")
    assert v1.ok is True, "Valid package 1 failed verification!"

    # 4. Tamper Test: Change Amount to R1.00
    tampered_note = dict(note1)
    tampered_payload = json.loads(tampered_note["payload"])
    tampered_payload["amount"] = 100
    tampered_note["payload"] = json.dumps(tampered_payload, separators=(",", ":"), sort_keys=True)
    v_tampered = verify_package({"cert": cert, "note": tampered_note}, issuer_public_key=issuer_pub_b64u)
    print(f"[OK] Tamper Test rejected? {not v_tampered.ok} (Reason: {v_tampered.reason})")
    assert v_tampered.ok is False, "Tampered note incorrectly verified!"

    # 5. Settlement Batch Test
    note2 = sign_note(
        device_priv,
        allowance_id="allowance_test_101",
        request_id="req_002",
        merchant_wallet=SHOP,
        amount=2000,
        counter=2,
        spent_before=1200,
    )
    
    note3_over = sign_note(
        device_priv,
        allowance_id="allowance_test_101",
        request_id="req_003",
        merchant_wallet=SHOP,
        amount=2500,
        counter=3,
        spent_before=2000,
    )

    ledger = Ledger()
    batch_results = process_batch(
        [pkg1, {"cert": cert, "note": note2}, {"cert": cert, "note": note3_over}],
        issuer_public_key=issuer_pub_b64u,
        merchant_wallet=SHOP,
        ledger=ledger,
    )

    print("\n--- Batch Settlement Results ---")
    for idx, r in enumerate(batch_results, start=1):
        print(f"  Note {idx}: status={r.status}, reason={r.reason}, amount={r.amount}c, flag={r.flag}")

    assert batch_results[0].status == PAYABLE and batch_results[0].amount == 1200
    assert batch_results[1].status == PAYABLE and batch_results[1].amount == 2000
    assert batch_results[2].status == SHORT_PAID and batch_results[2].reason == OVER_LIMIT

    print("\nAll offline crypto protocol checks passed successfully!")