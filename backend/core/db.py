"""The ONE SQLite connection helper.

Every reader, writer, and seeder opens the consolidated database through `get_connection()`.
No module hard-codes a database path anymore — they all resolve to core.config.DB_PATH
(backend/data/relay.db), so the routing tables and the p2p tables live in one file.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

from . import config

# Convenience re-export so callers can do `from backend.core.db import DB_PATH`.
DB_PATH = config.DB_PATH


def get_connection(db_path: str | Path | None = None, row_factory: bool = True) -> sqlite3.Connection:
    """Open a connection to the consolidated DB (or an explicit db_path override for tests).

    Ensures the parent data/ directory exists. With row_factory=True (default) rows behave
    like dicts (sqlite3.Row); pass False for plain tuple access in seeders.
    """
    path = Path(db_path) if db_path is not None else config.DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    if row_factory:
        conn.row_factory = sqlite3.Row
    return conn


def db_exists() -> bool:
    return config.DB_PATH.exists()
