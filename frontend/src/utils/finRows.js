/* Rows for the 3-Year + TTM forensic table. Each row: label, value(row, prevRow) -> number, fmt,
   anomaly(cur, prev) -> string|null (inline signal for abnormal year-over-year moves). */
(function () {
  const g = (r, k) => r && r[k] != null && isFinite(r[k]) ? r[k] : null;
  const pct = (a, b) => a == null || b == null || b === 0 ? null : (a / b - 1) * 100;
  const div = (a, b) => a == null || b == null || b === 0 ? null : a / b;
  const field = k => r => g(r, k);
  const growthGap = (k, base, thr, msg) => (cur, prev) => {
    if (!prev) return null; const a = pct(g(cur, k), g(prev, k)), b = pct(g(cur, base), g(prev, base));
    return a != null && b != null && a - b > thr ? `${msg} (+${(a - b).toFixed(0)} pts vs revenue)` : null; };
  const deltaAbove = (fn, thr, msg, unit) => (cur, prev) => {
    if (!prev) return null; const a = fn(cur), b = fn(prev);
    return a != null && b != null && a - b > thr ? `${msg} (+${(a - b).toFixed(1)}${unit})` : null; };
  const deltaBelow = (fn, thr, msg, unit) => (cur, prev) => {
    if (!prev) return null; const a = fn(cur), b = fn(prev);
    return a != null && b != null && b - a > thr ? `${msg} (−${(b - a).toFixed(1)}${unit})` : null; };

  const gm = r => div(g(r, 'gp'), g(r, 'rev')) == null ? null : div(g(r, 'gp'), g(r, 'rev')) * 100;
  const om = r => div(g(r, 'ebit'), g(r, 'rev')) == null ? null : div(g(r, 'ebit'), g(r, 'rev')) * 100;
  const dso = r => div(g(r, 'ar'), g(r, 'rev')) == null ? null : div(g(r, 'ar'), g(r, 'rev')) * 365;
  const dio = r => div(g(r, 'inv'), g(r, 'cogs')) == null ? null : div(g(r, 'inv'), g(r, 'cogs')) * 365;
  const debt = r => [g(r, 'cp'), g(r, 'tdc'), g(r, 'tdn')].some(v => v != null) ? (g(r, 'cp') || 0) + (g(r, 'tdc') || 0) + (g(r, 'tdn') || 0) : null;

  window.RF_FINROWS = {
    'Income Statement': [
      { label: 'Revenue', v: field('rev'), fmt: 'm' },
      { label: 'Cost of revenue', v: field('cogs'), fmt: 'm' },
      { label: 'Gross profit', v: field('gp'), fmt: 'm' },
      { label: 'SG&A', v: field('sga'), fmt: 'm', anomaly: growthGap('sga', 'rev', 15, 'SG&A outgrowing revenue') },
      { label: 'Operating income (EBIT)', v: field('ebit'), fmt: 'm' },
      { label: 'Non-operating income / (expense)', v: field('nonop'), fmt: 'm' },
      { label: 'Pre-tax income', v: field('pretax'), fmt: 'm' },
      { label: 'Income tax', v: field('tax'), fmt: 'm' },
      { label: 'Net income', v: field('ni'), fmt: 'm' },
      { label: 'Interest expense', v: field('intexp'), fmt: 'm' },
      { label: 'Diluted shares', v: field('dil'), fmt: 'sh' }
    ],
    'Balance Sheet': [
      { label: 'Cash & equivalents', v: field('cash'), fmt: 'm' },
      { label: 'Accounts receivable', v: field('ar'), fmt: 'm', anomaly: growthGap('ar', 'rev', 10, 'Receivables build-up') },
      { label: 'Inventory', v: field('inv'), fmt: 'm', anomaly: growthGap('inv', 'rev', 15, 'Inventory build-up') },
      { label: 'Total current assets', v: field('ca'), fmt: 'm' },
      { label: 'PP&E, net', v: field('ppe'), fmt: 'm' },
      { label: 'Goodwill', v: field('goodwill'), fmt: 'm' },
      { label: 'Total assets', v: field('ta'), fmt: 'm' },
      { label: 'Total current liabilities', v: field('cl'), fmt: 'm' },
      { label: 'Deferred revenue (current)', v: field('dr'), fmt: 'm' },
      { label: 'Total debt', v: debt, fmt: 'm' },
      { label: 'Total liabilities', v: field('tl'), fmt: 'm' },
      { label: 'Retained earnings / (deficit)', v: field('re'), fmt: 'm' },
      { label: "Shareholders' equity", v: field('eq'), fmt: 'm' }
    ],
    'Cash Flow': [
      { label: 'Operating cash flow (CFO)', v: field('cfo'), fmt: 'm' },
      { label: 'Capital expenditures', v: field('capex'), fmt: 'm' },
      { label: 'Free cash flow', v: r => g(r, 'cfo') != null && g(r, 'capex') != null ? r.cfo - r.capex : null, fmt: 'm' },
      { label: 'Depreciation & amortization', v: field('da'), fmt: 'm' },
      { label: 'Stock-based compensation', v: field('sbc'), fmt: 'm', anomaly: growthGap('sbc', 'rev', 20, 'SBC outgrowing revenue') },
      { label: 'Share repurchases', v: field('buyb'), fmt: 'm' },
      { label: 'Working-capital cash effect', v: field('dwc'), fmt: 'm' }
    ],
    'Forensic Ratios': [
      { label: 'Gross margin', v: gm, fmt: '%', anomaly: deltaBelow(gm, 2, 'Gross-margin compression', ' pts') },
      { label: 'Operating margin', v: om, fmt: '%', anomaly: deltaBelow(om, 3, 'Operating-margin compression', ' pts') },
      { label: 'DSO (days sales outstanding)', v: dso, fmt: 'days', anomaly: deltaAbove(dso, 5, 'DSO spike', ' d') },
      { label: 'DIO (days inventory outstanding)', v: dio, fmt: 'days', anomaly: deltaAbove(dio, 10, 'Inventory days spike', ' d') },
      { label: 'CFO / Net income', v: r => div(g(r, 'cfo'), g(r, 'ni')), fmt: 'x', anomaly: (c) => { const x = div(g(c, 'cfo'), g(c, 'ni')); return x != null && x < 0.8 ? 'Earnings not backed by cash (<0.8x)' : null; } },
      { label: 'FCF / Net income', v: r => g(r, 'cfo') != null && g(r, 'capex') != null ? div(r.cfo - r.capex, g(r, 'ni')) : null, fmt: 'x' },
      { label: 'SBC / Revenue', v: r => div(g(r, 'sbc'), g(r, 'rev')) == null ? null : div(g(r, 'sbc'), g(r, 'rev')) * 100, fmt: '%' },
      { label: 'Current ratio', v: r => div(g(r, 'ca'), g(r, 'cl')), fmt: 'x', anomaly: (c) => { const x = div(g(c, 'ca'), g(c, 'cl')); return x != null && x < 1 ? 'Current liabilities exceed current assets' : null; } },
      { label: 'Debt / Equity', v: r => div(debt(r), g(r, 'eq')), fmt: 'x' },
      { label: 'Effective tax rate', v: r => div(g(r, 'tax'), g(r, 'pretax')) == null ? null : div(g(r, 'tax'), g(r, 'pretax')) * 100, fmt: '%',
        anomaly: (c, p) => { const a = div(g(c, 'tax'), g(c, 'pretax')), b = div(g(p, 'tax'), g(p, 'pretax')); return a != null && b != null && Math.abs(a - b) * 100 > 8 ? `Tax-rate swing (${((a - b) * 100).toFixed(1)} pts)` : null; } }
    ]
  };
})();
