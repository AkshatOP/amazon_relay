# Seeding — `backend/data/relay.db`

Everything lives in ONE SQLite file: `backend/data/relay.db` (generated, **gitignored**).
All seeders and all app reads go through `backend/core/db.py`, which resolves to that path.

## Commands

```bash
python -m backend.seed.seed_all       # routing + p2p + catalog → a fresh, complete db (use this)
python -m backend.seed.seed_routing   # routing tables only
python -m backend.seed.seed_p2p       # p2p tables only
python -m backend.seed.seed_catalog   # catalog table only (asin → reference image)
```

**Wipe & rebuild from scratch:**
```bash
rm -f backend/data/relay.db && python -m backend.seed.seed_all
```
(`seed_routing` also drops+recreates its 3 tables every run; `seed_p2p` clears+refills its
tables every run — so re-running is always safe and reproducible.)

## Tables

### Routing (`seed_routing.py`)
| Table | What it is |
|-------|-----------|
| `pending_orders` | The local-demand pool — buyers who already ordered an item, used to detect a nearby buyer for a return. Columns: `order_id, asin, product_name, category, buyer_lat, buyer_lng, buyer_pincode, ordered_date, region`. 23 Bengaluru rows + 15 Udupi rows. |
| `ngos` | Donation partners per region. Columns: `name, pincode, lat, lng, accepted_categories, region`. 5 Bengaluru + 3 Udupi. |
| `returns_log` | Append-only decision log written by `POST /route`. Columns: `ts, order_id, asin, category, grade, decision, decided_by, resale_price, savings_local, co2_saved_kg, buyer_found`. Starts empty. |

### P2P (`seed_p2p.py`)
| Table | What it is |
|-------|-----------|
| `users` | Sellers/buyers. 3 Udupi users (Priya, Ravi, Sudha). |
| `purchases` | Items a user owns (the nudge source). Columns include `original_price, purchase_date, warranty_total_years, has_original_bill, region, station_id`. 2 rows: a ₹6,000 baby monitor, a ₹1,800 shoe. |
| `listings` | Created at runtime by `POST /p2p/list` (Stage-2 price + Health Card). Starts empty. |
| `p2p_demand` | Buyers looking for an item. 1 pre-seeded baby-monitor buyer in Manipal. `generate_demand()` adds synthetic rows on demand. |
| `transactions` | Reserved for completed handoffs. Starts empty. |

### Catalog (`seed_catalog.py`)
| Table | What it is |
|-------|-----------|
| `catalog` | Maps `asin → title, category, reference_image_path` — the good-product (catalog) photo used as grading reference and shown on UI product cards. 8 demo products. The image file lives at `backend/catalog_images/<asin>.jpg` (gitignored — drop it in by hand) or an https URL. A missing file is fine: grading runs reference-less. See `backend/catalog_images/README.md` for the exact filenames. |

Tables coexist in one file; the routing, p2p, and catalog tables are disjoint by name.

## Reproducible demo numbers

The full click-paths + expected outputs are kept alongside this file:
- **Routing (Udupi Scenarios A & B):** [`README_udupi_demo.md`](README_udupi_demo.md)
- **P2P (Priya's baby monitor):** [`README_p2p_demo.md`](README_p2p_demo.md)

Quick checks after `seed_all`:
- Routing Scenario A → `POST /route` grade-A niche shoe at Udupi City → **RESELL_LOCAL**
  (hard_gate), buyer ~2.2 km, FC 448.54 km, savings **₹59.82**.
- P2P → `GET /p2p/nudge/1?simulate_years=2.0` → in-window, Stage-1 **₹2,760**; then
  `POST /p2p/list` grade B → Stage-2 **₹4,260** (price went up); handoff payout **₹4,047**.

## Adding data

**A new routing region:** add a region block to `backend/routing/seed_locations.py`
(`nodes`, `fcs`/`external_fc`, `node_type`), then add buyer rows for it in
`seed_routing.py` (set the `region` column). Pass `"region": "<name>"` in the `/route` body.

**A new P2P demo purchase:** append a tuple to `PURCHASES` in `seed_p2p.py`
(`id, user_id, item_name, category, asin, original_price, purchase_date, warranty_total_years,
has_original_bill, has_original_box, region, station_id`). Use a category present in
`backend/p2p/lifespan_table.py` so pricing resolves cleanly. Re-run `seed_p2p`.

**A reference photo for a product:** add a row to `CATALOG` in `seed_catalog.py`
(`asin, title, category, reference_image_path`) and drop `<asin>.jpg` into
`backend/catalog_images/`. Re-run `seed_catalog`. A value starting with `http(s)://` is
downloaded at grade time instead of read from disk.
