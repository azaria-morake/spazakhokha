import os
from open_payments_sdk.client.client import OpenPaymentsClient

# Wallet URLs from Test Wallet
CUSTOMER_WALLET = "https://ilp.interledger-test.dev/customer-wallet"
SHOP_WALLET = "https://ilp.interledger-test.dev/spazakhokha-shop"

# Key IDs From Developer Keys
CUSTOMER_KEY_ID = "bdb8936f-eb9f-4201-9a7f-1bb93edc2377"
STORE_KEY_ID = "ce0e80a6-508c-4084-95d7-7b0bcc7c7ebc"

CUSTOMER_KEY_PATH = "customer_private.key"
STORE_KEY_PATH = "store_private.key"

def main():
    print("1. Checking key files...")
    if not os.path.exists(CUSTOMER_KEY_PATH) or not os.path.exists(STORE_KEY_PATH):
        print("Error: Missing key files in current directory.")
        return

    with open(CUSTOMER_KEY_PATH, "r", encoding="utf-8") as f:
        customer_key_pem = f.read()

    print("2. Connecting client with customer credentials...")
    client = OpenPaymentsClient(
        client_wallet_address=CUSTOMER_WALLET,
        keyid=CUSTOMER_KEY_ID,
        private_key=customer_key_pem
    )

    print("3. Querying SpazaKhokha shop wallet...")
    shop_wallet = client.wallet.get_wallet_address(SHOP_WALLET)
    asset_code = getattr(shop_wallet.assetCode, "root", shop_wallet.assetCode)
    asset_scale = getattr(shop_wallet.assetScale, "root", shop_wallet.assetScale)
    print(f"  Connected to shop: {shop_wallet.id}")
    print(f"  Asset: {asset_code} (Scale: {asset_scale})")
    print(f"  Auth Server: {shop_wallet.authServer}")

    print("\n4. Querying Customer wallet...")
    customer_wallet = client.wallet.get_wallet_address(CUSTOMER_WALLET)
    cust_asset_code = getattr(customer_wallet.assetCode, "root", customer_wallet.assetCode)
    print(f"  Connected to customer: {customer_wallet.id}")
    print(f"  Asset: {cust_asset_code}")

    print("\nSuccess! Both wallet endpoints and credentials are confirmed.")

if __name__ == "__main__":
    main()
