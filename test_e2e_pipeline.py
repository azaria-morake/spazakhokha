"""
test_e2e_pipeline.py
End-to-end integration test for SpazaKhokha:
1. Mints an Allowance Certificate via Issuer key.
2. Simulates customer device signing offline payment notes.
3. MerchantVerifier accepts and stores notes in SQLite.
4. BatchSettlementWorker reconciles notes and marks them settled.
"""

import gc
import os
import time
from cryptography.hazmat.primitives.asymmetric import ec

from offline_crypto import (
    CURVE,
    generate_issuer_key,
    public_key_b64u,
    sign_certificate,
    sign_note,
)
from merchant_verifier import MerchantVerifier
from batch_settle import BatchSettlementWorker

E2E_DB = "e2e_test_merchant.db"
SHOP_WALLET = "https://ilp.interledger-test.dev/spazakhokha-shop"
ALLOWANCE_ID = "allowance_e2e_test_001"


def run_e2e():
    print("=" * 60)
    print("   SPAZAKHOKHA END-TO-END PIPELINE TEST   ")
    print("=" * 60)

    # 0. Clean old test database if present
    if os.path.exists(E2E_DB):
        try:
            os.remove(E2E_DB)
        except PermissionError:
            pass

    # -------------------------------------------------------------
    # Step 1: Issuer Mints Allowance Certificate (Customer Online Setup)
    # -------------------------------------------------------------
    print("\n[Step 1] Issuer generating keys and minting certificate...")
    issuer_priv = generate_issuer_key()
    issuer_pub_b64u = public_key_b64u(issuer_priv)

    # Customer device generates its private/public keypair
    device_priv = ec.generate_private_key(CURVE)
    device_pub_b64u = public_key_b64u(device_priv)

    now = int(time.time())
    expires_at = now + 7200  # valid 2 hours

    cert = sign_certificate(
        issuer_priv,
        allowance_id=ALLOWANCE_ID,
        device_pub=device_pub_b64u,
        limit=5000,   # R50.00 ceiling
        tx_cap=2500,  # R25.00 single transaction cap
        expires_at=expires_at,
    )
    print(f"  [OK] Certificate minted for {ALLOWANCE_ID}")
    print(f"       Limit: R50.00 | Tx Cap: R25.00")

    # -------------------------------------------------------------
    # Step 2: Customer Signs Offline Payment Notes (No Internet)
    # -------------------------------------------------------------
    print("\n[Step 2] Customer signs 2 offline payment notes...")
    
    # Note 1: R15.00 (Counter #1)
    note1 = sign_note(
        device_priv,
        allowance_id=ALLOWANCE_ID,
        request_id="req_e2e_001",
        merchant_wallet=SHOP_WALLET,
        amount=1500,
        counter=1,
        spent_before=0,
    )
    pkg1 = {"cert": cert, "note": note1}

    # Note 2: R20.00 (Counter #2)
    note2 = sign_note(
        device_priv,
        allowance_id=ALLOWANCE_ID,
        request_id="req_e2e_002",
        merchant_wallet=SHOP_WALLET,
        amount=2000,
        counter=2,
        spent_before=1500,
    )
    pkg2 = {"cert": cert, "note": note2}
    print("  [OK] Generated Note #1 (R15.00) and Note #2 (R20.00)")

    # -------------------------------------------------------------
    # Step 3: Merchant Terminal Verifies and Records Packages
    # -------------------------------------------------------------
    print("\n[Step 3] Merchant terminal verifies packages offline...")
    verifier = MerchantVerifier(
        merchant_wallet=SHOP_WALLET,
        issuer_public_key=issuer_pub_b64u,
        db_path=E2E_DB,
    )

    res1 = verifier.verify_and_record_package(pkg1)
    print(f"  Note #1 result: {res1.status_code} (Remaining: R{res1.remaining_allowance_cents / 100:.2f})")
    assert res1.success is True

    res2 = verifier.verify_and_record_package(pkg2)
    print(f"  Note #2 result: {res2.status_code} (Remaining: R{res2.remaining_allowance_cents / 100:.2f})")
    assert res2.success is True

    pending_before = verifier.get_pending_settlements()
    print(f"  Pending notes in SQLite before settlement: {len(pending_before)}")
    assert len(pending_before) == 2

    # -------------------------------------------------------------
    # Step 4: Batch Settlement Online Sync
    # -------------------------------------------------------------
    print("\n[Step 4] Triggering batch settlement worker...")
    worker = BatchSettlementWorker(verifier)

    # Check if a live token is provided in the environment
    live_token = os.getenv("TEST_ALLOWANCE_TOKEN")

    if not live_token:
        print("  [INFO] No live TEST_ALLOWANCE_TOKEN in .env. Using mock settlement mode for E2E verification...")
        
        # Monkeypatch settle_single_package to simulate network roundtrip and avoid blocking
        def mock_settle_single_package(item, allowance_access_token):
            return f"https://ilp.interledger-test.dev/outgoing-payments/tx_mock_{item['request_id']}"

        worker.settle_single_package = mock_settle_single_package
        token_map = {ALLOWANCE_ID: "MOCK_GNAP_ACCESS_TOKEN"}
    else:
        print("  [INFO] Found live TEST_ALLOWANCE_TOKEN. Settling against Interledger testnet...")
        token_map = {ALLOWANCE_ID: live_token}

    summary = worker.run_settlement(access_tokens=token_map)
    assert summary["settled"] == 2
    assert summary["failed"] == 0

    # -------------------------------------------------------------
    # Step 5: Verify Post-Settlement State in SQLite
    # -------------------------------------------------------------
    print("\n[Step 5] Checking database post-settlement status...")
    pending_after = verifier.get_pending_settlements()
    print(f"  Pending notes remaining in SQLite: {len(pending_after)}")
    assert len(pending_after) == 0, "Expected 0 pending notes after settlement!"

    print("\n" + "=" * 60)
    print(" [PASS] FULL PIPELINE TEST COMPLETED SUCCESSFULLY!")
    print("=" * 60)

    # Teardown
    del verifier
    del worker
    gc.collect()
    try:
        if os.path.exists(E2E_DB):
            os.remove(E2E_DB)
    except PermissionError:
        pass


if __name__ == "__main__":
    run_e2e()