"""
SpazaKhokha End-to-End Open Payments Settlement Flow.

Executes the 5-step payment lifecycle:
1. Shop requests incoming payment grant
2. Shop creates incoming payment resource
3. Customer requests quote grant and generates quote
4. Customer negotiates outgoing payment grant via interactive GNAP
5. Outgoing payment execution and final settlement
"""

import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import parse_qs, urlparse

from dotenv import load_dotenv
import httpx
from open_payments_sdk.api.resource import (
    OutgoingPayments,
    Quotes,
    get_default_covered_components,
    get_default_headers,
)
from open_payments_sdk.client.client import OpenPaymentsClient
from open_payments_sdk.http import HttpClient
from open_payments_sdk.models.auth import GrantContinueResponse, GrantRequest
from open_payments_sdk.models.resource import (
    IncomingPayment,
    IncomingPaymentRequest,
    OutgoingPayment,
    OutgoingPaymentRequest,
    Quote,
)

load_dotenv()

# ---------------------------------------------------------------------------
# SDK Compatibility Patches for Interledger Testnet
# ---------------------------------------------------------------------------

# Patch 1: Make optional timestamps that testnet occasionally omits
for model in (IncomingPayment, Quote, OutgoingPayment):
    for field_name in ("updatedAt", "createdAt"):
        if field_name in model.model_fields:
            model.model_fields[field_name].default = None
            model.model_fields[field_name].annotation = Optional[str]
    model.model_rebuild(force=True)


def _to_dict(obj):
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "model_dump"):
        return obj.model_dump(exclude_unset=True, mode="json")
    return dict(obj)


def _only_known(model, data: dict) -> dict:
    """Drop response fields the SDK model doesn't know about."""
    return {k: v for k, v in data.items() if k in model.model_fields}


def _signed_post(self, url: str, data: dict, access_token: str) -> dict:
    headers = {
        **get_default_headers(),
        **self.get_auth_header(access_token=access_token),
    }
    request = self.http_client.build_request(
        method="POST", url=url, headers=headers, json=data
    )
    request = self.set_content_digest(request=request)
    request = self.sign_request(
        request,
        (
            "content-type",
            "content-digest",
            "content-length",
            "authorization",
            *get_default_covered_components(),
        ),
    )
    return self.http_client.send(request=request).json()


# Patch 2: Quotes model tolerance
def patched_post_create_quote(self, quote, resource_server_endpoint: str, access_token: str) -> Quote:
    url = f"{resource_server_endpoint.rstrip('/')}/quotes"
    res = _signed_post(self, url, _to_dict(quote), access_token)
    return Quote.model_validate(_only_known(Quote, res))


Quotes.post_create_quote = patched_post_create_quote


# Patch 3: Outgoing payments model tolerance
def patched_post_create_payment(self, payment, resource_server_endpoint: str, access_token: str) -> OutgoingPayment:
    url = f"{resource_server_endpoint.rstrip('/')}/outgoing-payments"
    res = _signed_post(self, url, _to_dict(payment), access_token)
    return OutgoingPayment.model_validate(_only_known(OutgoingPayment, res))


OutgoingPayments.post_create_payment = patched_post_create_payment

# ---------------------------------------------------------------------------
# Configuration & Environment
# ---------------------------------------------------------------------------

CUSTOMER_WALLET = os.getenv("CUSTOMER_WALLET", "https://ilp.interledger-test.dev/customer-wallet")
SHOP_WALLET = os.getenv("SHOP_WALLET", "https://ilp.interledger-test.dev/spazakhokha-shop")

CUSTOMER_KEY_ID = os.getenv("CUSTOMER_KEY_ID", "bdb8936f-eb9f-4201-9a7f-1bb93edc2377")
STORE_KEY_ID = os.getenv("STORE_KEY_ID", "ce0e80a6-508c-4084-95d7-7b0bcc7c7ebc")

CUSTOMER_KEY_PATH = os.getenv("CUSTOMER_KEY_PATH", "customer_private.key")
STORE_KEY_PATH = os.getenv("STORE_KEY_PATH", "store_private.key")

CALLBACK_URI = os.getenv("CALLBACK_URI", "http://localhost:3300/callback")

ASSET_CODE = os.getenv("ASSET_CODE", "ZAR")
ASSET_SCALE = int(os.getenv("ASSET_SCALE", "2"))


def read_key(file_path: str) -> str:
    if not os.path.exists(file_path):
        print(f"[-] Missing private key file: {file_path}")
        print("    Ensure your private key file is placed in the project root directory.")
        sys.exit(1)
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


def extract_token(grant) -> str:
    root = getattr(grant, "root", grant)
    token_obj = getattr(root, "access_token", None)
    if token_obj is None:
        raise RuntimeError(f"Grant has no access token (is it pending interaction?): {root}")
    return token_obj.value


def val(x):
    """Unwrap RootModel instances if present."""
    return getattr(x, "root", x)


def make_client(wallet: str, key_id: str, key_path: str) -> OpenPaymentsClient:
    return OpenPaymentsClient(
        client_wallet_address=wallet,
        keyid=key_id,
        private_key=read_key(key_path),
        http_client=HttpClient(http_timeout=30.0),
    )


def continue_grant(grants, continue_uri: str, continue_token: str, interact_ref: str, max_retries: int = 3) -> GrantContinueResponse:
    """Send GNAP continuation request to receive the approved access token, retrying if the idle socket was dropped."""
    headers = {
        **get_default_headers(),
        "Authorization": f"GNAP {continue_token}",
    }
    
    for attempt in range(1, max_retries + 1):
        try:
            request = grants.http_client.build_request(
                method="POST",
                url=continue_uri,
                headers=headers,
                json={"interact_ref": interact_ref},
            )
            request = grants.set_content_digest(request=request)
            request = grants.sign_request(
                request,
                (
                    "content-type",
                    "content-digest",
                    "content-length",
                    "authorization",
                    *get_default_covered_components(),
                ),
            )
            response = grants.http_client.send(request=request)
            return GrantContinueResponse.model_validate(response.json())
        except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
            if attempt < max_retries:
                print(f"  [!] Connection reset while idle (attempt {attempt}/{max_retries}). Retrying on fresh socket...")
                continue
            raise exc


def parse_interact_ref(user_input: str) -> str:
    cleaned = user_input.strip()
    if "interact_ref=" in cleaned:
        parsed_url = urlparse(cleaned)
        query_params = parse_qs(parsed_url.query)
        if "interact_ref" in query_params:
            return query_params["interact_ref"][0]
        for part in cleaned.split("?")[1].split("&"):
            if part.startswith("interact_ref="):
                return part.split("=")[1]
    return cleaned


def execute_settlement(amount_cents: str, description: str = "Spaza purchase settlement"):
    """
    Executes an end-to-end payment settlement between customer and shop for any amount.
    
    :param amount_cents: String representation of the amount in cents (e.g., '1500' for R15.00).
    :param description: Description of the transaction.
    """
    amount_display = f"R{int(amount_cents) / 100:.2f}"
    print("========================================")
    print(f"   SpazaKhokha Payment: {amount_display}   ")
    print("========================================")

    customer_client = make_client(CUSTOMER_WALLET, CUSTOMER_KEY_ID, CUSTOMER_KEY_PATH)
    shop_client = make_client(SHOP_WALLET, STORE_KEY_ID, STORE_KEY_PATH)

    print("\n[Init] Resolving wallet server endpoints...")
    shop_info = shop_client.wallet.get_wallet_address(SHOP_WALLET)
    customer_info = customer_client.wallet.get_wallet_address(CUSTOMER_WALLET)

    shop_auth_server = str(shop_info.authServer)
    customer_auth_server = str(customer_info.authServer)
    shop_resource_server = str(shop_info.resourceServer)
    customer_resource_server = str(customer_info.resourceServer)

    # Step 1: Shop requests incoming payment grant
    print("\n[Step 1] Requesting Incoming Payment Grant for Shop...")
    grant_req = GrantRequest.model_validate({
        "access_token": {
            "access": [{"type": "incoming-payment", "actions": ["create", "read"]}]
        },
        "client": SHOP_WALLET,
    })
    shop_grant = shop_client.grants.post_grant_request(grant_req, shop_auth_server)
    incoming_token = extract_token(shop_grant)
    print(f"  Shop grant received: {incoming_token[:10]}...")

    # Step 2: Shop creates the incoming payment
    print(f"\n[Step 2] Creating Incoming Payment resource for {amount_display}...")
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
    ip_req = IncomingPaymentRequest.model_validate({
        "walletAddress": SHOP_WALLET,
        "incomingAmount": {
            "value": amount_cents,
            "assetCode": ASSET_CODE,
            "assetScale": ASSET_SCALE,
        },
        "expiresAt": expires_at,
        "metadata": {"description": description},
    })
    incoming_payment = shop_client.incoming_payments.post_create_payment(
        payment=ip_req,
        resource_server_endpoint=shop_resource_server,
        access_token=incoming_token,
    )
    incoming_payment_url = str(incoming_payment.id)
    print(f"  Incoming Payment created: {incoming_payment_url}")

    # Step 3: Customer gets a quote grant and creates a quote
    print("\n[Step 3] Requesting Quote Grant for Customer...")
    quote_grant_req = GrantRequest.model_validate({
        "access_token": {
            "access": [{"type": "quote", "actions": ["create", "read"]}]
        },
        "client": CUSTOMER_WALLET,
    })
    quote_grant = customer_client.grants.post_grant_request(quote_grant_req, customer_auth_server)
    quote_token = extract_token(quote_grant)
    print(f"  Quote grant received: {quote_token[:10]}...")

    print("Creating Quote...")
    quote = customer_client.quotes.post_create_quote(
        quote={
            "walletAddress": CUSTOMER_WALLET,
            "receiver": incoming_payment_url,
            "method": "ilp",
        },
        resource_server_endpoint=customer_resource_server,
        access_token=quote_token,
    )
    debit_val = val(quote.debitAmount.value)
    debit_asset = val(quote.debitAmount.assetCode)
    rec_val = val(quote.receiveAmount.value)
    rec_asset = val(quote.receiveAmount.assetCode)
    print(f"  Quote received: Send {debit_val} {debit_asset} -> Receive {rec_val} {rec_asset}")

    # Step 4: Customer outgoing-payment grant (interactive GNAP)
    print("\n[Step 4] Requesting Outgoing Payment Grant...")
    op_grant_req = GrantRequest.model_validate({
        "access_token": {
            "access": [{
                "type": "outgoing-payment",
                "actions": ["create", "read"],
                "identifier": CUSTOMER_WALLET,
                "limits": {
                    "debitAmount": {
                        "value": str(debit_val),
                        "assetCode": ASSET_CODE,
                        "assetScale": ASSET_SCALE,
                    }
                },
            }]
        },
        "client": CUSTOMER_WALLET,
        "interact": {
            "start": ["redirect"],
            "finish": {
                "method": "redirect",
                "uri": CALLBACK_URI,
                "nonce": uuid.uuid4().hex,
            },
        },
    })
    pending = customer_client.grants.post_grant_request(op_grant_req, customer_auth_server)
    pending = getattr(pending, "root", pending)

    approval_url = str(pending.interact.redirect)
    continue_uri = str(pending.cont.uri)
    continue_token = pending.cont.access_token.value

    print("\n" + "*" * 60)
    print("CUSTOMER APPROVAL REQUIRED")
    print(f"Payment Amount: {amount_display}")
    print("Open this URL in your browser and approve the payment:\n")
    print(f"  {approval_url}\n")
    print("Your browser will redirect to localhost:3300/callback.")
    print("Copy the address from the URL bar and paste it below.")
    print("*" * 60)

    pasted = input("\nPaste the redirect URL (or just the interact_ref): ")
    interact_ref = parse_interact_ref(pasted)

    print(f"\nFinalizing grant with interact_ref: {interact_ref}")
    cont_result = continue_grant(
        customer_client.grants, continue_uri, continue_token, interact_ref
    )
    op_token = cont_result.access_token.value
    print(f"  Outgoing grant approved: {op_token[:10]}...")

    # Step 5: Customer executes the outgoing payment
    print("\n[Step 5] Executing Payment...")
    op_req = OutgoingPaymentRequest.model_validate({
        "walletAddress": CUSTOMER_WALLET,
        "quoteId": str(quote.id),
        "metadata": {"description": description},
    })
    payment = customer_client.outgoing_payments.post_create_payment(
        payment=op_req,
        resource_server_endpoint=customer_resource_server,
        access_token=op_token,
    )

    print("\n========================================")
    print("  [OK] Payment Settlement Successful!")
    print(f"  Payment ID: {payment.id}")
    print(f"  Amount Settled: {amount_display}")
    print(f"  Destination: {SHOP_WALLET}")
    print("========================================")
    return payment


if __name__ == "__main__":
    try:
        # Check if amount was passed via command line argument (e.g. python process_payment.py 25.50)
        if len(sys.argv) > 1:
            raw_input = sys.argv[1].strip()
        else:
            raw_input = input("Enter amount to pay in ZAR (e.g. 15.00): ").strip()
            if not raw_input:
                raw_input = "15.00"

        cents = str(int(float(raw_input) * 100))
        execute_settlement(amount_cents=cents)
    except httpx.HTTPStatusError as e:
        print(f"\n[-] HTTP {e.response.status_code} from {e.request.url}")
        print(f"    Response body: {e.response.text}")
        sys.exit(1)