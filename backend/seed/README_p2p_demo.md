# P2P Resale Exchange — Demo Click-Path

## Setup

```bash
# From repo root, with venv active
python -m p2p.db.seed_p2p                                     # seed relay_p2p.db
uvicorn p2p.p2p_api:app --reload --port 8200                  # P2P API
python -m http.server 5600 --directory frontend_p2p           # frontend
```

Open: http://localhost:5600

---

## Demo scenario — Priya's Baby Walker

| | Value |
|---|---|
| User | Priya Shetty, Udupi City (576101) |
| Item | Baby Walker |
| Category | baby_walker |
| Original price | ₹5,000 |
| Purchase date | 2026-06-14 (today) |
| Warranty | 5 years total |
| simulate_years | **2.0** (peak resale window) |

---

## Step 1 — Resale Nudge

**Input:** Select purchase #1, simulate_years = 2.0

**Expected output:**
- `in_window: true` (baby_walker window: 1.5–3.0 yr; 2.0 yr = avg → peak)
- `age_factor = 1.0` (age ≤ avg → no penalty)
- Stage-1 estimate: `₹5,000 × 1.0 × 0.40 (Grade C) = ₹2,000`
- Warranty bonus: `₹5,000 × 3.0yr × 0.02 = ₹300`
- `estimated_price = ₹2,300`
- Message: "Hi Priya Shetty, your Baby Walker is now 2.0 years old — perfect timing to resell! Prime resale window — best price right now..."

---

## Step 2 — Create Listing (Grade B)

**Input:** Grade = B, score = 7, simulate_years = 2.0

**Expected output:**
- Stage-1 baseline: ₹2,300 (Grade C assumption)
- Stage-2 calculation: `₹5,000 × 1.0 × 0.65 (Grade B) = ₹3,250` + `₹300 warranty = ₹3,550`
- `price_went_up: true` (₹3,250 vs ₹2,000 base — Grade B > Grade C)
- `price_delta_vs_stage1: +₹1,250` (base only, before warranty)
- Health Card shows: Grade B badge, "transferable warranty: 3.0 yr", original bill verified
- `listing_id: 1`

---

## Step 3 — Find Buyers

**Input:** Click "Find Buyers" (listing_id = 1)

**If no buyers shown:** Click "Generate Demo Demand" to seed a synthetic buyer

**Expected output:**
- Buyer: "Ravi Nayak (Manipal)" or "Demo Buyer (Manipal)"
- `road_km ≈ 7.04 km` (haversine Udupi City → Manipal ≈ 5.0 km straight × 1.4 road circuity)
- `max_budget ≈ ₹4,000` (pre-seeded) or `₹3,905` (auto-generated = asking_price × 1.10)
- Within 12 km radius ✓

---

## Step 4 — Handoff Logistics

**Input (pre-filled defaults):**
- Seller: 13.3409, 74.7421 (Udupi City — same as station → pickup_km = 0)
- Buyer: 13.3502, 74.7876 (Manipal)

**Expected output:**

| Metric | Value | Calculation |
|---|---|---|
| Pickup km | 0.0 km | Seller is at station (same coords) |
| Drop km | 7.04 km | UDUPI_CITY → Manipal (5.03 km × 1.4) |
| Total P2P km | 7.04 km | |

**Seller earnings:**
| | |
|---|---|
| Asking price | ₹3,550 |
| Platform fee (5%) | ₹178 |
| **Seller payout** | **₹3,372** |

---

## Key narrative for judges

1. **Proactive nudge** — system finds Priya (not Priya finds the system)
2. **Stage-1 → Stage-2 pricing** — estimate first, grade reveals real value; Grade B structurally
   raises the price (this is a mechanical guarantee, not a promise)
3. **Original bill as trust anchor** — buyer knows purchase price/date, no information asymmetry
4. **Same-town handoff** — Udupi → Udupi; no 448 km FC reship needed

---

## Curl smoke-tests

```bash
# Step 1
curl "http://localhost:8200/nudge/1?simulate_years=2.0"

# Step 2
curl -X POST http://localhost:8200/list \
  -H "Content-Type: application/json" \
  -d '{"purchase_id":1,"grade":"B","condition_score":7,"defects":[],"simulate_years":2.0}'

# Step 3a — find
curl -X POST http://localhost:8200/demand/find \
  -H "Content-Type: application/json" \
  -d '{"listing_id":1}'

# Step 3b — generate demo demand
curl -X POST http://localhost:8200/demand/generate \
  -H "Content-Type: application/json" \
  -d '{"listing_id":1}'

# Step 4
curl -X POST http://localhost:8200/handoff \
  -H "Content-Type: application/json" \
  -d '{"listing_id":1,"demand_id":1,"seller_lat":13.3409,"seller_lng":74.7421,"buyer_lat":13.3502,"buyer_lng":74.7876}'
```
