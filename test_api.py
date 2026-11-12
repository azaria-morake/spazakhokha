"""
test_api.py
HTTP smoke test against the live FastAPI server.
Tests /api/health, /api/verify, and /api/pending over localhost:8000.
"""

import time
import httpx
from cryptography.hazmat.primitives.asymmetric import ec

from offline_crypto import (
    CURVE,
    load_or_create_issuer_key,
    public_key_b64u,
    sign_certificate,
    sign_note,
)

BASE_URL = "http://localhost:8000"
SHOP = "https://ilp.interledger-test.dev/spazakhokha-shop"


def test_api_flow():
    print("=" * 55)
    print("       TESTING LIVE SpazaKhokha FASTAPI SERVER         ")
    print("=" * 55)

    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        # 1. Health check
        res = client.get("/api/health")
        print(f"\n[GET /api/health] Status: {res.status_code}")
        print(f"  Response: {res.json()}")
        assert res.status_code == 200
        assert res.json().get("issuer_configured") is True, "Issuer key not loaded on server!"

        # 2. Load the persistent trusted issuer key (matches server's .env)
        issuer_priv = load_or_create_issuer_key("issuer_private.pem")
        issuer_pub = public_key_b64u(issuer_priv)

        # 3. Generate customer device key
        device_priv = ec.generate_private_key(CURVE)
        device_pub = public_key_b64u(device_priv)

        now = int(time.time())
        cert = sign_certificate(
            issuer_priv,
            allowance_id="allowance_api_test_001",
            device_pub=device_pub,
            limit=5000,
            tx_cap=2500,
            expires_at=now + 3600,
        )

        # 4. Create Note 1 (R12.50)
        note1 = sign_note(
            device_priv,
            allowance_id="allowance_api_test_001",
            request_id=f"req_api_{now}",
            merchant_wallet=SHOP,
            amount=1250,
            counter=1,
            spent_before=0,
        )
        pkg = {"cert": cert, "note": note1}

        # 5. POST /api/verify
        print("\n[POST /api/verify] Submitting scanned QR package...")
        res = client.post("/api/verify", json=pkg)
        print(f"  Status: {res.status_code}")
        verify_data = res.json()
        print(f"  Result: {verify_data.get('status_code')} - {verify_data.get('message')}")
        print(f"  Amount: {verify_data.get('formatted_amount')} | Remaining: {verify_data.get('formatted_remaining')}")
        assert verify_data.get("success") is True, f"Verification failed: {verify_data}"

        # 6. GET /api/pending
        print("\n[GET /api/pending] Checking merchant pending ledger...")
        res = client.get("/api/pending")
        pending_data = res.json()
        print(f"  Total pending packages: {pending_data['count']}")
        print(f"  Total unsettled value:   {pending_data['total_formatted']}")

        print("\n" + "=" * 55)
        print("  API VERIFICATION COMPLETED SUCCESSFULLY!")
        print("=" * 55)


if __name__ == "__main__":
    test_api_flow()