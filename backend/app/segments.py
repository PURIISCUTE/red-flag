"""Mapper: read the 10-K XBRL instance, find the revenue table to map (ASC 280 segments, or the
product/service disaggregation when segments are purely geographic), and tag each line with one
of the 24 fixed sub-industry IDs. Optional LLM tagger (forced choice, temperature 0) when
ANTHROPIC_API_KEY is set; otherwise the deterministic keyword tagger in taxonomy.py."""
import json
import os
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date

from .taxonomy import SUB_NAMES, humanize, tag_line

REV_CONCEPTS = {"Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax",
                "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet"}
OP_CONCEPTS = {"OperatingIncomeLoss", "SegmentReportingInformationOperatingIncomeLoss"}
SEG_AXIS = "StatementBusinessSegmentsAxis"
PROD_AXIS = "ProductOrServiceAxis"
OK_SECOND_DIM = {"ConsolidationItemsAxis": {"OperatingSegmentsMember"}}
GEO = re.compile(r"americas|europe|china|japan|asia|pacific|international|north america|latin|emea|apac|"
                 r"domestic|foreign|united states|u\.s\.|canada|mexico|india|rest of|region|greater", re.I)


def _local(tag):
    return tag.split("}")[-1]


def parse_instance(xml_bytes: bytes):
    root = ET.fromstring(xml_bytes)
    ctx = {}
    for c in root.iter():
        if _local(c.tag) != "context":
            continue
        dims, start, end = [], None, None
        for el in c.iter():
            t = _local(el.tag)
            if t == "explicitMember":
                dims.append((el.get("dimension").split(":")[-1], el.text.strip()))
            elif t == "startDate":
                start = el.text.strip()
            elif t in ("endDate", "instant"):
                end = el.text.strip()
        ctx[c.get("id")] = (start, end, tuple(dims))
    facts = []
    for el in root:
        name = _local(el.tag)
        if name in REV_CONCEPTS or name in OP_CONCEPTS:
            try:
                val = float(el.text)
            except (TypeError, ValueError):
                continue
            c = ctx.get(el.get("contextRef"))
            if c:
                facts.append((name, val, *c))
    return facts


def _primary_dim(dims):
    """Return (axis, member) when the context is a single business/product dimension (optionally with operating-segments consolidation)."""
    main = [d for d in dims if d[0] not in OK_SECOND_DIM]
    extra = [d for d in dims if d[0] in OK_SECOND_DIM]
    if len(main) != 1 or any(m.split(":")[-1] not in OK_SECOND_DIM[a] for a, m in extra):
        return None
    return main[0]


def _complete_subset(rows, total, tol=0.005):
    """Members often mix levels (Product + Service + iPhone + Mac ...). Keep the largest set of members
    that adds up to reported total revenue (the 100% completeness check), so nothing is double-counted."""
    items = sorted(rows.items(), key=lambda kv: -kv[1]["rev"])[:16]
    best = None
    n = len(items)
    for mask in range(1, 1 << n):
        s = 0.0
        cnt = 0
        for i in range(n):
            if mask >> i & 1:
                s += items[i][1]["rev"]
                cnt += 1
        if abs(s - total) / total <= tol and (best is None or cnt > best[0]):
            best = (cnt, mask)
    if not best:
        return rows
    return {items[i][0]: items[i][1] for i in range(n) if best[1] >> i & 1}


def revenue_table(facts, fy_end: str):
    end = date.fromisoformat(fy_end)

    def annual(s, e):
        return s and e and abs((date.fromisoformat(e) - end).days) <= 10 and 340 <= (date.fromisoformat(e) - date.fromisoformat(s)).days <= 380

    total = None
    by_axis = {}
    for name, val, s, e, dims in facts:
        if not annual(s, e):
            continue
        if not dims and name in REV_CONCEPTS:
            total = max(total or 0, val)
            continue
        pd = _primary_dim(dims)
        if not pd:
            continue
        axis, member = pd
        if axis not in (SEG_AXIS, PROD_AXIS):
            continue
        rec = by_axis.setdefault(axis, {}).setdefault(member, {"rev": None, "op": None})
        if name in REV_CONCEPTS:
            rec["rev"] = max(rec["rev"] or 0, val)
        elif name in OP_CONCEPTS:
            rec["op"] = val
    note = None
    choice = None
    for axis in (SEG_AXIS, PROD_AXIS):
        rows = {m: r for m, r in by_axis.get(axis, {}).items() if r["rev"]}
        if total:
            rows = _complete_subset(rows, total)
        if len(rows) < 2:
            continue
        s = sum(r["rev"] for r in rows.values())
        covers = total and abs(s - total) / total < 0.02
        all_geo = all(GEO.search(humanize(m)) for m in rows)
        if axis == SEG_AXIS and all_geo:
            note = "ASC 280 segments are purely geographic, so the Mapper uses the product/service revenue table instead."
            continue
        if covers or (total is None):
            choice = (axis, rows)
            break
    if not choice:
        return {"axis": None, "lines": [], "reportedTotal": total, "note": note or "No complete segment or product table found in XBRL; profile treated as pure-play on the SIC anchor."}
    axis, rows = choice
    lines = [{"member": m, "name": humanize(m), "rev": r["rev"] / 1e6, "op": (r["op"] / 1e6) if r["op"] is not None and axis == SEG_AXIS else None}
             for m, r in sorted(rows.items(), key=lambda kv: -kv[1]["rev"])]
    return {"axis": "ASC 280 business segments" if axis == SEG_AXIS else "Disaggregated revenue (product / service)",
            "lines": lines, "reportedTotal": total / 1e6 if total else sum(l["rev"] for l in lines), "note": note}


def tag_lines(lines, anchor, company_name=""):
    """Forced selection from the 24 fixed IDs. LLM first (if configured), deterministic fallback."""
    tags = None
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key and lines:
        try:
            tags = _llm_tags(lines, anchor, company_name, key)
        except Exception:
            tags = None
    for i, l in enumerate(lines):
        l["tag"] = tags[i] if tags and tags[i] in SUB_NAMES else tag_line(l["name"], anchor)
        l["tagger"] = "llm" if tags and tags[i] in SUB_NAMES else "rules"
    return lines


def _llm_tags(lines, anchor, company, key):
    ids = "\n".join(f"{k}: {v}" for k, v in SUB_NAMES.items())
    items = "\n".join(f"{i}. {l['name']} (${l['rev']:,.0f}M)" for i, l in enumerate(lines))
    prompt = (f"Company: {company}. SIC-anchored primary sub-industry: {anchor}.\n"
              f"Assign each 10-K revenue line exactly one ID from this fixed list. Never invent IDs.\n{ids}\n\nLines:\n{items}\n\n"
              f'Reply with JSON only: {{"tags": ["S1.2", ...]}} in line order.')
    body = json.dumps({"model": os.environ.get("RF_MAPPER_MODEL", "claude-haiku-5-5"), "max_tokens": 300, "temperature": 0,
                       "messages": [{"role": "user", "content": prompt}]}).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, headers={
        "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        text = json.loads(r.read())["content"][0]["text"]
    tags = json.loads(text[text.find("{"): text.rfind("}") + 1])["tags"]
    return tags if len(tags) == len(lines) else None
