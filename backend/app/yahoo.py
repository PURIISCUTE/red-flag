"""Live quote from Yahoo Finance's public chart endpoint (no key). Market cap = price x SEC shares outstanding."""
import json
import time
import urllib.request

_cache = {}


def quote(ticker: str, shares_outstanding: float | None = None, ttl: int = 15):
    hit = _cache.get(ticker)
    if hit and time.time() - hit[0] < ttl:
        q = dict(hit[1])
    else:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker.replace('.', '-')}?range=1d&interval=1m"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (RedFlag Terminal)"})
        with urllib.request.urlopen(req, timeout=15) as r:
            meta = json.loads(r.read())["chart"]["result"][0]["meta"]
        price = meta.get("regularMarketPrice")
        prev = meta.get("chartPreviousClose") or meta.get("previousClose")
        q = {"price": price, "previousClose": prev,
             "change": (price - prev) if price is not None and prev else None,
             "changePct": ((price / prev - 1) * 100) if price is not None and prev else None,
             "currency": meta.get("currency"), "exchange": meta.get("fullExchangeName") or meta.get("exchangeName"),
             "marketTime": meta.get("regularMarketTime"), "name": meta.get("longName") or meta.get("shortName"),
             "source": "Yahoo Finance"}
        _cache[ticker] = (time.time(), q)
        q = dict(q)
    if shares_outstanding and q.get("price"):
        q["marketCap"] = q["price"] * shares_outstanding
    return q
