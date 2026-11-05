import os
import sqlite3
import hashlib
import uuid
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "spazauniti.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def hash_pin(pin: str) -> str:
    """Secure deterministic salt-hash for 4-digit counter PINs."""
    salt = "spaza_uniti_salt_2026"
    return hashlib.sha256(f"{salt}:{pin}".encode("utf-8")).hexdigest()

def verify_pin(pin: str, stored_hash: str) -> bool:
    return hash_pin(pin) == stored_hash

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # 1. Customers / Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        cell_number TEXT NOT NULL,
        pin_hash TEXT NOT NULL,
        wallet_address_url TEXT NOT NULL,
        balance REAL NOT NULL DEFAULT 100.0,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL
    );
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_customer_username ON customers(username);")

    # 2. Payment Grants Table (Two-tier consent for outgoing debits)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS payment_grants (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        username TEXT NOT NULL,
        merchant_id TEXT NOT NULL,
        merchant_name TEXT NOT NULL,
        merchant_wallet TEXT NOT NULL,
        amount REAL NOT NULL,
        purpose TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING_CONSENT',
        consent_method TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    """)

    # 3. Incoming Payments Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS incoming_payments (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        username TEXT NOT NULL,
        amount REAL,
        description TEXT,
        completed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    """)

    # 4. Transactions Ledger Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        username TEXT NOT NULL,
        type TEXT NOT NULL,
        counterparty TEXT NOT NULL,
        amount REAL NOT NULL,
        purpose TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'COMPLETED',
        ilp_packet_ref TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    """)

    # 5. Units (Registered Spaza Stores) Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS units (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tagline TEXT,
        owner_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        whatsapp TEXT,
        address TEXT NOT NULL,
        township TEXT NOT NULL,
        landmark TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        wallet_address_url TEXT NOT NULL,
        open_payments_id TEXT NOT NULL,
        operating_hours TEXT DEFAULT '06:00 - 21:00',
        status TEXT DEFAULT 'OPEN',
        broadcast_enabled INTEGER DEFAULT 1,
        promotions_json TEXT DEFAULT '[]',
        loyalty_json TEXT DEFAULT '{}',
        jobs_json TEXT DEFAULT '[]',
        updated_at TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_units_township ON units(township);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_units_coords ON units(latitude, longitude);")

    # 6. Customer Unit-Scoped Ubuntu Tokens Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS customer_tokens (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        unit_id TEXT NOT NULL,
        ubu_balance REAL NOT NULL DEFAULT 0.0,
        updated_at TEXT NOT NULL
    );
    """)
    cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_cust_unit_tokens ON customer_tokens(username, unit_id);")

    # Pre-seed initial customers if directory is empty
    cursor.execute("SELECT COUNT(*) FROM customers")
    count = cursor.fetchone()[0]
    base_url = os.environ.get("SPAZA_UNITI_BASE_URL", "http://localhost:8001")
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Seed initial Ubuntu Tokens for demo customers if empty
    cursor.execute("SELECT COUNT(*) FROM customer_tokens")
    if cursor.fetchone()[0] == 0:
        sample_tokens = [
            ("tok_01", "mannini", "unit-104", 24.00, now), # 24 UBU: eligible for bread (16 UBU) & R20 taxi cash-out!
            ("tok_02", "mannini", "unit-102", 8.00, now),
            ("tok_03", "sipho", "unit-104", 12.00, now),
            ("tok_04", "azaria", "unit-104", 30.00, now), # 30 UBU: eligible for taxi cash-out!
            ("tok_05", "thandi", "unit-104", 16.00, now)  # 16 UBU: 1 free loaf
        ]
        cursor.executemany("""
        INSERT INTO customer_tokens (id, username, unit_id, ubu_balance, updated_at)
        VALUES (?, ?, ?, ?, ?);
        """, sample_tokens)


    if count == 0:
        sample_customers = [
            ("cust_mannini_01", "mannini", "Mannini Morake", "0721112233", hash_pin("1234"), f"{base_url}/mannini", 250.00, "ACTIVE", now),
            ("cust_sipho_02", "sipho", "Sipho Ndlovu", "0722223344", hash_pin("1234"), f"{base_url}/sipho", 180.00, "ACTIVE", now),
            ("cust_azaria_03", "azaria", "Azaria Morake", "0723334455", hash_pin("1234"), f"{base_url}/azaria", 320.00, "ACTIVE", now),
            ("cust_thandi_04", "thandi", "Mama Thandi Zulu", "0724445566", hash_pin("1234"), f"{base_url}/thandi", 140.00, "ACTIVE", now),
        ]
        cursor.executemany("""
        INSERT INTO customers (id, username, full_name, cell_number, pin_hash, wallet_address_url, balance, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, sample_customers)

    # Pre-seed registered units if directory is empty
    cursor.execute("SELECT COUNT(*) FROM units")
    unit_count = cursor.fetchone()[0]
    if unit_count == 0:
        import json
        promos_104 = json.dumps([
            {"id": "PROMO-001", "title": "Weekend Albany Superior White Special", "category": "Bakery", "original_price": 19.50, "promo_price": 16.00, "discount_pct": 18, "days_left": 2, "active": True},
            {"id": "PROMO-002", "title": "Golden Cloud Cake Flour 2.5kg", "category": "Staples", "original_price": 42.00, "promo_price": 35.00, "discount_pct": 16, "days_left": 4, "active": True}
        ])
        loyalty_104 = json.dumps({
            "title": "Daily Bread Stamp Club",
            "reward_description": "Buy 9 loaves of Albany bread, get the 10th loaf FREE! Tracked automatically on Spaza Uniti.",
            "stamps_required": 9,
            "active": True
        })
        jobs_104 = json.dumps([
            {"id": "JOB-01", "title": "Weekend Stock Offloader", "rate": "R150 / day", "schedule": "Saturday 07:00 - 12:00", "description": "Help offload weekly maize and beverage delivery from wholesaler."}
        ])

        sample_units = [
            (
                "unit-104",
                "Khumalo Spaza Store",
                "Fresh bakery, staples, cold drinks & community hub",
                "Baba Khumalo",
                "072 123 4567",
                "27721234567",
                "Shop 14, Zone 3, Dobsonville",
                "Soweto",
                "Near Dobsonville Police Station",
                -26.2234,
                27.8681,
                f"{base_url}/unit-104",
                "$spazauniti.org/unit-104",
                "06:00 - 21:00",
                "OPEN",
                1,
                promos_104,
                loyalty_104,
                jobs_104,
                now,
                now
            ),
            (
                "unit-102",
                "Mama Thandi Corner Spaza",
                "Daily staples, fresh milk, prepaid airtime and snacks",
                "Mama Thandi Zulu",
                "072 345 6789",
                "27723456789",
                "Stand 884, Zone 2, Meadowlands",
                "Soweto",
                "Opposite Meadowlands High School",
                -26.2310,
                27.8820,
                f"{base_url}/unit-102",
                "$spazauniti.org/unit-102",
                "06:30 - 20:30",
                "OPEN",
                1,
                json.dumps([{"id": "PROMO-003", "title": "5kg White Star Super Maize Meal", "category": "Staples", "original_price": 48.00, "promo_price": 42.00, "discount_pct": 12, "days_left": 3, "active": True}]),
                json.dumps({"title": "Meal & Milk Loyalty Club", "reward_description": "Collect 5 stamps on staples, get 1L Ultra Mel custard free!", "stamps_required": 5, "active": True}),
                json.dumps([]),
                now,
                now
            ),
            (
                "unit-105",
                "Bongani Wholesale & Spaza",
                "Bulk groceries, township braai packs and ice cold Stoney",
                "Bongani Sithole",
                "073 456 7890",
                "27734567890",
                "Corner Moema & Kumalo St, Orlando West",
                "Soweto",
                "Near Hector Pieterson Memorial & Vilakazi St",
                -26.2395,
                27.9050,
                f"{base_url}/unit-105",
                "$spazauniti.org/unit-105",
                "07:00 - 22:00",
                "OPEN",
                1,
                json.dumps([{"id": "PROMO-004", "title": "Stoney Ginger Beer 2L Special", "category": "Beverages", "original_price": 24.00, "promo_price": 19.50, "discount_pct": 18, "days_left": 5, "active": True}]),
                json.dumps({}),
                json.dumps([{"id": "JOB-02", "title": "Afternoon Store Assistant & Counter Clerk", "rate": "R220 / shift", "schedule": "Fridays & Saturdays 14:00 - 21:00", "description": "Assist counter sales during peak afternoon foot traffic."}]),
                now,
                now
            ),
            (
                "unit-108",
                "Dlamini Family Spaza",
                "Neighborhood groceries, fresh fruit and vegetable baskets",
                "Sipho Dlamini",
                "071 234 5678",
                "27712345678",
                "412 Extension 2, Dobsonville",
                "Soweto",
                "Next to Dobsonville Primary",
                -26.2190,
                27.8620,
                f"{base_url}/unit-108",
                "$spazauniti.org/unit-108",
                "06:00 - 20:00",
                "OPEN",
                1,
                json.dumps([]),
                json.dumps({}),
                json.dumps([]),
                now,
                now
            )
        ]

        cursor.executemany("""
        INSERT INTO units (
            id, name, tagline, owner_name, phone, whatsapp, address, township, landmark,
            latitude, longitude, wallet_address_url, open_payments_id, operating_hours,
            status, broadcast_enabled, promotions_json, loyalty_json, jobs_json, updated_at, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, sample_units)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()

    print("SpazaUniti database initialized at:", DB_PATH)
