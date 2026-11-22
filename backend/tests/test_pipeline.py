"""Offline test: synthetic SEC companyfacts + XBRL instance built from Apple's real 10-K figures."""
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import extract, segments
from app.taxonomy import sic_anchor

ENDS = {2022: ("2021-09-26", "2022-09-24"), 2023: ("2022-09-25", "2023-09-30"), 2024: ("2023-10-01", "2024-09-28"), 2025: ("2024-09-29", "2025-09-27")}
F = {2022: dict(Revenues=394328, CostOfGoodsAndServicesSold=223546, GrossProfit=170782, SellingGeneralAndAdministrativeExpense=25094, OperatingIncomeLoss=119437, NetIncomeLoss=99803, NetCashProvidedByUsedInOperatingActivities=122151, AccountsReceivableNetCurrent=28184, InventoryNet=4946, AssetsCurrent=135405, Assets=352755, LiabilitiesCurrent=153982, Liabilities=302083),
     2023: dict(Revenues=383285, CostOfGoodsAndServicesSold=214137, GrossProfit=169148, SellingGeneralAndAdministrativeExpense=24932, OperatingIncomeLoss=114301, NetIncomeLoss=96995, NetCashProvidedByUsedInOperatingActivities=110543, AccountsReceivableNetCurrent=29508, InventoryNet=6331, AssetsCurrent=143566, Assets=352583, LiabilitiesCurrent=145308, Liabilities=290437, IncreaseDecreaseInOperatingCapital=6577),
     2024: dict(Revenues=391035, CostOfGoodsAndServicesSold=210352, GrossProfit=180683, SellingGeneralAndAdministrativeExpense=26097, OperatingIncomeLoss=123216, NetIncomeLoss=93736, NetCashProvidedByUsedInOperatingActivities=118254, AccountsReceivableNetCurrent=33410, InventoryNet=7286, AssetsCurrent=152987, Assets=364980, LiabilitiesCurrent=176392, Liabilities=308030),
     2025: dict(Revenues=416161, CostOfGoodsAndServicesSold=220960, GrossProfit=195201, SellingGeneralAndAdministrativeExpense=27601, OperatingIncomeLoss=133050, NetIncomeLoss=112010, NetCashProvidedByUsedInOperatingActivities=111482, AccountsReceivableNetCurrent=39777, InventoryNet=5718, AssetsCurrent=147957, Assets=359241, LiabilitiesCurrent=165631, Liabilities=285508, IncreaseDecreaseInOperatingCapital=25000)}
INST = {"AccountsReceivableNetCurrent", "InventoryNet", "AssetsCurrent", "Assets", "LiabilitiesCurrent", "Liabilities"}
facts = {"facts": {"us-gaap": {}, "dei": {"EntityCommonStockSharesOutstanding": {"units": {"shares": [{"end": "2025-10-17", "val": 14776353000}]}}}}}
for y, row in F.items():
    s, e = ENDS[y]
    for c, v in row.items():
        ent = {"end": e, "val": v * 1e6, "form": "10-K", "filed": f"{y}-11-01", "fy": y, "fp": "FY"}
        if c not in INST: ent["start"] = s
        facts["facts"]["us-gaap"].setdefault(c, {"units": {"USD": []}})["units"]["USD"].append(ent)
# 10-Q YTD for TTM: Q1 FY2026 (13 weeks) and prior-year Q1
for c, cur, prior in [("Revenues", 140000, 124300), ("NetIncomeLoss", 40000, 36330)]:
    u = facts["facts"]["us-gaap"][c]["units"]["USD"]
    u.append({"start": "2025-09-28", "end": "2025-12-27", "val": cur * 1e6, "form": "10-Q", "filed": "2026-01-30"})
    u.append({"start": "2024-09-29", "end": "2024-12-28", "val": prior * 1e6, "form": "10-Q", "filed": "2025-01-31"})

d = extract.extract(facts)
assert d["years"] == [2023, 2024, 2025], d["years"]
f25 = d["fin"][2025]
assert round(f25["rev"]) == 416161 and round(f25["tl"]) == 285508 and round(f25["dwc"]) == -25000, f25
assert round(d["ttm"]["rev"]) == 416161 + 140000 - 124300, d["ttm"]
print("extract OK  years", d["years"], " TTM rev", round(d["ttm"]["rev"]), "as of", d["ttm"]["_asOf"])
print("shares", extract.shares_outstanding(facts))

# XBRL instance: geographic segments + product/service axis
def ctx(i, dims): 
    seg = "".join(f'<xbrldi:explicitMember dimension="{a}">{m}</xbrldi:explicitMember>' for a, m in dims)
    seg = f"<xbrli:segment>{seg}</xbrli:segment>" if dims else ""
    return f'<xbrli:context id="c{i}"><xbrli:entity><xbrli:identifier scheme="x">1</xbrli:identifier>{seg}</xbrli:entity><xbrli:period><xbrli:startDate>2024-09-29</xbrli:startDate><xbrli:endDate>2025-09-27</xbrli:endDate></xbrli:period></xbrli:context>'
rows = [([], 416161), ([("us-gaap:StatementBusinessSegmentsAxis", "aapl:AmericasSegmentMember")], 178353), ([("us-gaap:StatementBusinessSegmentsAxis", "aapl:EuropeSegmentMember")], 111032),
        ([("us-gaap:StatementBusinessSegmentsAxis", "aapl:GreaterChinaSegmentMember")], 64377), ([("us-gaap:StatementBusinessSegmentsAxis", "aapl:JapanSegmentMember")], 28703), ([("us-gaap:StatementBusinessSegmentsAxis", "aapl:RestOfAsiaPacificSegmentMember")], 33696),
        ([("srt:ProductOrServiceAxis", "us-gaap:IPhoneMember")], 209586), ([("srt:ProductOrServiceAxis", "aapl:MacMember")], 33708), ([("srt:ProductOrServiceAxis", "aapl:IPadMember")], 28023),
        ([("srt:ProductOrServiceAxis", "aapl:WearablesHomeandAccessoriesMember")], 35686), ([("srt:ProductOrServiceAxis", "us-gaap:ServiceMember")], 109158), ([("srt:ProductOrServiceAxis", "us-gaap:ProductMember")], 307003)]
xml = '<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:xbrldi="http://xbrl.org/2006/xbrldi" xmlns:us-gaap="http://fasb.org/us-gaap/2025">'
xml += "".join(ctx(i, d_) for i, (d_, _) in enumerate(rows))
xml += "".join(f'<us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax contextRef="c{i}" unitRef="usd" decimals="-6">{v*1_000_000}</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>' for i, (_, v) in enumerate(rows))
xml += "</xbrli:xbrl>"
t = segments.revenue_table(segments.parse_instance(xml.encode()), "2025-09-27")
print("axis:", t["axis"], "| note:", t["note"])
lines = segments.tag_lines(t["lines"], sic_anchor(3571), "Apple Inc.")
for l in lines: print(f"  {l['name']:<34} {l['rev']:>10,.0f}  -> {l['tag']} ({l['tagger']})")
