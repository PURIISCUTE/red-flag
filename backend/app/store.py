"""Profile lock store (SQLite). A mapping is locked per ticker per annual 10-K accession, so every
user gets the identical sub-industry split until the company files its next 10-K."""
import json
import os
import sqlite3
import threading
import time
from pathlib import Path

DB_PATH = Path(os.environ.get("RF_DB_PATH", Path(__file__).resolve().parent.parent / "cache" / "redflag.db"))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
_lock = threading.Lock()


def _conn():
    c = sqlite3.connect(DB_PATH)
    c.execute("""CREATE TABLE IF NOT EXISTS profiles (
        ticker TEXT NOT NULL, accession TEXT NOT NULL, payload TEXT NOT NULL, locked_at REAL NOT NULL,
        PRIMARY KEY (ticker, accession))""")
    return c


def get_lock(ticker: str, accession: str):
    with _lock, _conn() as c:
        row = c.execute("SELECT payload, locked_at FROM profiles WHERE ticker=? AND accession=?", (ticker, accession)).fetchone()
    return (json.loads(row[0]), row[1]) if row else None


def save_lock(ticker: str, accession: str, mapping: dict):
    ts = time.time()
    with _lock, _conn() as c:
        c.execute("INSERT OR IGNORE INTO profiles VALUES (?,?,?,?)", (ticker, accession, json.dumps(mapping), ts))
    return get_lock(ticker, accession)
