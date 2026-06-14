# Udupi Tier-3 Demo Scenarios

These two scenarios are the heart of the Amazon Relay story. Udupi is a coastal tier-3 town
with no Amazon FC on the Karnataka coast. Every FBA item ships from the Bengaluru FC cluster,
400 km over the Western Ghats (NH 169 + NH 75 via Shiradi Ghats). Low-volume niche items
that aren't pre-stocked regionally take 7-9 days — exactly the window in which a second order
for the same item can arrive and be intercepted locally.

---

## Scenario A — HERO: grade-A niche shoe, local buyer found

**What it proves:** even on a ₹400 item, local intercept deletes BOTH the 400 km haul AND the
400 km fresh-unit reship. The per-item logistics saving beats the item price on a percentage
basis, proving that long-tail low-volume items are where interception pays most.

### UI inputs (`http://localhost:5500`)

| Field | Value |
|-------|-------|
| **Region** | Udupi (tier-3 coastal) |
| **Category** | shoes |
| **ASIN** | `B0SH_UDUPI_NICHE` |
| **Original price (Rs)** | `400` |
| **Grade** | A |
| **Score** | 9 |
| **Defect count** | 0 |
| **Latitude** | `13.3409` |
| **Longitude** | `74.7421` |
| (preset) | Udupi City (Service Bus Stand) |

### Expected decision

**`RESELL_LOCAL`** — decided by `hard_gate`

Gate 3 fires: grade A (≥B), score 9 (≥6), resale_eligible=true, nearby_demand=1 (Manipal buyer
at ~6 km road), savings > 0.

### Expected numbers (OSRM-verified June 2026)

| Metric | Value |
|--------|-------|
| Nearest Local Station | Udupi City (Service Bus Stand) |
| Leg1 (pickup to station) | 0.0 km (customer is at the bus stand coordinates) |
| Leg2 (station → BLR FC) | **448.54 km** (OSRM, NH 169+NH 75 via Shiradi Ghats) |
| Buyer found | pin 576101 (Manipal cluster), **2.2 km road** |
| Full-path cost (haul + reship) | **₹72.56 / item** |
| Local-intercept cost | **₹12.74 / item** |
| **Savings** | **₹59.82 / item** |
| CO₂ full path | **1.6067 kg/item** |
| CO₂ saved | **1.5849 kg/item** |

**Money-shot sentence (what the UI shows):**
> Intercept 2.2 km local vs 448 km Ghats haul to BLR FC + reship same distance back.
> Rs 59.82/item saved · 1.58 kg CO₂/item avoided.

This is real — no synthetic 612 km projection. The actual BLR FC distance IS the tier-3 story.

---

## Scenario B — CONTRAST: grade-D shoe, no local buyer, Kundapura pickup

**What it proves:** the router does NOT always resell. Grade D + no demand → hard gate fires
→ donate or liquidate. The system correctly declines and routes to the appropriate disposal path.

### UI inputs

| Field | Value |
|-------|-------|
| **Region** | Udupi (tier-3 coastal) |
| **Category** | shoes |
| **ASIN** | `B0SH_UDUPI_NICHE` |
| **Original price (Rs)** | `400` |
| **Grade** | D |
| **Score** | 2 |
| **Defect count** | 3 |
| **Latitude** | `13.6260` |
| **Longitude** | `74.6920` |
| (preset) | Kundapura |

### Expected decision

**`DONATE`** or **`LIQUIDATE`** — decided by `hard_gate`

Gate 1 fires: grade D (grade_ordinal=0) → immediately routes to donate_or_liquidate().

The boundary between DONATE and LIQUIDATE is computed from economics:
```
liquidation_net = original_price × 0.15 − haul_cost × weight_factor["shoes"]
               = 400 × 0.15 − haul_cost × 1.0
               = 60 − haul_cost
```
For a ₹400 shoe with a 400+ km haul (haul_cost > ₹60), liquidation_net is negative, meaning
scrap recovery doesn't cover the haul cost. Since liquidation_net ≤ donation_value(60), DONATE
is the economically correct outcome.

### What you should see in the UI

- Buyer found: **false** (no buyer seeded in Kundapura 576201)
- Decision badge: **DONATE** (dark blue) or **LIQUIDATE** (dark red)
- decided_by: **hard_gate**
- Reason: "Hard gate: grade D or ineligible; category economics favour donation/liquidation."

---

## Running the demo

1. Seed the DB: `python -m routing.db.seed_db`
2. Start the routing API: `uvicorn routing.route_api:app --reload --port 8100`
3. Serve the UI: `cd frontend_routing && python -m http.server 5500`
4. Open `http://localhost:5500`
5. Select region **Udupi**, enter Scenario A inputs → expect RESELL_LOCAL
6. Change grade to D, score to 2, defects to 3, switch to Kundapura preset → expect DONATE

---

## Why Udupi is the real story

| Dimension | Bengaluru (metro) | Udupi (tier-3) |
|-----------|-------------------|----------------|
| FC distance | ~22-28 km (OSRM) | **448 km** (OSRM, Shiradi Ghats) |
| Reship distance | ~25-30 km | ~450 km |
| Savings on ₹400 shoe | ~₹15/item | **₹59.82/item** |
| CO₂ saved | ~0.33 kg/item | **1.58 kg/item** |
| Delivery window | 1-2 days | 7-9 days (niche items) |

The Bengaluru savings are real and honest but modest. Udupi demonstrates the full potential
of logistics arbitrage at scale — where the FC haul IS the expensive path.
