"""Read-only inspection script for database facts.

Does not print or expose any database URL or connection parameters.
"""

import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text

from app.core.database import engine


def main() -> None:
    with engine.connect() as conn:
        # 1. Row count for every public table
        tables_query = text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_type = 'BASE TABLE' "
            "ORDER BY table_name;"
        )
        tables = [row[0] for row in conn.execute(tables_query)]

        print("=== ROW COUNT FOR EVERY PUBLIC TABLE ===")
        for table in tables:
            cnt_query = text(f'SELECT count(*) FROM "{table}"')
            cnt = conn.execute(cnt_query).scalar()
            print(f"{table}: {cnt}")

        # 2. Min and max trade_date in bhavcopy_rows
        print("\n=== BHAVCOPY_ROWS MIN/MAX TRADE_DATE ===")
        bhav_query = text("SELECT MIN(trade_date), MAX(trade_date) FROM bhavcopy_rows;")
        min_date, max_date = conn.execute(bhav_query).fetchone()
        print(f"min_trade_date: {min_date}")
        print(f"max_trade_date: {max_date}")

        # 3. raw_fetches acquisition_method values with counts
        print("\n=== RAW_FETCHES ACQUISITION_METHOD COUNTS ===")
        raw_query = text(
            "SELECT acquisition_method, count(*) "
            "FROM raw_fetches "
            "GROUP BY acquisition_method "
            "ORDER BY acquisition_method;"
        )
        for row in conn.execute(raw_query):
            print(f"{row[0]}: {row[1]}")

        # 4. Row counts of track_record and briefs_sent
        print("\n=== ROW COUNTS OF TRACK_RECORD AND BRIEFS_SENT ===")
        tr_cnt = conn.execute(text("SELECT count(*) FROM track_record;")).scalar()
        bs_cnt = conn.execute(text("SELECT count(*) FROM briefs_sent;")).scalar()
        print(f"track_record: {tr_cnt}")
        print(f"briefs_sent: {bs_cnt}")


if __name__ == "__main__":
    main()
