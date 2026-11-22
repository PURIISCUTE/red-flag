"""RedFlag Terminal API.

POST /api/v1/analyze {"ticker": "PFE"}  -> locked profile + 3 FY (+ base year) + TTM financials + quote
GET  /api/v1/quote/{ticker}              -> live price / change / market cap
GET  /api/v1/search?q=PF                 -> ticker autocomplete from SEC's ticker list
GET  /api/v1/health
The dashboard (../public) is served at "/", so one Render web service hosts everything.

Flag routing and grading run in the dashboard's engine (public/src/engine/engine.js) so the
exact same deterministic code grades every ticker, online or in the offline demo."""
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import extract, sec, segments, store, yahoo
from .taxonomy import SUB_NAMES, sic_anchor

app = FastAPI(title="RedFlag Terminal API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class AnalyzeRequest(BaseModel):
    ticker: str


@app.get("/api/v1/health")
def health():
    return {"ok": True, "sources": ["SEC EDGAR XBRL", "Yahoo Finance"]}


@app.get("/api/v1/search")
def search(q: str = ""):
    q = q.strip().upper()
    if not q:
        return []
    tm = sec.ticker_map()
    hits = [(t, v) for t, v in tm.items() if t.startswith(q)]
    hits += [(t, v) for t, v in tm.items() if q in v["name"].upper() and not t.startswith(q)]
    return [{"ticker": t, "name": v["name"]} for t, v in hits[:10]]


@app.get("/api/v1/quote/{ticker}")
def get_quote(ticker: str):
    ticker, info = _lookup(ticker.upper())
    shares = None
    if info:
        try:
            shares = extract.shares_outstanding(sec.companyfacts(info["cik"]))
        except Exception:
            shares = None
    try:
        return yahoo.quote(ticker, shares)
    except Exception as e:
        raise HTTPException(502, f"Quote unavailable: {e}")


def _lookup(ticker: str):
    """SEC lists class shares with a dash (BRK-B); users type BRK.B or BRK/B."""
    tm = sec.ticker_map()
    for t in (ticker, ticker.replace(".", "-"), ticker.replace("/", "-"), ticker.replace("-", ".")):
        if t in tm:
            return t, tm[t]
    return ticker, None


@app.post("/api/v1/analyze")
def analyze(req: AnalyzeRequest):
    try:
        return _analyze(req.ticker.strip().upper())
    except HTTPException:
        raise
    except Exception as e:  # surface a readable reason instead of a bare 500
        raise HTTPException(502, f"Could not analyze {req.ticker.upper()}: {type(e).__name__}: {e}")


def _analyze(ticker: str):
    ticker, info = _lookup(ticker)
    if not info:
        raise HTTPException(404, f"{ticker} is not an SEC-registered ticker.")
    cik = info["cik"]
    sub = sec.submissions(cik)
    filing = sec.latest_filing(sub)
    if not filing:
        raise HTTPException(422, f"No annual report (10-K / 20-F) found for {ticker}.")
    facts = sec.companyfacts(cik)
    data = extract.extract(facts)
    if len(data["years"]) < 2:
        raise HTTPException(422, f"Not enough annual XBRL history for {ticker}.")

    anchor = sic_anchor(sub.get("sic"))
    # ---- Step 1: cache check -> mapper -> lock -------------------------------------------------
    locked = store.get_lock(ticker, filing["accessionNumber"])
    cached = locked is not None
    if not locked:
        table = {"axis": None, "lines": [], "reportedTotal": None, "note": "XBRL instance not available."}
        inst = sec.xbrl_instance(cik, filing["accessionNumber"], filing["primaryDocument"])
        if inst:
            fy_end = data["fyEnds"][-1]
            table = segments.revenue_table(segments.parse_instance(inst), fy_end)
        lines = segments.tag_lines(table["lines"], anchor, info["name"])
        if not lines:  # pure-play fallback: whole company on the SIC anchor
            last = data["fin"][data["years"][-1]]
            lines = [{"member": None, "name": "Total net revenue", "rev": last.get("rev") or 0, "op": None, "tag": anchor or "S1.4", "tagger": "sic"}]
            table["reportedTotal"] = last.get("rev")
        mapping = {"anchorSub": anchor, "revenueLines": lines, "segmentAxis": table["axis"],
                   "segmentNote": table["note"], "reportedTotal": table["reportedTotal"]}
        locked = store.save_lock(ticker, filing["accessionNumber"], mapping)
    mapping, locked_at = locked

    try:
        quote = yahoo.quote(ticker, extract.shares_outstanding(facts))
    except Exception:
        quote = None

    last_fy = data["years"][-1]
    return {
        "ticker": ticker, "name": sub.get("name") or info["name"], "cik": cik,
        "sic": sub.get("sic"), "sicName": sub.get("sicDescription"),
        "exchange": (sub.get("exchanges") or [None])[0],
        "fiscalYear": f"FY{last_fy}", "fyEnd": data["fyEnds"][-1], "filed": filing["filingDate"], "form": filing["form"],
        "filingUrl": sec.filing_url(cik, filing["accessionNumber"], filing["primaryDocument"]),
        **mapping,
        "subNames": SUB_NAMES,
        "years": data["years"], "fin": data["fin"], "ttm": data["ttm"], "concepts": data["concepts"],
        "lock": {"accession": filing["accessionNumber"], "lockedAt": locked_at, "cached": cached},
        "quote": quote,
        "sources": {"statements": f"SEC EDGAR XBRL companyfacts (CIK {cik}), annual {filing['form']} values for FY{data['allYears'][0]}–FY{last_fy}; TTM from latest 10-Q YTD.",
                    "footnotes": "XBRL footnote tags (inventory components, purchase obligations, tax reserves, leases, contingencies) where the filer tagged them.",
                    "market": "Yahoo Finance chart endpoint (price); market cap = price × dei:EntityCommonStockSharesOutstanding."},
    }


# Dashboard files live in /public (Vercel serves that folder from its CDN; locally FastAPI serves it).
ROOT = Path(__file__).resolve().parent.parent.parent
FRONTEND = next((p for p in (ROOT / "public", ROOT / "frontend") if (p / "index.html").exists()), None)
if FRONTEND:
    app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
