"""Seed the p2p tables (users, purchases, listings, p2p_demand, transactions) into relay.db.

Demo scenario:
  - User: Priya Shetty (Udupi), has a baby monitor (₹6,000) purchased today
  - simulate_years=2.0 → age_factor=1.0 (peak window), grade B → ₹3,900 + ₹360 warranty = ₹4,260
  - Demand: a known buyer in Manipal (~7 km away)

Run: python -m backend.seed.seed_p2p
"""
from __future__ import annotations

import datetime

from backend.core import db as core_db
from backend.core.config import DB_PATH


DDL = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    region TEXT DEFAULT 'udupi',
    pincode TEXT,
    lat REAL,
    lng REAL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    asin TEXT,
    original_price REAL NOT NULL,
    purchase_date TEXT NOT NULL,
    warranty_total_years REAL DEFAULT 0.0,
    has_original_bill INTEGER DEFAULT 1,
    has_original_box INTEGER DEFAULT 0,
    region TEXT DEFAULT 'udupi',
    station_id TEXT DEFAULT 'UDUPI_CITY',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER REFERENCES purchases(id),
    seller_id INTEGER REFERENCES users(id),
    category TEXT NOT NULL,
    item_name TEXT NOT NULL,
    original_price REAL NOT NULL,
    grade TEXT NOT NULL,
    condition_score INTEGER,
    defects TEXT DEFAULT '',
    asking_price REAL NOT NULL,
    station_id TEXT DEFAULT 'UDUPI_CITY',
    region TEXT DEFAULT 'udupi',
    has_original_bill INTEGER DEFAULT 1,
    has_original_box INTEGER DEFAULT 0,
    warranty_total_years REAL DEFAULT 0.0,
    age_years REAL,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS p2p_demand (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_name TEXT NOT NULL,
    category TEXT NOT NULL,
    region TEXT DEFAULT 'udupi',
    pincode TEXT,
    lat REAL,
    lng REAL,
    max_budget REAL,
    status TEXT DEFAULT 'looking',
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER REFERENCES listings(id),
    demand_id INTEGER REFERENCES p2p_demand(id),
    asking_price REAL,
    platform_fee REAL,
    seller_payout REAL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
);
"""

USERS = [
    # id, name, email, phone, region, pincode, lat, lng
    (1, "Priya Shetty",   "priya.shetty@example.com",   "+91-9900001234",
     "udupi", "576101", 13.3409, 74.7421),
    (2, "Ravi Nayak",     "ravi.nayak@example.com",     "+91-9900005678",
     "udupi", "576104", 13.3502, 74.7876),
    (3, "Sudha Kamath",   "sudha.kamath@example.com",   "+91-9900009012",
     "udupi", "576103", 13.3600, 74.7073),
]

TODAY = datetime.date.today().isoformat()

PURCHASES = [
    # id, user_id, item_name, category, asin, original_price, purchase_date,
    # warranty_total_years, has_original_bill, has_original_box, region, station_id
    (1, 1, "Samsung SmartThings Baby Monitor Pro",
     "baby_monitor", "B0BABY_MON_01",
     6000.0, TODAY, 5.0, 1, 1, "udupi", "UDUPI_CITY"),
    (2, 2, "Nike Air Max Shoes",
     "shoes", "B0SH_UDUPI_NICHE",
     1800.0, TODAY, 1.0, 1, 0, "udupi", "MANIPAL"),
]

# Pre-seed one known buyer for the demo scenario
DEMAND = [
    # buyer_name, category, region, pincode, lat, lng, max_budget, status, note
    ("Ravi Nayak (Manipal)",
     "baby_monitor", "udupi", "576104", 13.3502, 74.7876,
     4500.0, "looking",
     "Looking for a baby monitor for new baby — budget up to ₹4,500"),
]


def seed():
    conn = core_db.get_connection(row_factory=False)
    conn.executescript(DDL)
    conn.commit()

    conn.execute("DELETE FROM transactions")
    conn.execute("DELETE FROM p2p_demand")
    conn.execute("DELETE FROM listings")
    conn.execute("DELETE FROM purchases")
    conn.execute("DELETE FROM users")
    conn.commit()

    conn.executemany("""
        INSERT INTO users (id, name, email, phone, region, pincode, lat, lng)
        VALUES (?,?,?,?,?,?,?,?)
    """, USERS)

    conn.executemany("""
        INSERT INTO purchases
          (id, user_id, item_name, category, asin, original_price, purchase_date,
           warranty_total_years, has_original_bill, has_original_box, region, station_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    """, PURCHASES)

    conn.executemany("""
        INSERT INTO p2p_demand
          (buyer_name, category, region, pincode, lat, lng, max_budget, status, note)
        VALUES (?,?,?,?,?,?,?,?,?)
    """, DEMAND)

    conn.commit()
    conn.close()
    print(f"Seeded P2P tables in {DB_PATH}")
    print(f"  {len(USERS)} users, {len(PURCHASES)} purchases, {len(DEMAND)} demand rows")


if __name__ == "__main__":
    seed()
