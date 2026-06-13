"""Build routing/db/relay_routing.db — the demo's local-demand pool, NGOs, and decision log.

Deterministic (fixed RNG seed) so the demo is reproducible. Buyers are scattered around the
Bengaluru RCC pincodes so that some returns find a nearby buyer (RESELL_LOCAL) and some don't.

Run: python -m routing.db.seed_db
"""
from __future__ import annotations

import random
import sqlite3
from datetime import date, timedelta

from ..config import DB_PATH
from ..seed_locations import RCCS

# ASIN pool per category so "same category/asin" demand matching has something to hit.
ASIN_POOL = {
    "footwear":  [("B0FW001", "Running Shoes Pro"), ("B0FW002", "Canvas Sneakers")],
    "shoes":     [("B0SH001", "Leather Formal Shoes"), ("B0SH002", "Trail Runners")],
    "watch":     [("B0WT001", "Analog Wrist Watch"), ("B0WT002", "Digital Sports Watch")],
    "phonecase": [("B0PC001", "Silicone Phone Case")],
    "toy":       [("B0TY001", "Building Blocks Set"), ("B0TY002", "RC Car")],
    "book":      [("B0BK001", "Bestseller Novel")],
    "backpack":  [("B0BP001", "Skybags Laptop Backpack"), ("B0BP002", "Trekking Rucksack")],
    "bag":       [("B0BG001", "Tote Handbag"), ("B0BG002", "Sling Crossbody Bag")],
}

# How many pending buyers to plant per category (popular categories get more so they match;
# book/phonecase get few/none so the demo also shows "no local buyer -> not RESELL_LOCAL").
BUYERS_PER_CATEGORY = {
    "footwear": 4, "shoes": 3, "watch": 4, "phonecase": 1,
    "toy": 3, "book": 1, "backpack": 4, "bag": 3,
}

NGOS = [
    {"name": "Goonj Bengaluru",        "pincode": "560029", "lat": 12.9166, "lng": 77.6101,
     "accepted_categories": "footwear,shoes,bag,backpack,toy,book"},
    {"name": "Akshaya Patra Donations","pincode": "560010", "lat": 12.9911, "lng": 77.5526,
     "accepted_categories": "toy,book,bag"},
    {"name": "Saanidhya Foundation",   "pincode": "560076", "lat": 12.8911, "lng": 77.5970,
     "accepted_categories": "footwear,shoes,watch,phonecase"},
    {"name": "Vidya Seva Trust",       "pincode": "560008", "lat": 12.9784, "lng": 77.6408,
     "accepted_categories": "book,toy,backpack"},
    {"name": "GreenLoop Recyclers",    "pincode": "560026", "lat": 12.9456, "lng": 77.5236,
     "accepted_categories": "footwear,shoes,bag,backpack,phonecase,watch,toy,book"},
]


def _schema(cur: sqlite3.Cursor) -> None:
    cur.executescript(
        """
        DROP TABLE IF EXISTS pending_orders;
        DROP TABLE IF EXISTS ngos;
        DROP TABLE IF EXISTS returns_log;

        CREATE TABLE pending_orders (
            order_id      TEXT PRIMARY KEY,
            asin          TEXT NOT NULL,
            product_name  TEXT NOT NULL,
            category      TEXT NOT NULL,
            buyer_lat     REAL NOT NULL,
            buyer_lng     REAL NOT NULL,
            buyer_pincode TEXT NOT NULL,
            ordered_date  TEXT NOT NULL
        );

        CREATE TABLE ngos (
            name                TEXT PRIMARY KEY,
            pincode             TEXT NOT NULL,
            lat                 REAL NOT NULL,
            lng                 REAL NOT NULL,
            accepted_categories TEXT NOT NULL
        );

        CREATE TABLE returns_log (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            ts            TEXT NOT NULL,
            order_id      TEXT,
            asin          TEXT,
            category      TEXT,
            grade         TEXT,
            decision      TEXT,
            decided_by    TEXT,
            resale_price  REAL,
            savings_local REAL,
            co2_saved_kg  REAL,
            buyer_found   INTEGER
        );
        """
    )


def seed() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    rng = random.Random(42)  # deterministic
    today = date(2026, 6, 13)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    _schema(cur)

    order_n = 0
    rows = []
    for category, count in BUYERS_PER_CATEGORY.items():
        for _ in range(count):
            order_n += 1
            asin, pname = rng.choice(ASIN_POOL[category])
            rcc = rng.choice(RCCS)  # plant the buyer near some RCC
            # jitter ~ up to ~2-3 km around the RCC centroid
            blat = rcc["lat"] + rng.uniform(-0.02, 0.02)
            blng = rcc["lng"] + rng.uniform(-0.02, 0.02)
            ordered = today - timedelta(days=rng.randint(1, 13))
            rows.append((
                f"ORD{order_n:04d}", asin, pname, category,
                round(blat, 5), round(blng, 5), rcc["pincode"], ordered.isoformat(),
            ))

    cur.executemany(
        "INSERT INTO pending_orders "
        "(order_id, asin, product_name, category, buyer_lat, buyer_lng, buyer_pincode, ordered_date) "
        "VALUES (?,?,?,?,?,?,?,?)",
        rows,
    )

    cur.executemany(
        "INSERT INTO ngos (name, pincode, lat, lng, accepted_categories) VALUES (?,?,?,?,?)",
        [(n["name"], n["pincode"], n["lat"], n["lng"], n["accepted_categories"]) for n in NGOS],
    )

    conn.commit()
    print(f"Seeded {len(rows)} pending_orders, {len(NGOS)} ngos, empty returns_log -> {DB_PATH}")
    conn.close()


if __name__ == "__main__":
    seed()
