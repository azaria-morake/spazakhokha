"""
Live Open Payments Integration Module for Spaza Uniti & UbuOne.
Connects directly to the Interledger Testnet (wallet.interledger-test.dev / Rafiki)
using RFC 9421 HTTP Message Signatures and GNAP protocol.
"""
import os
import time
import json
import base64
import hashlib
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, Tuple
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

# Live Test Wallet Credentials provided from wallet.interledger-test.dev
DEFAULT_WALLET_ADDRESS = os.environ.get(
    "OPEN_PAYMENTS_WALLET_ADDRESS",
    "https://ilp.interledger-test.dev/2f0b6b2c"
)
DEFAULT_KEY_ID = os.environ.get(
    "OPEN_PAYMENTS_KEY_ID",
    "d644f013-289b-4c24-9cbe-c3e174cb5a0e"
)
DEFAULT_PRIVATE_KEY_PEM = os.environ.get(
    "OPEN_PAYMENTS_PRIVATE_KEY",
    """-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIIx9Jj4aa3bKrcKZNq5O9v5PjKdSNQL1OQarw6wHubaT
-----END PRIVATE KEY-----"""
).strip()


def normalize_wallet_address(address: str) -> str:
    """Converts payment pointer ($ilp.interledger-test.dev/foo) to https:// URL."""
    clean = address.strip()
    if clean.startswith("$"):
        return "https://" + clean[1:]
    return clean


def get_private_key() -> Ed25519PrivateKey:
    return load_pem_private_key(DEFAULT_PRIVATE_KEY_PEM.encode("utf-8"), password=None)


def resolve_wallet_address(wallet_url: str) -> Dict[str, Any]:
    """Fetches public Open Payments wallet document (RFC spec)."""
    norm = normalize_wallet_address(wallet_url)
    req = urllib.request.Request(
        norm,
        headers={"Accept": "application/json", "User-Agent": "SpazaUniti-OpenPayments/1.0"}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _sign_http_request(
    method: str,
    target_uri: str,
    body_bytes: bytes,
    key_id: str,
    priv_key: Ed25519PrivateKey,
    extra_headers: Optional[Dict[str, str]] = None
) -> Dict[str, str]:
    """
    RFC 9421 / Open Payments compliant HTTP Message Signature.
    Covers: @method, @target-uri, content-digest, and optional authorization.
    """
    headers = dict(extra_headers or {})
    created = int(time.time())

    # Content-Digest (SHA-512)
    h = hashlib.sha512(body_bytes).digest()
    content_digest = f"sha-512=:{base64.b64encode(h).decode()}:"
    headers["Content-Digest"] = content_digest
    headers["Content-Type"] = "application/json"
    headers["Content-Length"] = str(len(body_bytes))
    headers["Accept"] = "application/json"
    headers["User-Agent"] = "Mozilla/5.0 (compatible; SpazaUniti-OpenPayments/1.0)"

    covered = ["@method", "@target-uri"]
    sig_lines = [
        f'"@method": {method.upper()}',
        f'"@target-uri": {target_uri}'
    ]

    if "Authorization" in headers:
        covered.append("authorization")
        sig_lines.append(f'"authorization": {headers["Authorization"]}')

    covered.append("content-digest")
    sig_lines.append(f'"content-digest": {content_digest}')

    covered_str = " ".join(f'"{c}"' for c in covered)
    sig_params = f'({covered_str});created={created};keyid="{key_id}";alg="ed25519"'
    sig_lines.append(f'"@signature-params": {sig_params}')

    signing_base = "\n".join(sig_lines).encode("utf-8")
    sig_bytes = priv_key.sign(signing_base)
    sig_b64 = base64.b64encode(sig_bytes).decode("utf-8")

    headers["Signature-Input"] = f"sig1={sig_params}"
    headers["Signature"] = f"sig1=:{sig_b64}:"
    return headers


def request_gnap_grant(
    auth_server_url: str,
    access_types: list,
    interact: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Requests a GNAP grant from the Open Payments Authorization Server."""
    priv = get_private_key()
    payload: Dict[str, Any] = {
        "access_token": {"access": access_types},
        "client": DEFAULT_WALLET_ADDRESS
    }
    if interact:
        payload["interact"] = interact

    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    headers = _sign_http_request(
        method="POST",
        target_uri=auth_server_url,
        body_bytes=body,
        key_id=DEFAULT_KEY_ID,
        priv_key=priv
    )

    req = urllib.request.Request(auth_server_url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        raise RuntimeError(f"GNAP Grant Error ({e.code}): {err_msg}")


def create_live_incoming_payment(
    amount_cents: int,
    description: str = "Spaza Uniti x UbuOne Top-Up",
    wallet_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    Creates a real live Incoming Payment resource on the Interledger testnet
    with ILP streaming packet details and unique payment resource URL.
    """
    target_wallet = normalize_wallet_address(wallet_url or DEFAULT_WALLET_ADDRESS)
    wallet_doc = resolve_wallet_address(target_wallet)

    auth_server = wallet_doc["authServer"]
    resource_server = wallet_doc["resourceServer"]
    asset_code = wallet_doc["assetCode"]
    asset_scale = wallet_doc["assetScale"]

    # 1. Acquire GNAP access token for incoming-payment creation
    grant_resp = request_gnap_grant(
        auth_server_url=auth_server,
        access_types=[{"type": "incoming-payment", "actions": ["create", "read", "list"]}]
    )
    access_token = grant_resp["access_token"]["value"]

    # 2. Call Resource Server to create the Incoming Payment
    ip_url = f"{resource_server}/incoming-payments"
    ip_payload = {
        "walletAddress": target_wallet,
        "incomingAmount": {
            "value": str(amount_cents),
            "assetCode": asset_code,
            "assetScale": asset_scale
        },
        "metadata": {
            "description": description,
            "platform": "SpazaUniti-UbuOne"
        }
    }
    ip_body = json.dumps(ip_payload, separators=(",", ":")).encode("utf-8")
    priv = get_private_key()
    headers = _sign_http_request(
        method="POST",
        target_uri=ip_url,
        body_bytes=ip_body,
        key_id=DEFAULT_KEY_ID,
        priv_key=priv,
        extra_headers={"Authorization": f"GNAP {access_token}"}
    )

    req = urllib.request.Request(ip_url, data=ip_body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=12) as resp:
        return json.loads(resp.read().decode("utf-8"))


def create_live_interactive_topup(
    amount_cents: int,
    redirect_uri: str,
    nonce: str,
    wallet_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    Initiates an interactive GNAP grant for paying into Spaza Uniti from
    the user's real Open Payments testnet wallet.
    Returns the real interactive redirect URL on auth.interledger-test.dev.
    """
    target_wallet = normalize_wallet_address(wallet_url or DEFAULT_WALLET_ADDRESS)
    wallet_doc = resolve_wallet_address(target_wallet)

    auth_server = wallet_doc["authServer"]
    asset_code = wallet_doc["assetCode"]
    asset_scale = wallet_doc["assetScale"]

    interact = {
        "start": ["redirect"],
        "finish": {
            "method": "redirect",
            "uri": redirect_uri,
            "nonce": nonce
        }
    }

    grant_resp = request_gnap_grant(
        auth_server_url=auth_server,
        access_types=[{
            "type": "outgoing-payment",
            "actions": ["create", "read", "list"],
            "identifier": target_wallet,
            "limits": {
                "debitAmount": {
                    "value": str(amount_cents),
                    "assetCode": asset_code,
                    "assetScale": asset_scale
                }
            }
        }],
        interact=interact
    )

    return {
        "success": True,
        "interact_url": grant_resp.get("interact", {}).get("redirect"),
        "continue_uri": grant_resp.get("continue", {}).get("uri"),
        "continue_access_token": grant_resp.get("continue", {}).get("access_token", {}).get("value"),
        "wallet_address": target_wallet,
        "asset_code": asset_code,
        "asset_scale": asset_scale,
        "amount_cents": amount_cents
    }


def get_live_testnet_status() -> Dict[str, Any]:
    """Checks the health of the Open Payments testnet connection."""
    try:
        doc = resolve_wallet_address(DEFAULT_WALLET_ADDRESS)
        jwks_url = f"{DEFAULT_WALLET_ADDRESS}/jwks.json"
        req = urllib.request.Request(jwks_url, headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=8) as r:
            jwks = json.loads(r.read().decode("utf-8"))

        key_verified = any(k.get("kid") == DEFAULT_KEY_ID for k in jwks.get("keys", []))

        return {
            "connected": True,
            "network": "Interledger Testnet (Rafiki)",
            "wallet_address": DEFAULT_WALLET_ADDRESS,
            "payment_pointer": "$ilp.interledger-test.dev/2f0b6b2c",
            "key_id": DEFAULT_KEY_ID,
            "key_verified_on_testnet": key_verified,
            "asset_code": doc.get("assetCode"),
            "asset_scale": doc.get("assetScale"),
            "auth_server": doc.get("authServer"),
            "resource_server": doc.get("resourceServer"),
            "message": "Connected live to Interledger Testnet! Ready for real test payments."
        }
    except Exception as e:
        return {
            "connected": False,
            "wallet_address": DEFAULT_WALLET_ADDRESS,
            "key_id": DEFAULT_KEY_ID,
            "error": str(e)
        }
