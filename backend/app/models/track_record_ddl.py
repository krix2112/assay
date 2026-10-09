"""DDL definitions and helpers for track_record append-only enforcement."""

from typing import Any

from sqlalchemy import text

TRIGGER_FUNCTION_SQL = """
CREATE OR REPLACE FUNCTION reject_track_record_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'track_record is append-only: mutation is prohibited';
END;
$$ LANGUAGE plpgsql;
"""

ROW_TRIGGER_SQL = """
CREATE TRIGGER trg_track_record_row_append_only
BEFORE UPDATE OR DELETE ON track_record
FOR EACH ROW
EXECUTE FUNCTION reject_track_record_mutation();
"""

STMT_TRIGGER_SQL = """
CREATE TRIGGER trg_track_record_stmt_append_only
BEFORE TRUNCATE ON track_record
FOR EACH STATEMENT
EXECUTE FUNCTION reject_track_record_mutation();
"""

DROP_STMT_TRIGGER_SQL = "DROP TRIGGER IF EXISTS trg_track_record_stmt_append_only ON track_record;"
DROP_ROW_TRIGGER_SQL = "DROP TRIGGER IF EXISTS trg_track_record_row_append_only ON track_record;"
DROP_FUNCTION_SQL = "DROP FUNCTION IF EXISTS reject_track_record_mutation();"


def apply_track_record_triggers(bind: Any) -> None:
    """Apply append-only trigger function and triggers to track_record in current search_path."""
    bind.execute(text(TRIGGER_FUNCTION_SQL))
    bind.execute(text(ROW_TRIGGER_SQL))
    bind.execute(text(STMT_TRIGGER_SQL))


def drop_track_record_triggers(bind: Any) -> None:
    """Drop append-only triggers and trigger function from track_record in current search_path."""
    bind.execute(text(DROP_STMT_TRIGGER_SQL))
    bind.execute(text(DROP_ROW_TRIGGER_SQL))
    bind.execute(text(DROP_FUNCTION_SQL))
