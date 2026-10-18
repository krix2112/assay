"""Update provenance in raw_fetches within a single transaction."""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text

from app.core.database import engine

NEW_METHOD = "automated fetch by local script (not covered by MCX consent)"
STATEMENT = f"""
BEGIN;
ALTER TABLE raw_fetches ALTER COLUMN acquisition_method TYPE VARCHAR(100);
UPDATE raw_fetches
SET acquisition_method = '{NEW_METHOD}'
WHERE acquisition_method = 'manual import';
COMMIT;
"""


def main() -> None:
    print("Executing Transaction Statement:")
    print(STATEMENT.strip())

    with engine.connect() as conn:
        before_cnt = conn.execute(
            text("SELECT count(*) FROM raw_fetches WHERE acquisition_method = 'manual import'")
        ).scalar()
        print(f"\nBefore count ('manual import'): {before_cnt}")

    # Execute alter and update in a single transaction
    alter_sql = text("ALTER TABLE raw_fetches ALTER COLUMN acquisition_method TYPE VARCHAR(100);")
    update_sql = text(
        "UPDATE raw_fetches "
        f"SET acquisition_method = '{NEW_METHOD}' "
        "WHERE acquisition_method = 'manual import';"
    )
    with engine.begin() as conn:
        conn.execute(alter_sql)
        update_res = conn.execute(update_sql)
        print(f"Rows updated in transaction: {update_res.rowcount}")

    with engine.connect() as conn:
        after_old_cnt = conn.execute(
            text("SELECT count(*) FROM raw_fetches WHERE acquisition_method = 'manual import'")
        ).scalar()
        after_new_cnt = conn.execute(
            text(f"SELECT count(*) FROM raw_fetches WHERE acquisition_method = '{NEW_METHOD}'")
        ).scalar()
        print(f"After count ('manual import'): {after_old_cnt}")
        print(f"After count ('{NEW_METHOD}'): {after_new_cnt}")

        # Verify other tables remain untouched
        bhav_cnt = conn.execute(text("SELECT count(*) FROM bhavcopy_rows")).scalar()
        tr_cnt = conn.execute(text("SELECT count(*) FROM track_record")).scalar()
        print(f"bhavcopy_rows count (untouched): {bhav_cnt}")
        print(f"track_record count (untouched): {tr_cnt}")


if __name__ == "__main__":
    main()
