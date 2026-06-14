"""Seed EVERYTHING into a fresh consolidated relay.db in one command.

  python -m backend.seed.seed_all

Runs the routing seeder then the p2p seeder. They touch disjoint tables in the one DB
(backend/data/relay.db), so order is irrelevant; routing runs first by convention.
"""
from __future__ import annotations

from backend.seed import seed_routing, seed_p2p, seed_catalog


def main() -> None:
    print("Seeding routing tables (pending_orders, ngos, returns_log) ...")
    seed_routing.seed()
    print()
    print("Seeding p2p tables (users, purchases, listings, p2p_demand, transactions) ...")
    seed_p2p.seed()
    print()
    print("Seeding catalog (asin → reference image) ...")
    seed_catalog.seed()
    print()
    print("Done — consolidated relay.db is ready.")


if __name__ == "__main__":
    main()
