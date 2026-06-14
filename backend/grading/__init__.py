"""Relay HUB — Condition Grading Agent (Phase 1).

Visual (Gemini VLM) + functional (rule) grading. Emits one uniform GradeResult schema
regardless of path, so the downstream router is path-agnostic.
"""
