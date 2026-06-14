"""Resolve a product's reference (catalog) image by ASIN, for auto-grading on return.

The rider/customer only sends INSPECTION photos of the returned unit. The grading agent
also wants the REFERENCE (catalog) image — what the product is supposed to look like. We
look that up here by the order's ASIN so it's automatic, no manual reference upload.

Storage (demo): a row in the `catalog` table maps ASIN → a file under backend/catalog_images/
(named <asin>.jpg by convention) OR an https URL. Drop the studio photo into that folder.

In production this is the Amazon catalog image fetched by the order-history SKU; only the
SOURCE of the reference differs — the grading call is identical.

NOTE / FUTURE WORK (intentionally NOT built yet — see docs/TODO.md):
  The reference is used as DESIGN CONTEXT, never as a pixel-diff / similarity target (a studio
  shot vs a phone photo always differ in lighting/angle/background). When we work on this
  properly ourselves, refine how the reference is conditioned (e.g. exact-SKU colourway
  matching, multi-angle references, masking the background) — for now we just auto-supply the
  catalog image and let the existing skill grade damage on the returned unit.
"""
from __future__ import annotations

import tempfile
from pathlib import Path

from backend.core import db
from . import config


def _download(url: str) -> str | None:
    """Fetch a remote reference image to a temp file; return its path (or None)."""
    try:
        import httpx
        suffix = Path(url.split("?")[0]).suffix or ".jpg"
        resp = httpx.get(url, timeout=8.0, follow_redirects=True)
        if resp.status_code != 200 or not resp.content:
            return None
        tmp = tempfile.NamedTemporaryFile(prefix="relay_ref_", suffix=suffix, delete=False)
        tmp.write(resp.content)
        tmp.close()
        return tmp.name
    except Exception:
        return None


def reference_paths_for(asin: str) -> list[str]:
    """Reference image path(s) for an ASIN. Empty list if unknown / file missing.

    Never raises. A local filename in the `catalog` table resolves under CATALOG_DIR; an
    http(s) value is downloaded to a temp file. Missing files return [] so grading still
    runs reference-less (the agent treats reference as optional context).
    """
    asin = (asin or "").strip()
    if not asin:
        return []
    try:
        conn = db.get_connection()
        row = conn.execute(
            "SELECT reference_image_path FROM catalog WHERE asin = ?", (asin,)
        ).fetchone()
        conn.close()
    except Exception:
        return []
    if not row:
        return []
    ref = (row["reference_image_path"] or "").strip()
    if not ref:
        return []

    if ref.startswith("http://") or ref.startswith("https://"):
        p = _download(ref)
        return [p] if p else []

    # Local: a bare filename resolves under CATALOG_DIR; an absolute/relative path is honoured.
    candidate = Path(ref)
    if not candidate.is_absolute() and len(candidate.parts) == 1:
        candidate = config.CATALOG_DIR / ref
    return [str(candidate)] if candidate.exists() else []


def has_reference(asin: str) -> bool:
    return bool(reference_paths_for(asin))
