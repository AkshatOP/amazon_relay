"""Seed the `catalog` table — maps ASIN → reference (catalog) image, for auto-grading.

On return, the grading agent auto-loads the reference image for the order's ASIN (see
backend/grading/catalog.py). Each row points at a file under backend/catalog_images/
(named <asin>.jpg by convention) OR an https URL.

Drop the studio/catalog photos into backend/catalog_images/ using the filenames below.
A row with a missing file still works — grading just runs reference-less for that item.

Run: python -m backend.seed.seed_catalog
"""
from __future__ import annotations

from backend.core import db as core_db
from backend.core.config import DB_PATH

DDL = """
CREATE TABLE IF NOT EXISTS catalog (
    asin                 TEXT PRIMARY KEY,
    title                TEXT,
    category             TEXT,
    reference_image_path TEXT   -- bare <asin>.jpg (resolved under catalog_images/) OR an https URL
);
"""

# asin, title, category, reference_image_path (filename under backend/catalog_images/)
CATALOG = [
    ("B0SH_UDUPI_NICHE", "Niche Artisan Shoes",                 "shoes",        "B0SH_UDUPI_NICHE.jpg"),
    ("B0BABY_MON_01",    "Samsung SmartThings Baby Monitor Pro", "baby_monitor", "B0BABY_MON_01.jpg"),
    ("B0BP001",          "Skybags Laptop Backpack",              "backpack",     "B0BP001.jpg"),
    ("B0WT001",          "Analog Wrist Watch",                   "watch",        "B0WT001.jpg"),
    ("B0FW001",          "Running Shoes Pro",                    "footwear",     "B0FW001.jpg"),
    ("B0SH001",          "Leather Formal Shoes",                 "shoes",        "B0SH001.jpg"),
    ("B0PB001",          "Power Bank (20000mAh)",                "power_bank",   "B0PB001.jpg"),
    ("B0PC001",          "Silicone Phone Case",                  "phonecase",    "B0PC001.jpg"),
]


def seed():
    conn = core_db.get_connection(row_factory=False)
    conn.executescript(DDL)
    conn.execute("DELETE FROM catalog")
    conn.executemany(
        "INSERT INTO catalog (asin, title, category, reference_image_path) VALUES (?,?,?,?)",
        CATALOG,
    )
    conn.commit()
    conn.close()
    print(f"Seeded catalog ({len(CATALOG)} products) in {DB_PATH}")
    print("Drop reference photos into backend/catalog_images/ as:")
    for asin, title, _cat, fn in CATALOG:
        print(f"  {fn:28s} → {title}")


if __name__ == "__main__":
    seed()
