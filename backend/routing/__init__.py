"""Amazon Relay — Phase 3: Smart Geo-Routing Agent.

Self-contained, independently-importable package. Decides the best outcome for a graded
return (RESELL_LOCAL / REFURBISH / DONATE / LIQUIDATE) using geography + economics + XGBoost.

Runs as a separate FastAPI app on port 8100 (the grading API owns port 8000).
"""
