"""Fixed 24-sub-industry taxonomy helpers: SIC anchor and the deterministic line-item tagger."""
import re

SUB_NAMES = {
    "S1.1": "Enterprise SaaS & Cloud Software", "S1.2": "Hardware, Semiconductors & Equipment",
    "S1.3": "Internet Platforms & Marketplaces", "S1.4": "IT Services & Systems Integration",
    "S2.1": "Omnichannel & Brick-and-Mortar Retail", "S2.2": "Pure-Play E-Commerce & DTC",
    "S2.3": "Consumer Packaged Goods (CPG) & Food", "S2.4": "Apparel, Luxury & Footwear",
    "S3.1": "Aerospace, Defense & Capital Goods", "S3.2": "Automotive, EV & Transportation",
    "S3.3": "Chemicals, Mining & Basic Materials", "S3.4": "Freight, Logistics & Supply Chain",
    "S4.1": "Commercial Pharmaceuticals", "S4.2": "Clinical Biotech & Therapeutics",
    "S4.3": "Medical Devices & Diagnostic Tech", "S4.4": "Healthcare Facilities & Managed Care",
    "S5.1": "Oil & Gas E&P (Upstream)", "S5.2": "Midstream & Pipeline Infrastructure",
    "S5.3": "Regulated Utilities & Power Gen", "S5.4": "Clean Energy & Transition Infrastructure",
    "S6.1": "Commercial & Regional Banking", "S6.2": "Investment Banking & Asset Management",
    "S6.3": "Insurance Underwriters (P&C / Life)", "S6.4": "Real Estate Investment Trusts (REITs)",
}

# Exact SIC codes first, then ranges. Immutable lookup = no drift between runs.
SIC_EXACT = {
    3571: "S1.2", 3572: "S1.2", 3576: "S1.2", 3577: "S1.2", 3661: "S1.2", 3663: "S1.2", 3672: "S1.2", 3674: "S1.2", 3825: "S1.2",
    7372: "S1.1", 7370: "S1.3", 7374: "S1.3", 7371: "S1.4", 7373: "S1.4", 7379: "S1.4",
    5961: "S2.2", 2834: "S4.1", 2835: "S4.3", 2836: "S4.2", 3841: "S4.3", 3842: "S4.3", 3845: "S4.3", 3851: "S4.3",
    6324: "S4.4", 8000: "S4.4", 8011: "S4.4", 8062: "S4.4", 8071: "S4.4", 8090: "S4.4", 5912: "S2.1",
    3711: "S3.2", 3713: "S3.2", 3714: "S3.2", 3716: "S3.2", 3690: "S5.4",
    1311: "S5.1", 1381: "S5.1", 1382: "S5.1", 2911: "S5.1", 4922: "S5.2", 4923: "S5.2", 4924: "S5.2", 4610: "S5.2",
    6798: "S6.4", 6022: "S6.1", 6021: "S6.1", 6035: "S6.1", 6036: "S6.1", 6141: "S6.1", 6199: "S6.2", 6211: "S6.2", 6282: "S6.2",
    6311: "S6.3", 6321: "S6.3", 6331: "S6.3", 6351: "S6.3", 6361: "S6.3", 6399: "S6.3", 6411: "S6.3", 7389: "S1.4",
}
SIC_RANGES = [
    (100, 999, "S2.3"), (1000, 1299, "S3.3"), (1300, 1399, "S5.1"), (1400, 1499, "S3.3"), (1500, 1799, "S3.1"),
    (2000, 2199, "S2.3"), (2200, 2399, "S2.4"), (2400, 2799, "S3.3"), (2800, 2829, "S3.3"), (2830, 2834, "S4.1"),
    (2835, 2836, "S4.2"), (2837, 2899, "S2.3"), (2900, 2999, "S5.1"), (3000, 3139, "S3.3"), (3140, 3199, "S2.4"),
    (3200, 3499, "S3.3"), (3500, 3569, "S3.1"), (3570, 3579, "S1.2"), (3580, 3659, "S3.1"), (3660, 3699, "S1.2"),
    (3700, 3719, "S3.2"), (3720, 3799, "S3.1"), (3800, 3839, "S1.2"), (3840, 3851, "S4.3"), (3852, 3999, "S2.3"),
    (4000, 4799, "S3.4"), (4800, 4899, "S1.3"), (4900, 4919, "S5.3"), (4920, 4929, "S5.2"), (4930, 4949, "S5.3"),
    (4950, 4999, "S5.3"), (5000, 5199, "S3.4"), (5200, 5960, "S2.1"), (5961, 5961, "S2.2"), (5962, 5999, "S2.1"),
    (6000, 6199, "S6.1"), (6200, 6299, "S6.2"), (6300, 6411, "S6.3"), (6500, 6799, "S6.4"), (7000, 7369, "S1.4"),
    (7370, 7379, "S1.1"), (7380, 7999, "S1.4"), (8000, 8099, "S4.4"), (8100, 8999, "S1.4"),
]


def sic_anchor(sic) -> str | None:
    try:
        s = int(sic)
    except (TypeError, ValueError):
        return None
    if s in SIC_EXACT:
        return SIC_EXACT[s]
    for lo, hi, sub in SIC_RANGES:
        if lo <= s <= hi:
            return sub
    return None


# Keyword tagger: (regex, sub-industry). First match wins. Anything unmatched inherits the SIC anchor.
RULES = [
    (r"\b(pharma|biopharma|vaccine|drug|oncology|immunology|primary care|specialty care)", "S4.1"),
    (r"\b(biotech|therapeutic|gene therapy|cell therapy)", "S4.2"),
    (r"\b(medical device|med ?tech|diagnostic|surgical|orthopa|cardiovascular|medical technology|instruments)", "S4.3"),
    (r"\b(health ?care services|managed care|health insurance|hospital|unitedhealthcare|optum|pharmacy benefit|clinic)", "S4.4"),
    (r"\b(renewable|solar|wind|energy generation|energy storage|clean energy|hydrogen)", "S5.4"),
    (r"\b(aws|amazon web services|azure|cloud|saas|software|subscription|productivity and business|intelligent cloud|license)", "S1.1"),
    (r"\b(advertis|search|marketplace|social|third.party seller)", "S1.3"),
    (r"\b(consulting|outsourc|it services|technology services|managed services|systems integration)", "S1.4"),
    (r"\b(iphone|ipad|mac\b|wearable|hardware|semiconductor|chip|processor|gpu|graphics|compute and networking|data center|storage systems|networking|devices?)\b", "S1.2"),
    (r"\b(online stores?|e.?commerce|direct.to.consumer|dtc|digital commerce)", "S2.2"),
    (r"\b(stores?|retail|warehouse club|sam.s club|grocery)\b", "S2.1"),
    (r"\b(food|beverage|snack|household|personal care|beauty|tobacco|grooming|baby|fabric)", "S2.3"),
    (r"\b(apparel|footwear|luxury|fashion|jewel|accessor(y|ies) brand)", "S2.4"),
    (r"\b(aerospace|defen[cs]e|aircraft|aviation|space|industrial machinery|capital goods|construction equipment)", "S3.1"),
    (r"\b(automotive|vehicle|ev\b|car\b|trucks?)", "S3.2"),
    (r"\b(chemical|mining|metals?|materials|steel|copper|lithium|fertili)", "S3.3"),
    (r"\b(freight|logistic|shipping|transportation|delivery|parcel|rail)", "S3.4"),
    (r"\b(exploration|upstream|production|crude|natural gas production)", "S5.1"),
    (r"\b(midstream|pipeline|gathering|gathering system)", "S5.2"),
    (r"\b(utility|utilities|electric|regulated)", "S5.3"),
    (r"\b(consumer banking|commercial banking|retail banking|community bank|card services|lending)", "S6.1"),
    (r"\b(asset management|wealth|investment bank|markets|brokerage|securities services|trading)", "S6.2"),
    (r"\b(insurance|underwriting|reinsurance|annuit|property and casualty|life)", "S6.3"),
    (r"\b(real estate|reit|properties|leasing of property)", "S6.4"),
]


def humanize(member_qname: str) -> str:
    name = member_qname.split(":")[-1]
    name = re.sub(r"Member$", "", name)
    name = re.sub(r"([a-z])and([A-Z])", r"\1And\2", name)
    name = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", name)
    return name.replace("And", "and").strip()


def tag_line(label: str, anchor: str | None) -> str:
    text = label.lower()
    # Context rule: a "Services" line at a hardware company is its digital/software business.
    if anchor == "S1.2" and re.search(r"\bservices?\b", text):
        return "S1.1"
    for pat, sub in RULES:
        if re.search(pat, text):
            # Never let a generic word pull a line out of the anchor's own major industry unless it is a different business.
            return sub
    return anchor or "S1.4"
