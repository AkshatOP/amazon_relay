# Catalog reference images

Drop the **good / catalog (studio) photo** of each product here, named by its **ASIN**:
`<asin>.jpg`. On a return, the grading agent auto-loads the matching file as the reference
image for that product (resolved by `backend/grading/catalog.py`, seeded by
`backend/seed/seed_catalog.py`).

## Filenames to add (match the seeded `catalog` rows)

| Filename | Product | Category |
|----------|---------|----------|
| `B0SH_UDUPI_NICHE.jpg` | Niche Artisan Shoes (the hero demo item) | shoes |
| `B0BABY_MON_01.jpg` | Samsung SmartThings Baby Monitor Pro | baby_monitor |
| `B0BP001.jpg` | Skybags Laptop Backpack | backpack |
| `B0WT001.jpg` | Analog Wrist Watch | watch |
| `B0FW001.jpg` | Running Shoes Pro | footwear |
| `B0SH001.jpg` | Leather Formal Shoes | shoes |
| `B0BG001.jpg` | Tote Handbag | bag |
| `B0TY001.jpg` | Building Blocks Set | toy |

Notes:
- `.jpg`, `.png` etc. all work — but the seeded rows expect `.jpg`. To use a different
  extension or a hosted URL, edit the `reference_image_path` for that ASIN in
  `backend/seed/seed_catalog.py` (a value starting with `http(s)://` is downloaded at grade time).
- A **missing** file is fine: grading falls back to running **reference-less** for that item
  (the agent treats the reference as optional design context).
- This folder is gitignored except this README — images you download stay local.

## How it's used

`POST /grade` accepts an optional `asin` form field. If no reference image is uploaded, the
backend looks up the catalog row for that ASIN and uses the file here. The frontend rider /
p2p screens pass `App.state.order.asin` / the purchase's `asin` automatically, so the rider
only ever captures **inspection** photos.
