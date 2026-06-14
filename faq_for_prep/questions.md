## why decided_by is hard_gate and not xgboost?                                                                                                                              

● The hard gates are intentional and correct — XGBoost only runs when none of the 3 gates fire. Here's the full decision pipeline:
  
  route_return()
      │
      ▼
  Gate 1: grade D  OR  (!resale_eligible AND !refurbish_recommended)
           → donate_or_liquidate() [Scenario B fires here: grade D]
      │
      ▼
  Gate 2: !resale_eligible AND refurbish_recommended
           → REFURBISH  [grade-C items fire here]
      │
      ▼
  Gate 3: grade_ordinal ≥ 2  AND  score ≥ 6  AND  resale_eligible
           AND  nearby_demand == 1  AND  savings > 0
           → RESELL_LOCAL  [Scenario A fires here: grade A, buyer found, savings ₹59]
      │
      ▼
  None fired → XGBoost  [the fuzzy zone: good item but no buyer, borderline grade C, etc.]

  XGBoost only activates for the fuzzy middle cases — things like:
  - Grade B item, no nearby buyer right now (REFURBISH vs DONATE?)
  - Grade C item, small positive refurb net, borderline economics
  - Grade A item, savings > 0 but buyer is right at the radius edge

  The gates are there because some decisions are economically obvious:
  - Grade A + local buyer + saves money = resell locally, always, no ML needed
  - Grade D = not resellable, not refurbishable, always discard

  Hard-gating these cases gives you 100% confidence, fully auditable decisions for the clear-cut majority. If you sent Scenario A through XGBoost, the model would also
  output RESELL_LOCAL (it was trained with the same rule engine) — but you'd get 0.87 confidence instead of 1.0, and a black-box reason instead of an auditable one.

  To see decided_by: "xgboost" in the demo, try a grade B or C item with no nearby buyer — that's the fuzzy zone the model actually handles. For example: grade C backpack,
  no matching ASIN in the DB, price ₹1500 → the gates don't fire and XGBoost decides between REFURBISH and DONATE based on the full feature vector.


## shoes of banglore for udupi
https://www.amazon.in/BRUTON-Sport-Shoes-Running-White/dp/B0F4KTQMRY/?_encoding=UTF8&ref_=pd_hp_d_btf_ci_mcx_mr_hp_atf_m&psc=1

To contact Seller write to:STS ENTERPRISES
Subject: Contact Seller - A22K40KEJWHSL8
c/o Amazon Seller Services Private Limited,
26/1, 10th Floor, Brigade World Trade Center,
Dr. Rajkumar Road,
Bangalore - 560055


