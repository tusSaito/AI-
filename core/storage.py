"""SQLite storage for diary entries and quantum emotion state."""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "storage" / "diary.db"


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS entries (
                entry_date  TEXT PRIMARY KEY,
                user_diary  TEXT NOT NULL,
                ai_diary    TEXT NOT NULL,
                emotion     TEXT NOT NULL,
                state_vec   TEXT NOT NULL,
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        conn.commit()


@contextmanager
def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def save_entry(
    entry_date: str,
    user_diary: str,
    ai_diary: str,
    emotion: dict,
    state_vec: dict,
) -> None:
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO entries (entry_date, user_diary, ai_diary, emotion, state_vec)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(entry_date) DO UPDATE SET
                user_diary=excluded.user_diary,
                ai_diary=excluded.ai_diary,
                emotion=excluded.emotion,
                state_vec=excluded.state_vec,
                created_at=datetime('now')
            """,
            (
                entry_date,
                user_diary,
                ai_diary,
                json.dumps(emotion, ensure_ascii=False),
                json.dumps(state_vec, ensure_ascii=False),
            ),
        )
        conn.commit()


def get_entry(entry_date: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM entries WHERE entry_date = ?", (entry_date,)
        ).fetchone()
    if row is None:
        return None
    return _row_to_dict(row)


def get_latest_before(entry_date: str) -> dict | None:
    """Return the most recent entry strictly before entry_date (for continuity)."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM entries WHERE entry_date < ? ORDER BY entry_date DESC LIMIT 1",
            (entry_date,),
        ).fetchone()
    if row is None:
        return None
    return _row_to_dict(row)


def list_entries(limit: int = 30) -> list[dict]:
    limit = max(1, min(int(limit), 365))
    with _connect() as conn:
        rows = conn.execute(
            "SELECT entry_date, user_diary, ai_diary, emotion FROM entries "
            "ORDER BY entry_date DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    for key in ("emotion", "state_vec"):
        if key in d and d[key]:
            try:
                d[key] = json.loads(d[key])
            except json.JSONDecodeError:
                d[key] = None
    return d
