/* RedFlag Terminal — deterministic forensic engine (no AI in this file). */
(function (root) {
'use strict';

/* ---------- Taxonomy helpers ---------- */
// Asset-intensity ("physicality") of each sub-industry, 0 = pure digital / financial, 1 = heavy physical.
// Used ONLY to decide which side of a hybrid owns a physical or a digital category.
const PHYSICALITY = {
  'S1.1':0.10,'S1.2':0.90,'S1.3':0.20,'S1.4':0.25,
  'S2.1':0.90,'S2.2':0.60,'S2.3':0.90,'S2.4':0.80,
  'S3.1':0.95,'S3.2':0.95,'S3.3':0.95,'S3.4':0.90,
  'S4.1':0.60,'S4.2':0.30,'S4.3':0.80,'S4.4':0.70,
  'S5.1':0.95,'S5.2':0.95,'S5.3':0.95,'S5.4':0.90,
  'S6.1':0.10,'S6.2':0.10,'S6.3':0.10,'S6.4':0.95
};
// Category routing class (from the Architecture spec, Apple allocation matrix).
const CAT_CLASS = {
  'CAT-01':'shared','CAT-06':'shared',
  'CAT-02':'physical','CAT-03':'physical','CAT-04':'physical','CAT-07':'physical',
  'CAT-09':'physical','CAT-10':'physical','CAT-11':'physical',
  'CAT-05':'digital','CAT-08':'digital','CAT-12':'digital'
};
const CATS = ['CAT-01','CAT-02','CAT-03','CAT-04','CAT-05','CAT-06','CAT-07','CAT-08','CAT-09','CAT-10','CAT-11','CAT-12'];

// SIC anchor -> primary sub-industry (immutable lookup; extend as needed).
const SIC_MAP = {
  '3571':'S1.2','3572':'S1.2','3576':'S1.2','3577':'S1.2','3661':'S1.2','3663':'S1.2','3674':'S1.2','3672':'S1.2','3825':'S1.2',
  '7372':'S1.1','7370':'S1.3','7371':'S1.4','7373':'S1.4','7374':'S1.3','7379':'S1.4',
  '5311':'S2.1','5331':'S2.1','5411':'S2.1','5900':'S2.1','5912':'S2.1','5961':'S2.2',
  '2000':'S2.3','2080':'S2.3','2086':'S2.3','2844':'S2.3','2111':'S2.3','2300':'S2.4','3021':'S2.4','5651':'S2.4',
  '3721':'S3.1','3812':'S3.1','3711':'S3.2','3714':'S3.2','2800':'S3.3','1000':'S3.3','4213':'S3.4','4512':'S3.4','4011':'S3.4',
  '2834':'S4.1','2836':'S4.2','3841':'S4.3','3845':'S4.3','8062':'S4.4','6324':'S4.4',
  '1311':'S5.1','4922':'S5.2','4911':'S5.3','4931':'S5.3','3690':'S5.4',
  '6021':'S6.1','6022':'S6.1','6211':'S6.2','6282':'S6.2','6331':'S6.3','6311':'S6.3','6798':'S6.4'
};

/* ---------- Step 1: aggregator + 20% materiality gate ---------- */
function aggregate(lines, sicSub) {
  const total = lines.reduce((s, l) => s + (+l.rev || 0), 0);
  const opTotal = lines.reduce((s, l) => s + (l.op == null ? 0 : +l.op), 0);
  const hasOp = lines.some(l => l.op != null && l.op !== '');
  const buckets = {};
  lines.forEach(l => {
    const b = buckets[l.tag] || (buckets[l.tag] = { sub: l.tag, rev: 0, op: 0, lines: [] });
    b.rev += +l.rev || 0; b.op += l.op == null ? 0 : +l.op; b.lines.push(l.name);
  });
  const list = Object.values(buckets).map(b => ({
    ...b, revPct: total ? b.rev / total : 0, opPct: hasOp && opTotal > 0 ? b.op / opTotal : null
  })).sort((a, b) => b.rev - a.rev);
  // S1: SIC anchor wins if the anchored bucket exists; otherwise the largest revenue bucket.
  let s1 = list.find(b => b.sub === sicSub) || list[0];
  const rest = list.filter(b => b !== s1);
  rest.forEach(b => { b.gate = b.revPct >= 0.20 ? 'revenue' : (b.opPct != null && b.opPct >= 0.20 ? 'operating profit' : null); });
  const qualifying = rest.filter(b => b.gate);
  const s2 = qualifying[0] || null; // spec supports S1 + one S2; largest qualifying bucket wins
  return { total, list, s1, s2, completeness: total, anchorAgrees: !!list.find(b => b.sub === sicSub) && list[0].sub === sicSub };
}

/* ---------- Step 2: category routing ---------- */
function route(s1, s2) {
  const plan = {};
  CATS.forEach(c => {
    if (!s2) { plan[c] = [s1]; return; }
    const cls = CAT_CLASS[c];
    if (cls === 'shared') { plan[c] = [s1, s2]; return; }
    const p1 = PHYSICALITY[s1], p2 = PHYSICALITY[s2];
    if (Math.abs(p1 - p2) < 0.15) { plan[c] = [s1]; return; } // same nature -> dominant business owns it
    const physSide = p1 >= p2 ? s1 : s2, digSide = p1 >= p2 ? s2 : s1;
    plan[c] = [cls === 'physical' ? physSide : digSide];
  });
  plan['CAT-13'] = ['ALL'];
  return plan;
}
function selectFlags(lib, plan) {
  const out = [];
  Object.entries(plan).forEach(([cat, subs]) => subs.forEach(sub => lib
    .filter(f => f.cat === cat && f.sub === sub).forEach(f => out.push(f))));
  // Duplicate detection: identical formula + thresholds pulled from both sides count once.
  const seen = {};
  out.forEach(f => {
    const k = f.cat + '|' + f.formula + '|' + f.g + '|' + f.y + '|' + f.r;
    if (seen[k]) f._dupOf = seen[k]; else { seen[k] = f.id; f._dupOf = null; }
  });
  return out.map(f => ({ ...f }));
}

/* ---------- Step 3: grading ---------- */
const pct = (a, b) => (a == null || b == null || b === 0) ? null : (a - b) / Math.abs(b);
const nz = v => v !== null && v !== undefined && !Number.isNaN(v);
function band(v, gFn, yFn) { if (!nz(v)) return null; if (gFn(v)) return 'G'; if (yFn(v)) return 'Y'; return 'R'; }
const debt = F => nz(F.cp) || nz(F.tdc) || nz(F.tdn) ? (F.cp || 0) + (F.tdc || 0) + (F.tdn || 0) : null;
const stDebt = F => (F.cp || 0) + (F.tdc || 0);
const noa = F => (F.ca - F.cash) - (F.cl - stDebt(F));

// Each evaluator: (D, y) -> value for fiscal year y (D[y], D[y-1] available). spec = {fmt, grade(vals, D, years)}.
const EV = {};
function def(formula, fmt, valueFn, gradeFn, needs) { EV[formula] = { fmt, valueFn, gradeFn, needs: needs || [] }; }
const last = (vals, ys) => vals[ys[ys.length - 1]];

def('% YoY Change in AR - % YoY Change in Revenues', 'pts', (D, y) => { const a = pct(D[y].ar, D[y-1]?.ar), b = pct(D[y].rev, D[y-1]?.rev); return nz(a) && nz(b) ? (a - b) * 100 : null; },
  (v) => band(v, x => x <= 0, x => x <= 15), ['ar','rev']);
def('UnbilledReceivables / Total Receivables', '%', (D, y) => nz(D[y].unbilled) ? D[y].unbilled / D[y].ar * 100 : null,
  v => band(v, x => x <= 10, x => x <= 20), ['unbilled']);
def('(Receivables / Revenues) * 365', 'days', (D, y) => D[y].ar / D[y].rev * 365,
  (v, vals, ys) => { const d = vals[ys[2]] - vals[ys[1]]; return band(d, x => x < 5, x => x <= 15); }, ['ar','rev']);
def('% YoY Contract Assets - % YoY Deferred Revenue', 'pts', (D, y) => { const a = pct(D[y].contractAssets, D[y-1]?.contractAssets), b = pct(D[y].dr, D[y-1]?.dr); return nz(a) && nz(b) ? (a - b) * 100 : null; },
  v => band(v, x => x <= 0, x => x <= 25), ['contractAssets','dr']);
def('(AR_t / Rev_t) / (AR_t-1 / Rev_t-1)', 'x', (D, y) => D[y-1] ? (D[y].ar / D[y].rev) / (D[y-1].ar / D[y-1].rev) : null,
  v => band(v, x => x <= 1.0, x => x <= 1.15), ['ar','rev']);
def('DeferredRevenueCurrent / Total Revenues', '%', (D, y) => D[y].dr / D[y].rev * 100,
  (v, vals, ys) => { const ch = pct(vals[ys[2]], vals[ys[1]]) * 100; return band(ch, x => x >= -5, x => x >= -20); }, ['dr','rev']);
def('OperatingCashFlow / OperatingIncomeLoss', 'x', (D, y) => D[y].cfo / D[y].ebit,
  v => band(v, x => x >= 1, x => x >= 0.75), ['cfo','ebit']);
def('(CFO - CapEx) / NetIncomeLoss', 'x', (D, y) => (D[y].cfo - D[y].capex) / D[y].ni,
  v => band(v, x => x >= 0.85, x => x >= 0.5), ['cfo','capex','ni']);
def('IncreaseDecreaseInOperatingCapital / CFO', '%', (D, y) => nz(D[y].dwc) ? D[y].dwc / D[y].cfo * 100 : null,
  v => band(v, x => x >= -10, x => x >= -35), ['dwc','cfo']);
def('(InventoryNet / CostOfGoodsAndServicesSold) * 365', 'days', (D, y) => D[y].inv / D[y].cogs * 365,
  (v, vals, ys) => band(vals[ys[2]] - vals[ys[1]], x => x < 10, x => x <= 20), ['inv','cogs']);
def('% YoY Change Finished Goods - % YoY Change Raw Materials', 'pts', (D, y) => { const a = pct(D[y].invFG, D[y-1]?.invFG), b = pct(D[y].invRM, D[y-1]?.invRM); return nz(a) && nz(b) ? (a - b) * 100 : null; },
  v => band(v, x => x <= 0, x => x <= 20), ['invFG','invRM']);
def('Inventory Growth - Gross Margin % Change', 'combo', (D, y) => D[y-1] ? { inv: pct(D[y].inv, D[y-1].inv) * 100, gm: (D[y].gp / D[y].rev - D[y-1].gp / D[y-1].rev) * 10000 } : null,
  v => !v ? null : (v.inv > 25 && v.gm < -400 ? 'R' : (v.inv > 15 && v.gm < -200 ? 'Y' : 'G')), ['inv','gp','rev']);
def('DepreciationExpense / PropertyPlantAndEquipmentGross', '%', (D, y) => nz(D[y].dep) && nz(D[y].ppeg) ? D[y].dep / D[y].ppeg * 100 : null,
  (v, vals, ys) => band((vals[ys[2]] - vals[ys[1]]) * 100, x => x > -100, x => x >= -200), ['dep','ppeg']);
def('PropertyPlantAndEquipmentConstructionInProgress / PropertyPlantAndEquipmentGross', '%', (D, y) => nz(D[y].cip) ? D[y].cip / D[y].ppeg * 100 : null,
  v => band(v, x => x <= 20, x => x <= 35), ['cip']);
def('% Change Asset Turnover - Impairments Disclosed', '%', (D, y) => D[y-1] ? pct(D[y].rev / D[y].ppe, D[y-1].rev / D[y-1].ppe) * 100 : null,
  (v, vals, D) => band(v, x => x > -15, x => x >= -25), ['rev','ppe']);
def('Goodwill / StockholdersEquity', '%', (D, y) => nz(D[y].goodwill) ? D[y].goodwill / D[y].eq * 100 : null,
  v => band(v, x => x <= 40, x => x <= 75), ['goodwill']);
def('% YoY Intangible Assets - % YoY Revenues', 'pts', (D, y) => { const a = pct(D[y].intang, D[y-1]?.intang); return nz(a) ? (a - pct(D[y].rev, D[y-1].rev)) * 100 : null; },
  v => band(v, x => x <= 0, x => x <= 20), ['intang']);
def('AcquisitionGoodwill / OperatingIncomeLoss', 'x', (D, y) => nz(D[y].goodwill) ? D[y].goodwill / D[y].ebit : null,
  v => band(v, x => x <= 3, x => true), ['goodwill']);
def('Gross Margin % YoY Change vs Inventory % Change', 'combo', (D, y) => D[y-1] ? { gm: (D[y].gp / D[y].rev - D[y-1].gp / D[y-1].rev) * 10000, inv: pct(D[y].inv, D[y-1].inv) * 100 } : null,
  v => !v ? null : (v.gm < -250 && v.inv > 15 ? 'R' : (v.gm < -100 ? 'Y' : 'G')), ['gp','rev','inv']);
def('% YoY SG&A Expense - % YoY Gross Profit', 'pts', (D, y) => D[y-1] ? (pct(D[y].sga, D[y-1].sga) - pct(D[y].gp, D[y-1].gp)) * 100 : null,
  v => band(v, x => x <= 0, x => x <= 15), ['sga','gp']);
def('Count of Consecutive Years with Restructuring Addbacks', 'yrs', (D, y) => { let n = 0; for (let k = y; D[k]; k--) { if ((D[k].restr || 0) > 0) n++; else break; } return n; },
  v => band(v, x => x <= 1, x => x <= 2), []);
def('(NOA_t - NOA_t-1) / Total Assets_t-1', '%', (D, y) => D[y-1] ? (noa(D[y]) - noa(D[y-1])) / D[y-1].ta * 100 : null,
  v => band(v, x => x <= 5, x => x <= 12), ['ca','cash','cl']);
def('Change in Working Capital Accruals / Total Revenues', '%', (D, y) => D[y-1] ? (noa(D[y]) - noa(D[y-1])) / D[y].rev * 100 : null,
  v => band(v, x => x <= 3, x => x <= 8), ['ca','cash','cl','rev']);
def('(Total Assets - PP&E - Cash) / Total Assets', '%', (D, y) => (D[y].ta - D[y].ppe - D[y].cash) / D[y].ta * 100,
  (v, vals, ys) => band(vals[ys[2]] - vals[ys[1]], x => x < 3, x => x <= 8), ['ta','ppe','cash']);
def('ShareBasedCompensation / NetCashProvidedByUsedInOperatingActivities', '%', (D, y) => D[y].sbc / D[y].cfo * 100,
  v => band(v, x => x <= 15 && x >= 0, x => x <= 35 && x >= 0), ['sbc','cfo']);
def('% YoY Change in Diluted Shares Outstanding', '%', (D, y) => D[y-1] ? pct(D[y].dil, D[y-1].dil) * 100 : null,
  v => band(v, x => x <= 0, x => x <= 3), ['dil']);
def('PaymentsForRepurchaseOfCommonStock / ShareBasedCompensation', 'x', (D, y) => D[y].buyb / D[y].sbc,
  v => band(v, x => x >= 1.5, x => x >= 0.8), ['buyb','sbc']);
def('OperatingIncomeLoss + DepreciationAndAmortization / InterestExpense', 'x', (D, y) => nz(D[y].intexp) ? (D[y].ebit + D[y].da) / D[y].intexp : null,
  v => band(v, x => x >= 4, x => x >= 2), ['intexp']);
def('(ShortTermDebt + LongTermDebt) / OperatingCashFlow', 'x', (D, y) => debt(D[y]) / D[y].cfo,
  v => band(v, x => x <= 3 && x >= 0, x => x <= 5.5 && x >= 0), ['cfo']);
def('DebtCurrent / CashAndCashEquivalentsAtCarryingValue', '%', (D, y) => stDebt(D[y]) / D[y].cash * 100,
  v => band(v, x => x <= 50, x => x <= 100), ['cash']);
def('EffectiveTaxRate - 21% US Statutory Benchmark', '%', (D, y) => D[y].tax / D[y].pretax * 100,
  (v, vals, ys) => { const swing = Math.abs(vals[ys[2]] - vals[ys[1]]); if (v < 12 || swing > 10) return 'R'; return (v >= 18 && v <= 24) ? 'G' : 'Y'; }, ['tax','pretax']);
def('ValuationAllowanceDeferredTaxAsset / TotalDTA', '%', (D, y) => nz(D[y].va) && nz(D[y].dtag) ? D[y].va / D[y].dtag * 100 : null,
  (v, vals, ys) => { const p = vals[ys[1]]; if (!nz(p)) return 'G'; const ch = pct(v, p) * 100; return band(ch, x => x > -20, x => x > -50); }, ['va','dtag']);
def('% YoY Change in LiabilitiesForUncertainTaxPositions', '%', (D, y) => D[y-1] && nz(D[y].utb) && nz(D[y-1].utb) ? pct(D[y].utb, D[y-1].utb) * 100 : null,
  v => band(v, x => x > -15, x => x >= -30), ['utb']);
def('PurchaseObligationDueInNextTwelveMonths / OperatingCashFlow', '%', (D, y) => nz(D[y].po12) ? D[y].po12 / D[y].cfo * 100 : null,
  v => band(v, x => x <= 25, x => x <= 60), ['po12']);
def('% YoY Change in LossContingencyAccrualAtCarryingValue', '%', (D, y) => D[y-1] && nz(D[y].lossAcc) && nz(D[y-1].lossAcc) ? pct(D[y].lossAcc, D[y-1].lossAcc) * 100 : null,
  v => band(v, x => x <= 0, x => x <= 30), ['lossAcc']);
def('OperatingLeaseLiabilityCurrent / OperatingCashFlow', '%', (D, y) => nz(D[y].leaseCur) ? D[y].leaseCur / D[y].cfo * 100 : null,
  v => band(v, x => x <= 20, x => x <= 40), ['leaseCur']);
def('NonoperatingIncomeExpense / IncomeLossBeforeTaxes', '%', (D, y) => Math.abs(D[y].nonop) / D[y].pretax * 100,
  v => band(v, x => x <= 5, x => x <= 15), ['nonop','pretax']);
def('DefinedBenefitPlanExpectedReturnOnPlanAssets / NetIncomeLoss', '%', (D, y) => nz(D[y].pension) ? D[y].pension / D[y].ni * 100 : null,
  v => band(v, x => x <= 5, x => x <= 12), ['pension']);
def('ForeignCurrencyTransactionGainLossBeforeTax / NetIncomeLoss', '%', (D, y) => nz(D[y].fx) ? Math.abs(D[y].fx) / D[y].ni * 100 : null,
  v => band(v, x => x <= 3, x => x <= 10), ['fx']);
// Category 13 — universal models
def('-4.84 + 0.920*DSRI + 0.528*GMI + 0.404*AQI + 0.892*SGI + 0.115*DEPI - 0.172*SGAI + 4.679*TATA - 0.327*LVGI', 'score', (D, y) => {
  const t = D[y], p = D[y-1]; if (!p) return null;
  const DSRI = (t.ar / t.rev) / (p.ar / p.rev);
  const GMI = (p.gp / p.rev) / (t.gp / t.rev);
  const AQI = (1 - (t.ca + t.ppe) / t.ta) / (1 - (p.ca + p.ppe) / p.ta);
  const SGI = t.rev / p.rev;
  const DEPI = (p.da / (p.da + p.ppe)) / (t.da / (t.da + t.ppe));
  const SGAI = (t.sga / t.rev) / (p.sga / p.rev);
  const TATA = (t.ni - t.cfo) / t.ta;
  const LVGI = ((t.cl + (t.tdn || 0)) / t.ta) / ((p.cl + (p.tdn || 0)) / p.ta);
  return -4.84 + 0.920*DSRI + 0.528*GMI + 0.404*AQI + 0.892*SGI + 0.115*DEPI - 0.172*SGAI + 4.679*TATA - 0.327*LVGI;
}, v => band(v, x => x <= -2.22, x => x <= -1.78), []);
def('6.56*(Working Capital / Total Assets) + 3.26*(Retained Earnings / Total Assets) + 6.72*(Operating Income / Total Assets) + 1.05*(Book Value Equity / Total Liabilities)', 'score',
  (D, y) => { const t = D[y]; return 6.56*((t.ca - t.cl)/t.ta) + 3.26*(t.re/t.ta) + 6.72*(t.ebit/t.ta) + 1.05*(t.eq/t.tl); },
  v => band(v, x => x > 2.6, x => x >= 1.1), []);
def('(Net Income - Operating Cash Flow) / ((Total Assets_t + Total Assets_t-1) / 2)', '%',
  (D, y) => D[y-1] ? (D[y].ni - D[y].cfo) / ((D[y].ta + D[y-1].ta) / 2) * 100 : null,
  v => band(Math.abs(v), x => x <= 5, x => x <= 10), []);

// ---- Remaining library formulas (full 867-flag coverage) ----
def('PrepaidExpenseAndOtherAssetsCurrent / AssetsCurrent', '%', (D, y) => nz(D[y].prepaid) ? D[y].prepaid / D[y].ca * 100 : null,
  v => band(v, x => x <= 15, x => x <= 25), ['prepaid','ca']);
def('(AccountsPayableCurrent / SG&A) * 365', 'days', (D, y) => nz(D[y].ap) ? D[y].ap / D[y].sga * 365 : null,
  (v, vals, ys) => band(vals[ys[2]] - vals[ys[1]], x => x < 10, x => x <= 20), ['ap','sga']);
def('InventoryNet / Assets', '%', (D, y) => nz(D[y].inv) ? D[y].inv / D[y].ta * 100 : null,
  v => band(v, x => x <= 2, x => true), ['inv']);
def('InventoryNet', '%', (D, y) => nz(D[y].inv) ? D[y].inv / D[y].ta * 100 : null,
  v => band(v, x => x <= 2, x => true), ['inv']);
def('CapitalizedSoftwareAdditions / ResearchAndDevelopmentExpense', '%', (D, y) => nz(D[y].capSw) && nz(D[y].rnd) ? D[y].capSw / D[y].rnd * 100 : null,
  (v, vals, ys) => { const p = vals[ys[1]]; const g = nz(p) && p ? (v / p - 1) * 100 : 0; return v > 20 && g > 25 ? 'R' : v > 10 ? 'Y' : 'G'; }, ['capSw','rnd']);
def('PaymentsToAcquirePropertyPlantAndEquipment / Depreciation', 'x', (D, y) => nz(D[y].capex) && nz(D[y].dep || D[y].da) ? D[y].capex / (D[y].dep || D[y].da) : null,
  (v, vals, ys) => v >= 1 ? 'G' : (v < 0.75 && vals[ys[1]] != null && vals[ys[1]] < 0.75 ? 'R' : 'Y'), ['capex']);
def('% YoY AR - % YoY Revenues', 'pts', (D, y) => { const a = pct(D[y].ar, D[y-1]?.ar), b = pct(D[y].rev, D[y-1]?.rev); return nz(a) && nz(b) ? (a - b) * 100 : null; },
  v => band(v, x => x <= 0, x => x <= 15), ['ar','rev']);
def('(AR / Revenues) * 365', 'days', (D, y) => D[y].ar / D[y].rev * 365,
  (v, vals, ys) => band(vals[ys[2]] - vals[ys[1]], x => x < 5, x => x <= 15), ['ar','rev']);
def('DeferredRevenueCurrent / Revenues', '%', (D, y) => D[y].dr / D[y].rev * 100,
  (v, vals, ys) => band(pct(vals[ys[2]], vals[ys[1]]) * 100, x => x >= -5, x => x >= -15), ['dr','rev']);
def('Cumulative Unbilled Contract Assets / Total Revenues', '%', (D, y) => nz(D[y].contractAssets) ? D[y].contractAssets / D[y].rev * 100 : null,
  v => band(v, x => x <= 15, x => x <= 25), ['contractAssets']);
def('ContractRetainageReceivable / Revenues', '%', (D, y) => nz(D[y].retainage) ? D[y].retainage / D[y].rev * 100 : null,
  v => band(v, x => x <= 5, x => x <= 10), ['retainage']);
def('(Receivables + Contract Assets) / Revenues * 365', 'days', (D, y) => nz(D[y].ar) ? (D[y].ar + (D[y].contractAssets || 0)) / D[y].rev * 365 : null,
  (v, vals, ys) => band(vals[ys[2]] - vals[ys[1]], x => x < 10, x => x <= 20), ['ar','rev']);
def('NonAccrualLoans / Total Loans', '%', (D, y) => nz(D[y].nonaccrual) && nz(D[y].loans) ? D[y].nonaccrual / D[y].loans * 100 : null,
  v => band(v, x => x <= 1, x => x <= 2.5), ['nonaccrual','loans']);
def('NIM_t - NIM_t-1', 'bps', (D, y) => D[y-1] && nz(D[y].nii) && nz(D[y-1].nii) ? (D[y].nii / D[y].ta - D[y-1].nii / D[y-1].ta) * 10000 : null,
  v => band(v, x => x >= 0, x => x >= -25), ['nii']);
def('Level3AssetsRealizedGains / NonInterestIncome', '%', (D, y) => nz(D[y].l3gain) && nz(D[y].nonIntInc) ? Math.abs(D[y].l3gain) / D[y].nonIntInc * 100 : null,
  v => band(v, x => x <= 10, x => x <= 25), ['l3gain','nonIntInc']);
def('RestrictedCashAndCashEquivalents / Total Cash', '%', (D, y) => nz(D[y].restrCash) ? D[y].restrCash / D[y].cash * 100 : null,
  v => band(v, x => x <= 10, x => x <= 25), ['restrCash','cash']);
def('AccruedLiabilitiesCurrent / AssetsCurrent', '%', (D, y) => nz(D[y].accrued) && nz(D[y].ca) ? D[y].accrued / D[y].ca * 100 : null,
  v => band(v, x => x <= 20, x => x <= 35), ['accrued','ca']);
def('StraightLineRentReceivable / RentalRevenues', '%', (D, y) => nz(D[y].slRent) && nz(D[y].leaseInc) ? D[y].slRent / D[y].leaseInc * 100 : null,
  v => band(v, x => x <= 4, x => x <= 8), ['slRent','leaseInc']);
def('DeferredTenantConcessions / Revenues', '%', (D, y) => nz(D[y].tenantAllow) ? D[y].tenantAllow / (D[y].leaseInc || D[y].rev) * 100 : null,
  v => band(v, x => x <= 2, x => x <= 5), ['tenantAllow']);
def('Change in Delinquent Tenant Receivables / Total Rent', '%', (D, y) => D[y-1] && nz(D[y].ar) && nz(D[y-1].ar) && nz(D[y].leaseInc) ? (D[y].ar - D[y-1].ar) / D[y].leaseInc * 100 : null,
  v => band(v, x => x <= 1, x => x <= 3), ['ar','leaseInc']);

/* Grey-signal policy: which missing inputs are a disclosure failure for a sub-industry */
const REQUIRED = {
  ALL: { intexp: c => (debt(c.latest) || 0) > 0 },
  'S1.2': { invFG: 1, invRM: 1, po12: 1 },
  'S1.1': { dr: 1 },
  'S2.1': { inv: 1, leaseCur: 1 }, 'S6.1': { nonaccrual: 1, loans: 1, nii: 1 }, 'S6.4': { leaseInc: 1 }, 'S1.4': { contractAssets: 1 }, 'S2.3': { inv: 1 }, 'S2.4': { inv: 1 }, 'S3.1': { inv: 1, po12: 1 }, 'S3.2': { inv: 1, po12: 1 }
};
const ITEM_LABEL = { intexp:'Interest expense', invFG:'Finished-goods inventory', invRM:'Raw-materials inventory', po12:'Purchase obligations due < 12 months',
  dr:'Deferred revenue', contractAssets:'Contract assets', unbilled:'Unbilled receivables', cip:'Construction in progress', goodwill:'Goodwill',
  intang:'Intangible assets (ex-goodwill)', lossAcc:'Loss-contingency accrual', pension:'Expected return on pension assets', fx:'FX transaction gain/loss',
  va:'DTA valuation allowance', dtag:'Gross deferred tax assets', utb:'Unrecognized tax benefits', leaseCur:'Current operating lease liability',
  dwc:'Change in operating assets & liabilities', prepaid:'Prepaid & other current assets', ap:'Accounts payable', capSw:'Capitalized software', rnd:'R&D expense', retainage:'Retainage receivable', nonaccrual:'Non-accrual loans', loans:'Total loans', nii:'Net interest income', l3gain:'Level 3 gains', nonIntInc:'Non-interest income', restrCash:'Restricted cash', accrued:'Accrued liabilities', slRent:'Straight-line rent receivable', leaseInc:'Rental income', tenantAllow:'Deferred tenant allowances', ar:'Accounts receivable', sga:'SG&A', ca:'Current assets', ta:'Total assets', cash:'Cash', dep:'Depreciation expense', ppeg:'Gross PP&E', inv:'Inventory' };

function gradeFlag(f, co, sub) {
  const ev = EV[f.formula];
  if (!ev) return { status: 'PENDING', note: 'No evaluator wired for this formula yet.' };
  if (!co || !co.fin) return { status: 'PENDING', note: 'Awaiting SEC extraction for this ticker.' };
  const D = co.fin, ys = co.years;
  const latestRow = D[ys[ys.length - 1]] || {};
  const missing = ev.needs.filter(k => !nz(latestRow[k]));
  if (missing.length) {
    const req = Object.assign({}, REQUIRED.ALL, REQUIRED[sub] || {});
    const ctx = { latest: D[ys[ys.length - 1]] };
    const notOk = missing.filter(k => req[k] && (typeof req[k] !== 'function' || req[k](ctx)));
    return { status: notOk.length ? 'GREY_NOT_OK' : 'GREY_OK', missing: missing.map(k => ITEM_LABEL[k] || k),
      note: (co.missingNotes && missing.map(k => co.missingNotes[k]).filter(Boolean).join(' ')) || '' };
  }
  const vals = {}; ys.forEach(y => { let v = null; try { v = ev.valueFn(D, y); } catch (e) { v = null; }
    if (typeof v === 'number' && !isFinite(v)) v = null;
    if (v && typeof v === 'object' && Object.values(v).some(x => typeof x !== 'number' || !isFinite(x))) v = null;
    vals[y] = v; });
  const latestY = [...ys].reverse().find(y => vals[y] != null);
  if (latestY == null) return { status: 'GREY_OK', missing: ['insufficient history'] };
  const g = ev.gradeFn(vals[latestY], vals, ys, D);
  return { status: g || 'GREY_OK', vals, fmt: ev.fmt, latestY };
}

function score(cards) {
  const counted = cards.filter(c => !c.flag._dupOf);
  const ev = counted.filter(c => ['G','Y','R'].includes(c.res.status));
  const pts = ev.reduce((s, c) => s + (c.res.status === 'G' ? 1 : c.res.status === 'Y' ? 0.5 : 0), 0);
  const n = k => counted.filter(c => c.res.status === k).length;
  return { score: ev.length ? Math.round(pts / ev.length * 100) : null, G: n('G'), Y: n('Y'), R: n('R'),
    greyOk: n('GREY_OK'), greyNotOk: n('GREY_NOT_OK'), pending: n('PENDING'), total: cards.length, counted: counted.length,
    dup: cards.length - counted.length, coverage: counted.length ? ev.length / counted.length : 0 };
}

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ('00000000' + (h >>> 0).toString(16)).slice(-8).toUpperCase(); }

const FOOTNOTE_ITEMS = ['nonaccrual','l3gain','slRent','tenantAllow','retainage','capSw','invFG','invRM','po12','utb','dtag','va','leaseCur','lossAcc','pension','fx','cip','unbilled','contractAssets','dep','ppeg','intexp'];
function sourceOf(f) { const ev = EV[f.formula]; if (!ev) return 'Library'; if (f.cat === 'CAT-13') return 'SEC 10-K · Model'; return ev.needs.some(k => FOOTNOTE_ITEMS.includes(k)) ? 'SEC 10-K Note' : 'SEC 10-K'; }
root.RF = { sourceOf, REQUIRED, PHYSICALITY, CAT_CLASS, CATS, SIC_MAP, aggregate, route, selectFlags, gradeFlag, score, EV, hashStr, ITEM_LABEL };
})(typeof window !== 'undefined' ? window : globalThis);
