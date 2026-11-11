import os
import json
import sqlite3
import hashlib
from datetime import datetime

DB_PATH = os.environ.get("SPAZA_UNITI_DB_PATH", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "spazauniti.db"))

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def hash_pin(pin: str) -> str:
    """Deterministic salted SHA-256 hash for 4-digit counter PINs & staff passcodes."""
    salt = "spaza_uniti_salt_2026"
    return hashlib.sha256(f"{salt}:{pin}".encode("utf-8")).hexdigest()

def verify_pin(pin: str, stored_hash: str) -> bool:
    return hash_pin(pin) == stored_hash

def _ensure_column(cursor, table: str, column: str, definition: str):
    cursor.execute(f"PRAGMA table_info({table})")
    existing = [row[1] for row in cursor.fetchall()]
    if column not in existing:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # 1. Customers / Consumers Table (Supports FAMILY & INDIVIDUAL account classes)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        cell_number TEXT NOT NULL,
        pin_hash TEXT NOT NULL,
        wallet_address_url TEXT NOT NULL,
        balance REAL NOT NULL DEFAULT 100.0,
        ubu_balance REAL NOT NULL DEFAULT 0.0,
        account_type TEXT NOT NULL DEFAULT 'INDIVIDUAL',
        family_parent_username TEXT DEFAULT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL
    );
    """)
    _ensure_column(cursor, "customers", "ubu_balance", "REAL NOT NULL DEFAULT 0.0")
    _ensure_column(cursor, "customers", "account_type", "TEXT NOT NULL DEFAULT 'INDIVIDUAL'")
    _ensure_column(cursor, "customers", "family_parent_username", "TEXT DEFAULT NULL")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_customer_username ON customers(username);")

    # 2. Payment Grants Table (Two-tier Open Payments consent)
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

    # 4. Transactions Ledger Table (Customer-facing Open Payments & UBU activity)
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

    # 5. Units (Registered Spaza Stores / UbuOne Nodes)
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
        ubu_balance REAL NOT NULL DEFAULT 0.0,
        updated_at TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)
    _ensure_column(cursor, "units", "ubu_balance", "REAL NOT NULL DEFAULT 0.0")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_units_township ON units(township);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_units_coords ON units(latitude, longitude);")

    # 6. Customer Unit-Scoped Loyalty Reward Ubuntu Tokens Table
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

    # 7. Consumer Family Members & Beneficiary Links (Invites, Caps & Allowances)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS consumer_links (
        id TEXT PRIMARY KEY,
        sponsor_username TEXT NOT NULL,
        member_username TEXT NOT NULL,
        link_type TEXT NOT NULL,
        relationship_label TEXT NOT NULL DEFAULT 'Member',
        family_role TEXT NOT NULL DEFAULT 'FAMILY_MEMBER',
        status TEXT NOT NULL DEFAULT 'ACCEPTED',
        allocation_limit_ubu REAL NOT NULL DEFAULT 0.0,
        period TEXT NOT NULL DEFAULT 'DAILY',
        spent_in_period_ubu REAL NOT NULL DEFAULT 0.0,
        last_reset_date TEXT NOT NULL,
        allowed_categories TEXT NOT NULL DEFAULT 'All Spaza Goods',
        created_at TEXT NOT NULL
    );
    """)
    _ensure_column(cursor, "consumer_links", "family_role", "TEXT NOT NULL DEFAULT 'FAMILY_MEMBER'")
    cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_consumer_link_pair ON consumer_links(sponsor_username, member_username, link_type);")

    # 8. UbuOne RBAC Staff Accounts (Unit Owners, Cashiers, Network Admin)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS unit_staff (
        id TEXT PRIMARY KEY,
        unit_id TEXT,
        username TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL,
        passcode_hash TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
    );
    """)

    # 9. UbuOne RBAC Auth Sessions (migrate if legacy ubuflow_sessions exists)
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='ubuflow_sessions'")
    if cursor.fetchone():
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='ubuone_sessions'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE ubuflow_sessions RENAME TO ubuone_sessions")
        else:
            cursor.execute("DROP TABLE ubuflow_sessions")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ubuone_sessions (
        token TEXT PRIMARY KEY,
        staff_id TEXT NOT NULL,
        username TEXT NOT NULL,
        full_name TEXT NOT NULL,
        unit_id TEXT,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
    );
    """)

    # 9b. UbuOne Consumer & Family RBAC Auth Sessions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ubuone_consumer_sessions (
        token TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        username TEXT NOT NULL,
        full_name TEXT NOT NULL,
        account_type TEXT NOT NULL,
        consumer_role TEXT NOT NULL,
        family_parent_username TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
    );
    """)

    # 10. UbuOne Micro-Ledger & Unit Operations Log (migrate if legacy ubuflow_ledger exists)
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='ubuflow_ledger'")
    if cursor.fetchone():
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='ubuone_ledger'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE ubuflow_ledger RENAME TO ubuone_ledger")
        else:
            cursor.execute("DROP TABLE ubuflow_ledger")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ubuone_ledger (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        unit_id TEXT,
        staff_username TEXT,
        from_username TEXT,
        to_username TEXT,
        amount_ubu REAL NOT NULL,
        fee_zar REAL NOT NULL DEFAULT 0.0,
        description TEXT NOT NULL,
        source_bucket TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)

    base_url = os.environ.get("SPAZA_UNITI_BASE_URL", "http://localhost:8001")
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    today_str = datetime.now().strftime("%Y-%m-%d")

    # Seed Customers (Original + Family Vault @morake_ext_5 + Individual Adults)
    sample_customers = [
        # Original demo handles
        ("cust_mannini_01", "mannini", "Mannini Morake", "0721112233", hash_pin("1234"), f"{base_url}/mannini", 250.00, 140.00, "INDIVIDUAL", None, "ACTIVE", now),
        ("cust_sipho_02", "sipho", "Sipho Ndlovu", "0722223344", hash_pin("1234"), f"{base_url}/sipho", 180.00, 220.00, "INDIVIDUAL", None, "ACTIVE", now),
        ("cust_azaria_03", "azaria", "Azaria Morake", "0723334455", hash_pin("1234"), f"{base_url}/azaria", 320.00, 350.00, "INDIVIDUAL", None, "ACTIVE", now),
        ("cust_thandi_04", "thandi", "Mama Thandi Zulu", "0724445566", hash_pin("1234"), f"{base_url}/thandi", 140.00, 95.00, "INDIVIDUAL", None, "ACTIVE", now),
        # Family Vault Account (@morake_ext_5) & Family Members
        ("cust_fam_morake", "morake_ext_5", "Morake Household Vault", "0729001122", hash_pin("1234"), f"{base_url}/morake_ext_5", 600.00, 500.00, "FAMILY", None, "ACTIVE", now),
        ("cust_mannimorake", "mannimorake", "Manni Morake", "0729001123", hash_pin("1234"), f"{base_url}/mannimorake", 100.00, 45.00, "INDIVIDUAL", "morake_ext_5", "ACTIVE", now),
        ("cust_azariamorake", "azariamorake", "Azaria Morake Jr", "0729001124", hash_pin("1234"), f"{base_url}/azariamorake", 150.00, 80.00, "INDIVIDUAL", "morake_ext_5", "ACTIVE", now),
        ("cust_lethabomorake", "lethabomorake", "Lethabo Morake", "0729001125", hash_pin("1234"), f"{base_url}/lethabomorake", 0.00, 0.00, "INDIVIDUAL", "morake_ext_5", "ACTIVE", now),
        # Individual beneficiary handle
        ("cust_lerato_05", "lerato", "Lerato Mokoena", "0735556677", hash_pin("1234"), f"{base_url}/lerato", 100.00, 35.00, "INDIVIDUAL", None, "ACTIVE", now),
    ]
    for c in sample_customers:
        cursor.execute("""
        INSERT OR IGNORE INTO customers (
            id, username, full_name, cell_number, pin_hash, wallet_address_url,
            balance, ubu_balance, account_type, family_parent_username, status, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, c)

    # Backfill spendable UBU on pre-existing seeded accounts that started with 0
    cursor.execute("UPDATE customers SET ubu_balance = 140.0 WHERE username = 'mannini' AND ubu_balance = 0.0")
    cursor.execute("UPDATE customers SET ubu_balance = 220.0 WHERE username = 'sipho' AND ubu_balance = 0.0")
    cursor.execute("UPDATE customers SET ubu_balance = 350.0 WHERE username = 'azaria' AND ubu_balance = 0.0")
    cursor.execute("UPDATE customers SET ubu_balance = 95.0 WHERE username = 'thandi' AND ubu_balance = 0.0")

    # Seed Family Links & Individual Beneficiary Invitations
    sample_links = [
        ("lnk_fam_01", "morake_ext_5", "mannimorake", "FAMILY_MEMBER", "Spouse / Co-Admin", "FAMILY_ADMIN", "ACCEPTED", 150.00, "DAILY", 0.0, today_str, "All Spaza Goods", now),
        ("lnk_fam_02", "morake_ext_5", "azariamorake", "FAMILY_MEMBER", "Adult Son", "FAMILY_MEMBER", "ACCEPTED", 150.00, "DAILY", 0.0, today_str, "All Spaza Goods", now),
        ("lnk_fam_03", "morake_ext_5", "lethabomorake", "FAMILY_MEMBER", "School Child", "FAMILY_MEMBER", "ACCEPTED", 10.00, "DAILY", 0.0, today_str, "Snacks & School Lunch", now),
        ("lnk_ben_01", "azaria", "lerato", "BENEFICIARY", "Girlfriend", "FAMILY_MEMBER", "ACCEPTED", 100.00, "WEEKLY", 0.0, today_str, "Groceries & Essentials", now),
        ("lnk_ben_02", "sipho", "mannini", "BENEFICIARY", "Sister", "FAMILY_MEMBER", "PENDING", 80.00, "WEEKLY", 0.0, today_str, "Groceries & Essentials", now),
    ]
    for lnk in sample_links:
        cursor.execute("""
        INSERT OR IGNORE INTO consumer_links (
            id, sponsor_username, member_username, link_type, relationship_label,
            family_role, status, allocation_limit_ubu, period, spent_in_period_ubu, last_reset_date,
            allowed_categories, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, lnk)
    cursor.execute("""
    UPDATE consumer_links SET family_role = 'FAMILY_ADMIN'
    WHERE sponsor_username = 'morake_ext_5' AND member_username = 'mannimorake' AND id = 'lnk_fam_01';
    """)

    # Seed Unit-Scoped Reward Ubuntu Tokens
    sample_tokens = [
        ("tok_01", "mannini", "unit-104", 24.00, now),
        ("tok_02", "mannini", "unit-102", 8.00, now),
        ("tok_03", "sipho", "unit-104", 12.00, now),
        ("tok_04", "azaria", "unit-104", 30.00, now),
        ("tok_05", "thandi", "unit-104", 16.00, now),
        ("tok_06", "mannimorake", "unit-104", 18.00, now),
    ]
    for tok in sample_tokens:
        cursor.execute("""
        INSERT OR IGNORE INTO customer_tokens (id, username, unit_id, ubu_balance, updated_at)
        VALUES (?, ?, ?, ?, ?);
        """, tok)

    # Seed Registered Units if empty
    cursor.execute("SELECT COUNT(*) FROM units")
    if cursor.fetchone()[0] == 0:
        promos_104 = json.dumps([
            {"id": "PROMO-001", "title": "Weekend Albany Superior White Special", "category": "Bakery", "original_price": 19.50, "promo_price": 16.00, "discount_pct": 18, "days_left": 2, "active": True},
            {"id": "PROMO-002", "title": "Golden Cloud Cake Flour 2.5kg", "category": "Staples", "original_price": 42.00, "promo_price": 35.00, "discount_pct": 16, "days_left": 4, "active": True}
        ])
        loyalty_104 = json.dumps({
            "programs": [
                {
                    "id": "LOYALTY-001",
                    "title": "Daily Bread Stamp Club",
                    "program_type": "STAPLE_ACCUMULATOR",
                    "community_pact": "Buy 9 loaves of Albany bread, get the 10th loaf FREE! Tracked automatically as Ubuntu Tokens.",
                    "target_item": "Albany Superior White Bread",
                    "item_price_zar": 16.00,
                    "reward_threshold_ubu": 16.00,
                    "token_rate_per_event": 1.78,
                    "stamps_or_count": 9,
                    "stamps_required": 9,
                    "reward_description": "Buy 9 loaves of Albany bread, get the 10th loaf FREE! (16.00 UBU Reward)",
                    "active": True
                },
                {
                    "id": "LOYALTY-002",
                    "title": "SASSA Pensioner Goodwill Perk",
                    "program_type": "PENSIONER_SASSA_PERK",
                    "community_pact": "Every pensioner shopping on SASSA payout day receives 15.00 Ubuntu Tokens for a free 500g sugar pack or tea.",
                    "target_item": "500g Sugar Pack or Glen Tea",
                    "item_price_zar": 15.00,
                    "reward_threshold_ubu": 15.00,
                    "token_rate_per_event": 15.00,
                    "stamps_or_count": 1,
                    "stamps_required": 1,
                    "reward_description": "Free 500g sugar pack or tea on pension payout days (15.00 UBU)",
                    "active": True
                },
                {
                    "id": "LOYALTY-003",
                    "title": "Kasi Sweet & Snack Bonus",
                    "program_type": "CUSTOM_UBUNTU",
                    "community_pact": "Buy 10 R1 sweets or snacks at the counter, earn 1.00 Reward UBU toward your next school treat!",
                    "target_item": "R1 Lollipop / Counter Snack",
                    "item_price_zar": 1.00,
                    "reward_threshold_ubu": 1.00,
                    "token_rate_per_event": 0.10,
                    "stamps_or_count": 10,
                    "stamps_required": 10,
                    "reward_description": "Collect 1.00 Reward UBU on every 10 R1 counter treats",
                    "active": True
                }
            ],
            "primary": {
                "title": "Daily Bread Stamp Club",
                "reward_description": "Buy 9 loaves of Albany bread, get the 10th loaf FREE! (16.00 UBU Reward)",
                "stamps_required": 9,
                "active": True
            }
        })
        jobs_104 = json.dumps([
            {"id": "JOB-01", "title": "Weekend Stock Offloader", "rate": "R150 / day", "schedule": "Saturday 07:00 - 12:00", "description": "Help offload weekly maize and beverage delivery from wholesaler."}
        ])

        sample_units = [
            (
                "unit-104", "Khumalo Spaza Store", "Fresh bakery, R1 snacks, staples & UbuOne node",
                "Baba Khumalo", "072 123 4567", "27721234567",
                "Shop 14, Zone 3, Dobsonville", "Soweto", "Near Dobsonville Police Station",
                -26.2234, 27.8681, f"{base_url}/unit-104", "$spazauniti.org/unit-104",
                "06:00 - 21:00", "OPEN", 1, promos_104, loyalty_104, jobs_104, 645.50, now, now
            ),
            (
                "unit-102", "Mama Thandi Corner Spaza", "Daily staples, fresh milk, prepaid airtime and snacks",
                "Mama Thandi Zulu", "072 345 6789", "27723456789",
                "Stand 884, Zone 2, Meadowlands", "Soweto", "Opposite Meadowlands High School",
                -26.2310, 27.8820, f"{base_url}/unit-102", "$spazauniti.org/unit-102",
                "06:30 - 20:30", "OPEN", 1,
                json.dumps([{"id": "PROMO-003", "title": "5kg White Star Super Maize Meal", "category": "Staples", "original_price": 48.00, "promo_price": 42.00, "discount_pct": 12, "days_left": 3, "active": True}]),
                json.dumps({"title": "Meal & Milk Loyalty Club", "reward_description": "Collect 5 stamps on staples, get 1L Ultra Mel custard free!", "stamps_required": 5, "active": True}),
                json.dumps([]), 320.00, now, now
            ),
            (
                "unit-105", "Bongani Wholesale & Spaza", "Bulk groceries, township braai packs and ice cold Stoney",
                "Bongani Sithole", "073 456 7890", "27734567890",
                "Corner Moema & Kumalo St, Orlando West", "Soweto", "Near Hector Pieterson Memorial & Vilakazi St",
                -26.2395, 27.9050, f"{base_url}/unit-105", "$spazauniti.org/unit-105",
                "07:00 - 22:00", "OPEN", 1,
                json.dumps([{"id": "PROMO-004", "title": "Stoney Ginger Beer 2L Special", "category": "Beverages", "original_price": 24.00, "promo_price": 19.50, "discount_pct": 18, "days_left": 5, "active": True}]),
                json.dumps({}),
                json.dumps([{"id": "JOB-02", "title": "Afternoon Store Assistant & Counter Clerk", "rate": "R220 / shift", "schedule": "Fridays & Saturdays 14:00 - 21:00", "description": "Assist counter sales during peak afternoon foot traffic."}]),
                410.00, now, now
            ),
            (
                "unit-108", "Dlamini Family Spaza", "Neighborhood groceries, fresh fruit and vegetable baskets",
                "Sipho Dlamini", "071 234 5678", "27712345678",
                "412 Extension 2, Dobsonville", "Soweto", "Next to Dobsonville Primary",
                -26.2190, 27.8620, f"{base_url}/unit-108", "$spazauniti.org/unit-108",
                "06:00 - 20:00", "OPEN", 1, json.dumps([]), json.dumps({}), json.dumps([]), 190.00, now, now
            )
        ]
        cursor.executemany("""
        INSERT INTO units (
            id, name, tagline, owner_name, phone, whatsapp, address, township, landmark,
            latitude, longitude, wallet_address_url, open_payments_id, operating_hours,
            status, broadcast_enabled, promotions_json, loyalty_json, jobs_json, ubu_balance, updated_at, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, sample_units)

    # Give existing unit-104 an initial UbuOne balance if upgrading an older DB with 0.0
    cursor.execute("UPDATE units SET ubu_balance = 645.50 WHERE id = 'unit-104' AND ubu_balance = 0.0")
    cursor.execute("UPDATE units SET tagline = 'Fresh bakery, R1 snacks, staples & UbuOne node' WHERE id = 'unit-104' AND tagline LIKE '%UbuFlow%'")

    # Seed UbuOne RBAC Staff Accounts
    sample_staff = [
        ("staff_104_owner", "unit-104", "khumalo_owner", "Baba Khumalo", "UNIT_OWNER", hash_pin("1040"), 1, now),
        ("staff_104_cashier", "unit-104", "thabo_cashier", "Thabo Maseko", "UNIT_CASHIER", hash_pin("1111"), 1, now),
        ("staff_102_owner", "unit-102", "thandi_owner", "Mama Thandi Zulu", "UNIT_OWNER", hash_pin("1020"), 1, now),
        ("staff_net_admin", None, "uniti_admin", "Zola Network Admin", "NETWORK_ADMIN", hash_pin("9999"), 1, now),
    ]
    for s in sample_staff:
        cursor.execute("""
        INSERT OR IGNORE INTO unit_staff (id, unit_id, username, full_name, role, passcode_hash, active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        """, s)

    # Seed initial UbuOne Ledger examples if empty
    cursor.execute("SELECT COUNT(*) FROM ubuone_ledger")
    if cursor.fetchone()[0] == 0:
        sample_ledger = [
            ("u1l_001", "UBU_DEPOSIT", None, None, "OPEN_PAYMENTS", "morake_ext_5", 500.00, 0.0, "1 Single Open Payments Inflow -> Family UBU Vault", "OPEN_PAYMENTS", now),
            ("u1l_002", "COUNTER_SALE", "unit-104", "thabo_cashier", "lethabomorake", "unit-104", 1.00, 0.0, "R1 Lollipop (Debited @morake_ext_5 allowance)", "FAMILY_POOL", now),
            ("u1l_003", "CHANGE_IN_UBU", "unit-104", "thabo_cashier", "unit-104", "mannini", 1.50, 0.0, "R20 cash for R18.50 bread -> 1.50 UBU change", "CASH_DRAWER", now),
            ("u1l_004", "BENEFICIARY_TRANSFER", None, None, "azaria", "lerato", 50.00, 0.0, "Zero-fee UBU allocation to Girlfriend (@lerato)", "PERSONAL_UBU", now),
        ]
        cursor.executemany("""
        INSERT INTO ubuone_ledger (
            id, event_type, unit_id, staff_username, from_username, to_username,
            amount_ubu, fee_zar, description, source_bucket, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, sample_ledger)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("UbuOne x SpazaUniti database initialized at:", DB_PATH)
