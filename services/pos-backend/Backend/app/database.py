import sqlite3
import os
from typing import List, Dict, Any, Optional

DB_PATH = os.environ.get("SPAZA_DB_PATH", os.path.join(os.path.dirname(__file__), "..", "spazakhokha.db"))

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes SQLite schema for SpazaKhokha and Spaza Uniti node."""
    conn = get_db()
    cursor = conn.cursor()

    # Units (Nodes in Spaza Uniti)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS units (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        township TEXT NOT NULL,
        wallet_address TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Customers (Township shoppers with credit tabs)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        unit_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        credit_limit REAL DEFAULT 350.00,
        balance REAL DEFAULT 0.00,
        stamps INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (unit_id) REFERENCES units (id)
    );
    """)

    # Purchases (Tab purchases)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers (id)
    );
    """)

    # Repayments (Settlements against tabs)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS repayments (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        amount REAL NOT NULL,
        method TEXT NOT NULL,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers (id)
    );
    """)

    # Transactions Audit Log
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        details TEXT NOT NULL,
        amount REAL NOT NULL,
        method TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Spaza Uniti Offerings (Promotions & Discounts)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS promotions (
        id TEXT PRIMARY KEY,
        unit_id TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        original_price REAL NOT NULL,
        promo_price REAL NOT NULL,
        discount_pct INTEGER NOT NULL,
        days_left INTEGER NOT NULL,
        active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (unit_id) REFERENCES units (id)
    );
    """)

    # Loyalty Programs (Declarative Ubuntu Token Community Contracts)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS loyalty_programs (
        id TEXT PRIMARY KEY,
        unit_id TEXT NOT NULL,
        title TEXT NOT NULL,
        program_type TEXT NOT NULL,
        community_pact TEXT NOT NULL,
        target_item TEXT DEFAULT 'Albany Superior White Bread',
        item_price_zar REAL DEFAULT 16.00,
        reward_threshold_ubu REAL DEFAULT 16.00,
        token_rate_per_event REAL DEFAULT 1.78,
        stamps_or_count INTEGER DEFAULT 9,
        stamps_required INTEGER DEFAULT 9,
        reward_description TEXT NOT NULL,
        active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (unit_id) REFERENCES units (id)
    );
    """)

    # Dynamic migrations for loyalty_programs columns
    cursor.execute("PRAGMA table_info(loyalty_programs)")
    existing_cols = [row[1] for row in cursor.fetchall()]
    new_cols = [
        ("community_pact", "TEXT DEFAULT 'Buy 9 loaves of Albany bread, get the 10th loaf FREE!'"),
        ("target_item", "TEXT DEFAULT 'Albany Superior White Bread'"),
        ("item_price_zar", "REAL DEFAULT 16.00"),
        ("reward_threshold_ubu", "REAL DEFAULT 16.00"),
        ("token_rate_per_event", "REAL DEFAULT 1.78"),
        ("stamps_or_count", "INTEGER DEFAULT 9"),
        ("created_at", "TEXT DEFAULT ''")
    ]
    for col_name, col_def in new_cols:
        if col_name not in existing_cols:
            cursor.execute(f"ALTER TABLE loyalty_programs ADD COLUMN {col_name} {col_def}")

    # Ensure customers has ubuntu_tokens
    cursor.execute("PRAGMA table_info(customers)")
    cust_cols = [row[1] for row in cursor.fetchall()]
    if "ubuntu_tokens" not in cust_cols:
        cursor.execute("ALTER TABLE customers ADD COLUMN ubuntu_tokens REAL DEFAULT 0.0")

    # Seed default data if empty
    cursor.execute("SELECT COUNT(*) FROM units")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO units (id, name, owner_name, phone_number, township, wallet_address)
        VALUES ('unit-104', 'Mama Zola Spaza', 'Zola Mthethwa', '+27821234567', 'Meadowlands Zone 2, Soweto', '$ilp.rafiki.money/unit-104');
        """)

        cursor.executemany("""
        INSERT INTO customers (id, unit_id, name, phone, credit_limit, balance, stamps, ubuntu_tokens, notes)
        VALUES (?, 'unit-104', ?, ?, ?, ?, ?, ?, ?);
        """, [
            ('CUST-001', 'Sipho Dlamini', '082 555 1234', 400.0, 84.0, 6, 12.0, 'Zone 2, reliable neighbor'),
            ('CUST-002', 'Mama Thandi', '071 888 4321', 600.0, 0.0, 9, 18.0, 'School teacher, settles monthly'),
            ('CUST-003', 'Bongani Sithole', '083 444 9876', 300.0, 45.0, 3, 6.0, 'Taxi rank vendor')
        ])

        cursor.executemany("""
        INSERT INTO purchases (id, customer_id, customer_name, description, amount)
        VALUES (?, ?, ?, ?, ?);
        """, [
            ('PUR-1', 'CUST-001', 'Sipho Dlamini', '2 Albany Brown, 2L Stoney Ginger Beer', 54.0),
            ('PUR-2', 'CUST-003', 'Bongani Sithole', '5kg White Star Maize Meal, 1 Sunlight Soap', 45.0)
        ])

        cursor.execute("""
        INSERT INTO repayments (id, customer_id, customer_name, amount, method, note)
        VALUES ('RP-0001', 'CUST-002', 'Mama Thandi', 50.0, 'Cash', 'Cleared outstanding grocery tab');
        """)

        cursor.executemany("""
        INSERT INTO transactions (id, type, customer_name, details, amount, method, source)
        VALUES (?, ?, ?, ?, ?, ?, ?);
        """, [
            ('TXN-101', 'purchase', 'Sipho Dlamini', '2 Albany Brown, 2L Stoney Ginger Beer', 54.0, 'Credit Tab', 'Counter Voice'),
            ('TXN-102', 'purchase', 'Bongani Sithole', '5kg White Star Maize Meal, 1 Sunlight Soap', 45.0, 'Credit Tab', 'Counter UI'),
            ('TXN-100', 'repayment', 'Mama Thandi', 'Cleared grocery tab', 50.0, 'Cash', 'Counter POS')
        ])

        cursor.executemany("""
        INSERT INTO promotions (id, unit_id, title, category, original_price, promo_price, discount_pct, days_left, active)
        VALUES (?, 'unit-104', ?, ?, ?, ?, ?, ?, 1);
        """, [
            ('PROMO-001', 'Weekend Albany Superior White Special', 'Bakery', 19.50, 16.00, 18, 2),
            ('PROMO-002', 'Golden Cloud Cake Flour 2.5kg', 'Staples', 42.00, 35.00, 16, 4)
        ])

    # Seed multiple community loyalty programs if count < 2
    cursor.execute("SELECT COUNT(*) FROM loyalty_programs WHERE unit_id = 'unit-104'")
    if cursor.fetchone()[0] < 2:
        cursor.execute("DELETE FROM loyalty_programs WHERE unit_id = 'unit-104'")
        cursor.executemany("""
        INSERT INTO loyalty_programs (id, unit_id, title, program_type, community_pact, target_item, item_price_zar, reward_threshold_ubu, token_rate_per_event, stamps_or_count, stamps_required, reward_description, active)
        VALUES (?, 'unit-104', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1);
        """, [
            ('LOYALTY-001', 'Daily Bread Stamp Club', 'STAPLE_ACCUMULATOR', 
             'Buy 9 loaves of Albany bread, get the 10th loaf FREE! Tracked automatically as Ubuntu Tokens.', 
             'Albany Superior White Bread', 16.00, 16.00, 1.78, 9, 9, 
             'Buy 9 loaves of Albany bread, get the 10th loaf FREE! (16.00 UBU Reward)'),
            ('LOYALTY-002', 'SASSA Pensioner Goodwill Perk', 'PENSIONER_SASSA_PERK', 
             'Every pensioner shopping on SASSA payout day receives 15.00 Ubuntu Tokens for a free 500g sugar pack or tea.', 
             '500g Sugar Pack or Glen Tea', 15.00, 15.00, 15.00, 1, 1, 
             'Free 500g sugar pack or tea on pension payout days (15.00 UBU)'),
            ('LOYALTY-003', 'Tab Settlement Hero', 'TAB_REPAYMENT_BONUS', 
             'Settle your outstanding credit tab within 7 days, get 10.00 Ubuntu Tokens (R10 airtime allowance on the house).', 
             'Vodacom / MTN R10 Airtime Voucher', 10.00, 10.00, 10.00, 1, 1, 
             'R10 Airtime grant for prompt tab settlement (10.00 UBU)')
        ])


    # Store Settings (including Spaza Uniti broadcast toggle)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS store_settings (
        id TEXT PRIMARY KEY,
        unit_id TEXT NOT NULL,
        store_name TEXT NOT NULL,
        broadcast_to_uniti BOOLEAN DEFAULT 1,
        uniti_backend_url TEXT DEFAULT 'http://localhost:8001',
        status TEXT DEFAULT 'OPEN',
        operating_hours TEXT DEFAULT '06:30 - 20:00 Daily',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("SELECT COUNT(*) FROM store_settings WHERE id = 'default'")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO store_settings (id, unit_id, store_name, broadcast_to_uniti, uniti_backend_url, status, operating_hours)
        VALUES ('default', 'unit-104', 'Mama Zola Spaza', 1, 'http://localhost:8001', 'OPEN', '06:30 - 20:00 Daily');
        """)

    conn.commit()
    conn.close()
