# RedFlag Terminal — working prototype

A forensic-accounting dashboard. Type any SEC-registered ticker. The app pulls the company's filings from SEC EDGAR, locks its sub-industry profile, routes the 13 categories, and grades every flag in the Master Flag Library. It then shows a score, a summary, 3-year + TTM tables and a live price chart, and exports a PDF audit.

## Run it

**Full version (any ticker):**
```bash
./run.sh            # macOS / Linux   (Windows: run.bat)
# then open http://localhost:8000
```
It needs Python 3.10+. Set `SEC_USER_AGENT="RedFlag Terminal you@yourdomain.com"`, because the SEC requires a contact e-mail.

**Deploy to Vercel (API + dashboard together):** import the repo, leave **Root Directory empty** (repo root) and Framework Preset on **Other**. Then add the environment variable `SEC_USER_AGENT`. `vercel.json` and `api/index.py` handle the rest.

**Deploy to Render:** push this folder to GitHub, then choose *New → Blueprint* (it reads `render.yaml`). One web service serves both the API and the dashboard.
If you host the dashboard somewhere else, point it at the API with `?api=https://your-app.onrender.com` or with the box in the sidebar.

## How the logic maps to the spec documents

| Step | Where | What it does |
|---|---|---|
| 1. Cache check | `backend/app/store.py` | SQLite lock per ticker per 10-K accession. A repeat search gets the identical profile until the next 10-K. |
| 2. Filing stack | `backend/app/sec.py`, `extract.py` | EDGAR companyfacts XBRL gives 4 fiscal years (3 graded + 1 base year for YoY). TTM = latest 10-Q YTD + FY − prior-year YTD. Balances come from the latest 10-Q. |
| 2. SIC anchor | `backend/app/taxonomy.py` | An immutable SIC → sub-industry lookup (exact codes, then ranges). |
| 3A. Mapper agent | `backend/app/segments.py` | Reads the 10-K XBRL instance and uses ASC 280 segments, or the product/service table when segments are purely geographic. Forced tags are limited to the 24 IDs: a deterministic keyword tagger, or Claude at temperature 0 if `ANTHROPIC_API_KEY` is set. |
| 3A. 100% check | `segments._complete_subset` | Keeps only the set of line items that adds up to reported total revenue (no double counting). |
| 3B. Aggregator + 20% gate | `public/src/engine/engine.js` → `aggregate()` | Sums revenue by tag. S1 is the SIC anchor. S2 is any other bucket with ≥ 20% of revenue **or** operating profit. |
| 4. Category routing | `engine.js` → `route()` | Shared categories (1, 6) pull from both sides. Physical categories (2, 3, 4, 7, 9, 10, 11) pull from the more asset-heavy side. Digital categories (5, 8, 12) pull from the asset-light side. Category 13 always runs. |
| 5–6. Grade | `engine.js` → `gradeFlag()` | Evaluators cover all 62 distinct formulas, so **867 of 867 flags** are wired. Grades are Green / Yellow / Red against the library thresholds. Grey "OK" is excluded from the score; Grey "NOT OK" raises a disclosure alert with no deduction. |
| Score | `engine.js` → `score()` | 100 × (G + 0.5·Y) / graded. Flags with an identical formula on both sides count once. |

Grading runs in the browser engine, so every ticker is graded by the same deterministic code. All data is live from SEC EDGAR and Yahoo Finance; there is no offline demo.

## Project layout
```
backend/app/        FastAPI: main.py (endpoints), sec.py, extract.py, segments.py, taxonomy.py, store.py, yahoo.py
backend/tests/      offline pipeline test (python3 backend/tests/test_pipeline.py)
backend/data/       Master Flag Library (.xlsx source)
public/index.html dashboard shell (runs from file:// or from the API server)
public/src/engine/engine.js        deterministic mapping, routing, grading
public/src/data/library.js         867 flags generated from the Excel file
public/src/services/api.js         API hooks: analyze / quote / search, with demo fallback
public/src/components/             Sidebar, Header, CompanyCard, LiveChart, ExecutiveSummary,
                                     ProfilePipeline, FlagMatrix, FinancialTable, Views
public/src/utils/pdfExport.js      exportAuditPDF (jsPDF + autoTable; print fallback)
public/src/styles/grid.css, app.css
```

## API
- `POST /api/v1/analyze {"ticker":"PFE"}` returns the profile lock, revenue lines and tags, the fiscal years plus TTM figures, the XBRL concepts used, and a quote.
- `GET /api/v1/quote/{ticker}` returns the Yahoo Finance price and change. Market cap = price × SEC shares outstanding.
- `GET /api/v1/search?q=pf` gives autocomplete from the SEC ticker list.
- `GET /api/v1/health`

## Known limits
- **Footnote-only items:** these are graded only when the filer tags them in XBRL. Examples are inventory components, purchase obligations and non-accrual loans. Otherwise they go to the Grey policy.
- **Banks and REITs:** some ratios use approximations. NIM uses net interest income / total assets.
- **Keyword tagger:** this is a first pass. Add rules to `taxonomy.RULES`, or set `ANTHROPIC_API_KEY` to use the LLM tagger. Both are forced to choose among the 24 IDs, and the result is locked.
- **Foreign filers:** 20-F / 40-F filers that report in IFRS are partly supported.
