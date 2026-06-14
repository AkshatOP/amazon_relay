"""Shared infrastructure for Relay HUB — config, DB, Gemini.

Everything in core/ is the ONLY thing the three domains (grading, routing, p2p) are allowed
to import in common. Domains never import each other's business logic.
"""
