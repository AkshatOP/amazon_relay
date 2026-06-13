# Amazon Relay — Context

## Problem statement

Millions of products bought online are returned, underused, or discarded despite being
perfectly usable. Returns are expensive for customers, sellers, and the planet. Customers
also struggle to trust refurbished or second-hand products.

What if Amazon could create an intelligent ecosystem where returned or unused products
automatically find their next best owner? Imagine: AI deciding whether an item should be
resold, refurbished, donated, recycled, or exchanged; smart quality grading through
image/video analysis; personalized recommendations for certified refurbished products;
sustainable incentives and "green credits" for customers; easy peer-to-peer resale inside
Amazon's trusted ecosystem; predictive return prevention before a purchase is even made.
Build the future of sustainable commerce where every product gets a meaningful second life.

## Our proposed solution — Amazon Relay

An intelligent reverse-logistics system. Instead of returned/unused products travelling
hundreds of km to a warehouse and being liquidated at a loss, Relay:

1. **Grades** product condition using an AI agent. *(This MVP focuses here.)*
2. **Routes** it to the best outcome: `RESELL_LOCAL` / `REFURBISH` / `DONATE` / `LIQUIDATE`
   via a downstream XGBoost model.
3. **Matches** it to nearby buyers who already declared they want it.
4. **Generates** a Product Health Card as a trust layer for the next buyer.

## The component built in this MVP — the Condition Grading Agent

The first and most critical stage. It has two grading paths, selected automatically from
product metadata (in production, from the order-history SKU; in this MVP, from a dropdown):

### Visual path (the hero of this MVP)
For products where **condition equals what you can see** — shoes, clothing, phone cases, bags.
The agent is given:
- **reference photos** of the good product, and
- **inspection photos** of the returned product (captured by the delivery rider who
  collects the return),

and it grades the **condition delta** between them visually.

### Functional path (stubbed in this MVP)
For products where a photo is useless — chargers, speakers, power banks. Graded by rule
from 2–3 yes/no answers. In this MVP the structure and simple rule logic are wired, but the
hero demo is the visual path.

## Important MVP simplification — the reference photo

In this MVP the user/demo uploads the reference (good-product) photos manually.

**In production this is automated:** the reference image is auto-pulled from the Amazon
catalog via the order-history SKU, so the customer/rider provides only the **inspection
photos**. The visual delta-grading approach is unchanged — only the source of the
reference image differs. We surface the reference upload in the demo purely so judges can
see and control both halves of the comparison.

## Why grade the *delta*, not the absolute condition

A photo of a product in isolation can't tell "this scuff shipped from the factory" from
"this scuff is new damage." By comparing inspection photos against the known-good reference,
the agent measures only what *changed* — which is exactly what determines resale value and
the correct downstream route.

## Output contract

Regardless of which path produced it, the grade is emitted as the **same strict JSON shape**
(see `skills/grading_skill.md` and `backend/schemas.py`) so the downstream XGBoost router
never has to care which path was used.
