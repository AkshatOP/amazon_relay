# Agent: Routing Agent (downstream — spec only, Phase 3)

> **Not built in this MVP.** This file specifies the next agent in the pipeline so the
> grading output can be designed to feed it cleanly.

## Role
Decide the best second-life **outcome** for a graded product and route it there, minimizing
cost and waste while maximizing recovered value.

## Model
An **XGBoost** classifier (gradient-boosted trees) — not an LLM. Chosen because routing is a
tabular decision over a handful of structured features with hard business/logistics
constraints, where a small, fast, explainable model beats a VLM.

## Inputs (features)
Primarily the uniform grade JSON from the Condition Grading Agent, plus business context:
- `grade` (A/B/C/D) and `score` (1–10) — condition.
- `len(defects)` — defect count; `confidence`.
- `category` and original price / current resale price.
- Logistics: distance to nearest warehouse, local demand signal (declared nearby buyers),
  refurb cost estimate, donation-partner availability.

## Output (label)
One of:
- `RESELL_LOCAL` — good condition + local demand → sell peer-to-peer nearby.
- `REFURBISH` — fixable wear where refurb cost < recovered value.
- `DONATE` — low resale value but still usable → donation partner + green credits.
- `LIQUIDATE` — structural damage / no viable resale.

## Decision intuition (pre-ML heuristic baseline)
| Condition                         | Likely route      |
|-----------------------------------|-------------------|
| grade A/B + nearby buyer          | `RESELL_LOCAL`    |
| grade C, refurb_recommended       | `REFURBISH`       |
| grade C/D, low value, still usable| `DONATE`          |
| grade D, structural damage        | `LIQUIDATE`       |

The XGBoost model learns the real boundaries (incl. cost thresholds) from historical
outcomes; the table above is just the bootstrap heuristic.

## Why decoupled from grading
The grader emits a uniform schema regardless of path, so this router consumes `score` +
defect count + `grade` without knowing whether a VLM or a rule table produced them.

## Downstream
Routed items flow to the **Trust Layer & Matching** stage (Phase 4): Product Health Card
generation + nearby-buyer matching.
