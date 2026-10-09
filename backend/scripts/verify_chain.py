#!/usr/bin/env python3
"""CLI utility to verify cryptographic integrity of Assay's track record chain."""

import sys

from app.core.database import SessionLocal
from app.publish.chain import verify_chain


def main() -> None:
    session = SessionLocal()
    try:
        result = verify_chain(session)
        print("=== Assay Track Record Chain Verification ===")
        print(f"Status:       {'VALID (OK)' if result['ok'] else 'BROKEN / TAMPERED'}")
        print(f"Total entries: {result['entries']}")
        if not result["ok"]:
            print(f"First broken:  Index {result['first_broken']}")
            sys.exit(1)
        else:
            print("Chain integrity verified: all parent hashes and SHA-256 digests match.")
            sys.exit(0)
    finally:
        session.close()


if __name__ == "__main__":
    main()
