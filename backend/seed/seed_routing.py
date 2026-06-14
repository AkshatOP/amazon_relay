"""Seed the routing tables (pending_orders, ngos, returns_log) into the consolidated relay.db.

Deterministic (fixed RNG seed) so the demo is reproducible.

Regions:
  bengaluru — buyers scattered around the 8 RCC pincodes.
  udupi     — buyers scattered around 576xxx pincodes + TWO precise demo scenarios:

    Scenario A (HERO): niche shoe, grade A, Udupi City pickup, Manipal buyer ~6 km away.
                       Expected: RESELL_LOCAL (hard gate fires).
    Scenario B (CONTRAST): same shoe, grade D, Kundapura pickup, NO local buyer seeded.
                            Expected: DONATE or LIQUIDATE (hard gate 1: grade D).

Run: python -m backend.seed.seed_routing
"""
from __future__ import annotations

import random
import sqlite3
from datetime import date, timedelta

from backend.core import db as core_db
from backend.core.config import DB_PATH
from backend.routing.seed_locations import REGIONS

# ── ASIN pools ───────────────────────────────────────────────────────────────

ASIN_POOL_BENGALURU = {
    "footwear":  [("B0FW001", "Running Shoes Pro"), ("B0FW002", "Canvas Sneakers")],
    "shoes":     [("B0SH001", "Leather Formal Shoes"), ("B0SH002", "Trail Runners")],
    "watch":     [("B0WT001", "Analog Wrist Watch"), ("B0WT002", "Digital Sports Watch")],
    "phonecase": [("B0PC001", "Silicone Phone Case")],
    "toy":       [("B0TY001", "Building Blocks Set"), ("B0TY002", "RC Car")],
    "book":      [("B0BK001", "Bestseller Novel")],
    "backpack":  [("B0BP001", "Skybags Laptop Backpack"), ("B0BP002", "Trekking Rucksack")],
    "bag":       [("B0BG001", "Tote Handbag"), ("B0BG002", "Sling Crossbody Bag")],
}

# Niche shoe ASIN shared between Scenario A's buyer row and the demo input.
UDUPI_NICHE_SHOE_ASIN = "B0SH_UDUPI_NICHE"

ASIN_POOL_UDUPI = {
    "footwear":  [("B0FW_U001", "Rubber Slippers"), ("B0FW_U002", "Kolhapuri Chappals")],
    "shoes":     [(UDUPI_NICHE_SHOE_ASIN, "Niche Artisan Shoes"), ("B0SH_U002", "Canvas School Shoes")],
    "phonecase": [("B0PC_U001", "Tempered Glass + Case Combo")],
    "toy":       [("B0TY_U001", "Wooden Educational Toy"), ("B0TY_U002", "Puzzle Set")],
    "book":      [("B0BK_U001", "Tulu Cultural Heritage"), ("B0BK_U002", "Kannada Novel")],
    "backpack":  [("B0BP_U001", "School Backpack")],
    "bag":       [("B0BG_U001", "Jute Tote Bag")],
}

# How many generic pending buyers to plant per category for Bengaluru.
BUYERS_PER_CATEGORY_BLR = {
    "footwear": 4, "shoes": 3, "watch": 4, "phonecase": 1,
    "toy": 3, "book": 1, "backpack": 4, "bag": 3,
}

# ── NGO lists ────────────────────────────────────────────────────────────────

NGOS_BENGALURU = [
    {"name": "Goonj Bengaluru",         "pincode": "560029", "lat": 12.9166, "lng": 77.6101,
     "accepted_categories": "footwear,shoes,bag,backpack,toy,book", "region": "bengaluru"},
    {"name": "Akshaya Patra Donations", "pincode": "560010", "lat": 12.9911, "lng": 77.5526,
     "accepted_categories": "toy,book,bag", "region": "bengaluru"},
    {"name": "Saanidhya Foundation",    "pincode": "560076", "lat": 12.8911, "lng": 77.5970,
     "accepted_categories": "footwear,shoes,watch,phonecase", "region": "bengaluru"},
    {"name": "Vidya Seva Trust",        "pincode": "560008", "lat": 12.9784, "lng": 77.6408,
     "accepted_categories": "book,toy,backpack", "region": "bengaluru"},
    {"name": "GreenLoop Recyclers",     "pincode": "560026", "lat": 12.9456, "lng": 77.5236,
     "accepted_categories": "footwear,shoes,bag,backpack,phonecase,watch,toy,book", "region": "bengaluru"},
]

NGOS_UDUPI = [
    # Manipal-area charity — student/community welfare
    {"name": "Manipal Samrakshana Trust",  "pincode": "576104", "lat": 13.3501, "lng": 74.7883,
     "accepted_categories": "footwear,shoes,bag,backpack,toy,book", "region": "udupi"},
    # Kundapura school — rural education focus
    {"name": "Kundapura Vidya Vikasa",     "pincode": "576201", "lat": 13.6275, "lng": 74.6935,
     "accepted_categories": "book,toy,backpack,bag", "region": "udupi"},
    # Udupi temple trust — community distribution
    {"name": "Udupi Sri Krishna Seva Dal", "pincode": "576101", "lat": 13.3421, "lng": 74.7450,
     "accepted_categories": "footwear,shoes,bag,toy,book", "region": "udupi"},
]


# ── Schema ───────────────────────────────────────────────────────────────────

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
            ordered_date  TEXT NOT NULL,
            region        TEXT NOT NULL DEFAULT 'bengaluru'
        );

        CREATE TABLE ngos (
            name                TEXT PRIMARY KEY,
            pincode             TEXT NOT NULL,
            lat                 REAL NOT NULL,
            lng                 REAL NOT NULL,
            accepted_categories TEXT NOT NULL,
            region              TEXT NOT NULL DEFAULT 'bengaluru'
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


# ── Seed helpers ─────────────────────────────────────────────────────────────

def _seed_bengaluru(rng: random.Random, today: date) -> list[tuple]:
    nodes = REGIONS["bengaluru"]["nodes"]
    rows = []
    order_n = 0
    for category, count in BUYERS_PER_CATEGORY_BLR.items():
        for _ in range(count):
            order_n += 1
            asin, pname = rng.choice(ASIN_POOL_BENGALURU[category])
            node = rng.choice(nodes)
            # Jitter ~2-3 km around the RCC centroid
            blat = node["lat"] + rng.uniform(-0.02, 0.02)
            blng = node["lng"] + rng.uniform(-0.02, 0.02)
            ordered = today - timedelta(days=rng.randint(1, 13))
            rows.append((
                f"BLR{order_n:04d}", asin, pname, category,
                round(blat, 5), round(blng, 5), node["pincode"],
                ordered.isoformat(), "bengaluru",
            ))
    return rows


def _seed_udupi(rng: random.Random, today: date) -> list[tuple]:
    """~15 Udupi orders including the two precise demo scenario rows.

    Scenario A buyer: shoes / B0SH_UDUPI_NICHE / Manipal (576104) — within ~6 km of
    Udupi City station. This buyer MUST be seeded for Scenario A (RESELL_LOCAL) to fire.

    Scenario B: pickup is Kundapura. NO buyers are seeded in or near Kundapura so that
    nearby_demand=0, and grade-D causes Gate 1 → DONATE/LIQUIDATE.
    """
    rows: list[tuple] = []

    # ── Scenario A buyer (PRECISE — do not jitter) ────────────────────────────
    rows.append((
        "UORD_DEMO_A", UDUPI_NICHE_SHOE_ASIN, "Niche Artisan Shoes", "shoes",
        13.3502, 74.7876, "576104",
        (today - timedelta(days=3)).isoformat(), "udupi",
    ))

    # ── Generic Udupi buyers (~14 more, spread across Udupi/Malpe/Brahmavar pincodes) ─
    # Deliberately EXCLUDE any buyers near Kundapura (576201) so Scenario B has no match.
    udupi_generic: list[dict] = [
        {"cat": "shoes",     "asin": "B0SH_U002",  "name": "Canvas School Shoes",
         "lat": 13.3421, "lng": 74.7435, "pin": "576101"},
        {"cat": "footwear",  "asin": "B0FW_U001",  "name": "Rubber Slippers",
         "lat": 13.3398, "lng": 74.7401, "pin": "576101"},
        {"cat": "footwear",  "asin": "B0FW_U002",  "name": "Kolhapuri Chappals",
         "lat": 13.3511, "lng": 74.7052, "pin": "576103"},
        {"cat": "phonecase", "asin": "B0PC_U001",  "name": "Tempered Glass + Case Combo",
         "lat": 13.3415, "lng": 74.7453, "pin": "576101"},
        {"cat": "toy",       "asin": "B0TY_U001",  "name": "Wooden Educational Toy",
         "lat": 13.3480, "lng": 74.7858, "pin": "576104"},
        {"cat": "toy",       "asin": "B0TY_U002",  "name": "Puzzle Set",
         "lat": 13.4271, "lng": 74.7449, "pin": "576213"},
        {"cat": "book",      "asin": "B0BK_U001",  "name": "Tulu Cultural Heritage",
         "lat": 13.3402, "lng": 74.7438, "pin": "576101"},
        {"cat": "book",      "asin": "B0BK_U002",  "name": "Kannada Novel",
         "lat": 13.3495, "lng": 74.7880, "pin": "576104"},
        {"cat": "backpack",  "asin": "B0BP_U001",  "name": "School Backpack",
         "lat": 13.3500, "lng": 74.7031, "pin": "576103"},
        {"cat": "bag",       "asin": "B0BG_U001",  "name": "Jute Tote Bag",
         "lat": 13.4285, "lng": 74.7462, "pin": "576213"},
        {"cat": "shoes",     "asin": UDUPI_NICHE_SHOE_ASIN, "name": "Niche Artisan Shoes",
         "lat": 13.4268, "lng": 74.7471, "pin": "576213"},
        {"cat": "footwear",  "asin": "B0FW_U001",  "name": "Rubber Slippers",
         "lat": 13.2172, "lng": 74.9941, "pin": "574104"},
        {"cat": "phonecase", "asin": "B0PC_U001",  "name": "Tempered Glass + Case Combo",
         "lat": 13.3487, "lng": 74.7862, "pin": "576104"},
        {"cat": "watch",     "asin": "B0WT001",    "name": "Analog Wrist Watch",
         "lat": 13.3431, "lng": 74.7448, "pin": "576101"},
    ]

    for i, g in enumerate(udupi_generic, start=1):
        jitter_days = rng.randint(1, 9)
        rows.append((
            f"UORD{i:04d}", g["asin"], g["name"], g["cat"],
            round(g["lat"] + rng.uniform(-0.003, 0.003), 5),
            round(g["lng"] + rng.uniform(-0.003, 0.003), 5),
            g["pin"], (today - timedelta(days=jitter_days)).isoformat(), "udupi",
        ))

    return rows


# ── Main seed function ────────────────────────────────────────────────────────

def seed() -> None:
    rng = random.Random(42)  # fixed seed → reproducible
    today = date(2026, 6, 14)

    conn = core_db.get_connection(row_factory=False)
    cur = conn.cursor()
    _schema(cur)

    blr_rows = _seed_bengaluru(rng, today)
    udupi_rows = _seed_udupi(rng, today)
    all_rows = blr_rows + udupi_rows

    cur.executemany(
        "INSERT INTO pending_orders "
        "(order_id, asin, product_name, category, buyer_lat, buyer_lng, buyer_pincode, ordered_date, region) "
        "VALUES (?,?,?,?,?,?,?,?,?)",
        all_rows,
    )

    all_ngos = NGOS_BENGALURU + NGOS_UDUPI
    cur.executemany(
        "INSERT INTO ngos (name, pincode, lat, lng, accepted_categories, region) VALUES (?,?,?,?,?,?)",
        [(n["name"], n["pincode"], n["lat"], n["lng"], n["accepted_categories"], n["region"])
         for n in all_ngos],
    )

    conn.commit()
    conn.close()

    # ── Row counts by region ──────────────────────────────────────────────────
    conn2 = core_db.get_connection(row_factory=False)
    for region in ("bengaluru", "udupi"):
        n = conn2.execute(
            "SELECT COUNT(*) FROM pending_orders WHERE region = ?", (region,)
        ).fetchone()[0]
        print(f"  pending_orders [{region}]: {n} rows")
    print(f"  pending_orders [total]: {conn2.execute('SELECT COUNT(*) FROM pending_orders').fetchone()[0]}")
    print(f"  ngos [total]: {conn2.execute('SELECT COUNT(*) FROM ngos').fetchone()[0]}")
    conn2.close()
    print(f"  DB written to: {DB_PATH}")
    print()
    print("Udupi demo scenario buyer check:")
    conn3 = core_db.get_connection(row_factory=False)
    demo_a = conn3.execute(
        "SELECT order_id, buyer_lat, buyer_lng, buyer_pincode FROM pending_orders WHERE order_id = 'UORD_DEMO_A'"
    ).fetchone()
    print(f"  Scenario A buyer: {demo_a}")
    kundapura_buyers = conn3.execute(
        "SELECT COUNT(*) FROM pending_orders WHERE region='udupi' AND buyer_pincode='576201'"
    ).fetchone()[0]
    print(f"  Kundapura buyers (576201, must be 0 for Scenario B): {kundapura_buyers}")
    conn3.close()


if __name__ == "__main__":
    seed()
