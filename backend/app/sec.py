"""SEC EDGAR client (stdlib only). SEC asks for a descriptive User-Agent with a contact e-mail
and at most 10 requests/second: set SEC_USER_AGENT="RedFlag Terminal you@example.com"."""
import gzip
import json
import os
import threading
import time
import urllib.request
from pathlib import Path

UA = os.environ.get("SEC_USER_AGENT", "RedFlag Terminal research contact@example.com")
def _writable_dir(preferred: Path) -> Path:
    """Serverless hosts (Vercel, Lambda) only allow writes under /tmp."""
    for d in ([] if os.environ.get("VERCEL") else [preferred]) + [Path("/tmp/redflag-cache")]:
        try:
            d.mkdir(parents=True, exist_ok=True)
            (d / ".w").write_text("ok")
            return d
        except OSError:
            continue
    return Path("/tmp")


CACHE_DIR = _writable_dir(Path(os.environ.get("RF_CACHE_DIR", Path(__file__).resolve().parent.parent / "cache")))
_lock = threading.Lock()
_last = [0.0]


def _get(url: str, ttl: int = 86400, binary: bool = False):
    """GET with on-disk cache and SEC-friendly throttling."""
    key = CACHE_DIR / ("http_" + "".join(c if c.isalnum() else "_" for c in url)[-180:])
    if key.exists() and time.time() - key.stat().st_mtime < ttl:
        data = key.read_bytes()
    else:
        with _lock:
            wait = 0.12 - (time.time() - _last[0])
            if wait > 0:
                time.sleep(wait)
            _last[0] = time.time()
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                data = gzip.decompress(data)
        key.write_bytes(data)
    return data if binary else json.loads(data)


def ticker_map() -> dict:
    """{'AAPL': {'cik': '0000320193', 'name': 'Apple Inc.'}, ...} for every SEC-registered ticker."""
    raw = _get("https://www.sec.gov/files/company_tickers.json", ttl=7 * 86400)
    return {v["ticker"].upper(): {"cik": str(v["cik_str"]).zfill(10), "name": v["title"]} for v in raw.values()}


def submissions(cik: str) -> dict:
    return _get(f"https://data.sec.gov/submissions/CIK{cik}.json", ttl=6 * 3600)


def companyfacts(cik: str) -> dict:
    return _get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json", ttl=6 * 3600)


def latest_filing(sub: dict, forms=("10-K", "10-K/A", "20-F", "40-F")) -> dict | None:
    rec = sub.get("filings", {}).get("recent", {})
    for i, form in enumerate(rec.get("form", [])):
        if form in forms:
            return {k: rec[k][i] for k in ("accessionNumber", "filingDate", "reportDate", "primaryDocument", "form")}
    return None


def filing_url(cik: str, acc: str, doc: str) -> str:
    return f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace('-', '')}/{doc}"


def xbrl_instance(cik: str, acc: str, primary_doc: str) -> bytes | None:
    """The inline-XBRL filing ships an extracted instance named <primary>_htm.xml."""
    base = primary_doc.rsplit(".", 1)[0]
    for name in (f"{base}_htm.xml", f"{base}.xml"):
        try:
            return _get(filing_url(cik, acc, name), ttl=30 * 86400, binary=True)
        except Exception:
            continue
    return None
