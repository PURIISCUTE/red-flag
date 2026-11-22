"""Turn SEC companyfacts XBRL into the engine's input fields: 4 fiscal years (3 graded + 1 base) and TTM.

Field keys match frontend/src/engine/engine.js. Values in $ millions; share counts in thousands."""
from datetime import date

# field -> ordered list of us-gaap concepts (first one found wins, per fiscal year)
FLOW = {
    "rev": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet", "RevenuesNetOfInterestExpense"],
    "cogs": ["CostOfGoodsAndServicesSold", "CostOfRevenue", "CostOfGoodsSold", "CostOfGoodsAndServiceExcludingDepreciationDepletionAndAmortization"],
    "gp": ["GrossProfit"],
    "sga": ["SellingGeneralAndAdministrativeExpense"],
    "sm": ["SellingAndMarketingExpense"],
    "ga": ["GeneralAndAdministrativeExpense"],
    "ebit": ["OperatingIncomeLoss"],
    "nonop": ["NonoperatingIncomeExpense", "OtherNonoperatingIncomeExpense"],
    "pretax": ["IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
               "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
               "IncomeLossFromContinuingOperationsBeforeIncomeTaxesDomestic"],
    "tax": ["IncomeTaxExpenseBenefit"],
    "ni": ["NetIncomeLoss", "ProfitLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"],
    "da": ["DepreciationDepletionAndAmortization", "DepreciationAndAmortization", "DepreciationAmortizationAndAccretionNet"],
    "dep": ["Depreciation"],
    "sbc": ["ShareBasedCompensation", "AllocatedShareBasedCompensationExpense"],
    "cfo": ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
    "capex": ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
    "buyb": ["PaymentsForRepurchaseOfCommonStock"],
    "dwcRaw": ["IncreaseDecreaseInOperatingCapital"],
    "intexp": ["InterestExpense", "InterestExpenseNonoperating", "InterestExpenseDebt", "InterestAndDebtExpense"],
    "restr": ["RestructuringCharges", "RestructuringCosts"],
    "pension": ["DefinedBenefitPlanExpectedReturnOnPlanAssets"],
    "fx": ["ForeignCurrencyTransactionGainLossBeforeTax"],
    "rnd": ["ResearchAndDevelopmentExpense", "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost"],
    "capSw": ["PaymentsToDevelopSoftware"],
    "nii": ["InterestIncomeExpenseNet", "InterestIncomeExpenseAfterProvisionForLoanLoss"],
    "nonIntInc": ["NoninterestIncome"],
    "l3gain": ["FairValueMeasurementWithUnobservableInputsReconciliationRecurringBasisAssetGainLossIncludedInEarnings"],
    "leaseInc": ["OperatingLeaseLeaseIncome", "OperatingLeasesIncomeStatementLeaseRevenue"],
}
INSTANT = {
    "cash": ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents", "Cash"],
    "ar": ["AccountsReceivableNetCurrent", "ReceivablesNetCurrent"],
    "inv": ["InventoryNet", "InventoryGross"],
    "invFG": ["InventoryFinishedGoodsNetOfReserves", "InventoryFinishedGoods"],
    "invRM": ["InventoryRawMaterialsNetOfReserves", "InventoryRawMaterials", "InventoryRawMaterialsAndSuppliesNetOfReserves"],
    "ca": ["AssetsCurrent"],
    "ppe": ["PropertyPlantAndEquipmentNet", "PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulatedDepreciationAndAmortization"],
    "ppeg": ["PropertyPlantAndEquipmentGross"],
    "cip": ["ConstructionInProgressGross"],
    "ta": ["Assets"],
    "cl": ["LiabilitiesCurrent"],
    "cp": ["CommercialPaper", "ShortTermBorrowings"],
    "tdc": ["LongTermDebtCurrent", "DebtCurrent", "LongTermDebtAndCapitalLeaseObligationsCurrent"],
    "tdn": ["LongTermDebtNoncurrent", "LongTermDebtAndCapitalLeaseObligations", "LongTermDebt"],
    "tl": ["Liabilities"],
    "lse": ["LiabilitiesAndStockholdersEquity"],
    "re": ["RetainedEarningsAccumulatedDeficit"],
    "eq": ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
    "eqTotal": ["StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest", "StockholdersEquity"],
    "dr": ["ContractWithCustomerLiabilityCurrent", "DeferredRevenueCurrent"],
    "contractAssets": ["ContractWithCustomerAssetNetCurrent"],
    "unbilled": ["UnbilledReceivablesCurrent"],
    "goodwill": ["Goodwill"],
    "intang": ["IntangibleAssetsNetExcludingGoodwill", "FiniteLivedIntangibleAssetsNet"],
    "utb": ["UnrecognizedTaxBenefits"],
    "dtag": ["DeferredTaxAssetsGross"],
    "va": ["DeferredTaxAssetsValuationAllowance"],
    "leaseCur": ["OperatingLeaseLiabilityCurrent"],
    "po12": ["UnrecordedUnconditionalPurchaseObligationDueWithinOneYear", "PurchaseObligationDueInNextTwelveMonths", "UnrecordedUnconditionalPurchaseObligationBalanceSheetAmount"],
    "lossAcc": ["LossContingencyAccrualAtCarryingValue"],
    "prepaid": ["PrepaidExpenseAndOtherAssetsCurrent", "PrepaidExpenseCurrent"],
    "ap": ["AccountsPayableCurrent", "AccountsPayableAndAccruedLiabilitiesCurrent"],
    "accrued": ["AccruedLiabilitiesCurrent"],
    "retainage": ["ContractReceivableRetainage"],
    "nonaccrual": ["FinancingReceivableExcludingAccruedInterestNonaccrual", "FinancingReceivableRecordedInvestmentNonaccrualStatus"],
    "loans": ["FinancingReceivableExcludingAccruedInterestBeforeAllowanceForCreditLoss", "LoansAndLeasesReceivableGrossCarryingAmount", "LoansAndLeasesReceivableNetReportedAmount"],
    "restrCash": ["RestrictedCashAndCashEquivalentsAtCarryingValue", "RestrictedCashAndCashEquivalents", "RestrictedCash"],
    "slRent": ["DeferredRentReceivablesNet", "StraightLineRentAdjustments"],
    "tenantAllow": ["DeferredCostsLeasingNetNoncurrent"],
}
SHARES = {"dil": ["WeightedAverageNumberOfDilutedSharesOutstanding"]}
DEI_SHARES = ["EntityCommonStockSharesOutstanding"]


def _d(s):
    return date.fromisoformat(s)


def _days(e):
    return (_d(e["end"]) - _d(e["start"])).days if e.get("start") else 0


def _units(facts, concept, unit):
    for ns in ("us-gaap", "ifrs-full"):
        node = facts.get("facts", {}).get(ns, {}).get(concept)
        if node and unit in node.get("units", {}):
            return node["units"][unit]
    return []


def _annual_flows(entries):
    """end-date -> value for ~12-month periods; the most recently filed figure wins (captures restatements)."""
    out = {}
    for e in entries:
        if 340 <= _days(e) <= 380 and e.get("form", "").startswith(("10-K", "20-F", "40-F")):
            if e["end"] not in out or e["filed"] >= out[e["end"]][1]:
                out[e["end"]] = (e["val"], e["filed"])
    return {k: v[0] for k, v in out.items()}


def _instants(entries):
    out = {}
    for e in entries:
        if "start" not in e:
            if e["end"] not in out or e["filed"] >= out[e["end"]][1]:
                out[e["end"]] = (e["val"], e["filed"], e.get("form", ""))
    return out


def fiscal_year_ends(facts):
    """Fiscal-year end dates from annual revenue / net income / CFO."""
    ends = set()
    for c in FLOW["rev"] + FLOW["ni"] + FLOW["cfo"]:
        ends |= set(_annual_flows(_units(facts, c, "USD")).keys())
    # collapse dates within 10 days (52/53-week years)
    ends = sorted(ends)
    merged = []
    for e in ends:
        if merged and (_d(e) - _d(merged[-1])).days < 300:
            merged[-1] = e
        else:
            merged.append(e)
    return merged


def _near(d_map, target, tol=10):
    t = _d(target)
    best = None
    for k, v in d_map.items():
        diff = abs((_d(k) - t).days)
        if diff <= tol and (best is None or diff < best[0]):
            best = (diff, v)
    return best[1] if best else None


def extract(facts, n_years=4):
    ends = fiscal_year_ends(facts)[-n_years:]
    fin, src = {}, {}
    for end in ends:
        fy = _d(end).year
        row, rsrc = {}, {}
        for field, concepts in FLOW.items():
            for c in concepts:
                v = _near(_annual_flows(_units(facts, c, "USD")), end)
                if v is not None:
                    row[field], rsrc[field] = v / 1e6, c
                    break
        for field, concepts in INSTANT.items():
            for c in concepts:
                v = _near({k: x[0] for k, x in _instants(_units(facts, c, "USD")).items()}, end)
                if v is not None:
                    row[field], rsrc[field] = v / 1e6, c
                    break
        for field, concepts in SHARES.items():
            for c in concepts:
                v = _near(_annual_flows(_units(facts, c, "shares")), end)
                if v is not None:
                    row[field], rsrc[field] = v / 1e3, c
                    break
        _derive(row)
        fin[fy] = row
        src[fy] = rsrc
    years = sorted(fin)
    return {"fin": fin, "years": years[-3:], "allYears": years, "fyEnds": ends, "concepts": src, "ttm": ttm(facts, ends[-1] if ends else None)}


def _derive(r):
    if "gp" not in r and "rev" in r and "cogs" in r:
        r["gp"] = r["rev"] - r["cogs"]
    if "sga" not in r and ("sm" in r or "ga" in r):
        r["sga"] = r.get("sm", 0) + r.get("ga", 0)
    if "tl" not in r and "lse" in r and "eqTotal" in r:
        r["tl"] = r["lse"] - r["eqTotal"]
    if "nonop" not in r and "pretax" in r and "ebit" in r:
        r["nonop"] = r["pretax"] - r["ebit"]
    if "dwcRaw" in r:  # XBRL IncreaseDecrease is positive when working capital grows -> negative cash effect
        r["dwc"] = -r["dwcRaw"]
    elif all(k in r for k in ("cfo", "ni", "da")):  # fallback: cash effect of working capital ~ CFO - NI - D&A - SBC
        r["dwc"] = r["cfo"] - r["ni"] - r["da"] - r.get("sbc", 0)
        r["_dwcDerived"] = True
    if "restr" not in r:
        r["restr"] = 0
    if "da" not in r and "dep" in r:
        r["da"] = r["dep"]


def ttm(facts, last_fy_end):
    """Trailing twelve months: latest 10-Q YTD + last FY - prior-year YTD; balances = latest 10-Q."""
    if not last_fy_end:
        return None
    out, period = {}, None
    for field, concepts in FLOW.items():
        for c in concepts:
            ents = [e for e in _units(facts, c, "USD") if e.get("form", "").startswith("10-Q") and e.get("start")]
            ytd = [e for e in ents if _d(e["end"]) > _d(last_fy_end) and abs((_d(e["start"]) - _d(last_fy_end)).days) <= 10]
            if not ytd:
                continue
            cur = max(ytd, key=lambda e: (e["end"], e["filed"]))
            fyv = _near(_annual_flows(_units(facts, c, "USD")), last_fy_end)
            prior = [e for e in ents if abs(_days(e) - _days(cur)) <= 10 and abs((_d(cur["end"]) - _d(e["end"])).days - 365) <= 10]
            if fyv is None or not prior:
                continue
            out[field] = (cur["val"] + fyv - prior[0]["val"]) / 1e6
            period = cur["end"]
            break
    for field, concepts in INSTANT.items():
        for c in concepts:
            inst = _instants(_units(facts, c, "USD"))
            q = [(k, v) for k, v in inst.items() if v[2].startswith("10-Q") and _d(k) > _d(last_fy_end)]
            if q:
                k, v = max(q)
                out[field] = v[0] / 1e6
                period = period or k
                break
    if not out:
        return None
    _derive(out)
    out["_asOf"] = period
    return out


def shares_outstanding(facts):
    node = facts.get("facts", {}).get("dei", {}).get(DEI_SHARES[0])
    if not node:
        return None
    ents = node["units"].get("shares", [])
    return max(ents, key=lambda e: e["end"])["val"] if ents else None
