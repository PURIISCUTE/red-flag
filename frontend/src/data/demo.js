/* Offline demo payload — same JSON shape as POST /api/v1/analyze.
   Apple Inc. figures are taken from the FY2025 Form 10-K (FY2023–FY2025) and FY2022 bases from prior 10-Ks.
   $ millions; dil = diluted weighted shares (thousands). Used when the backend is not reachable. */
window.RF_DEMO = {
  AAPL: {
    ticker: 'AAPL', name: 'Apple Inc.', cik: '0000320193', sic: '3571', sicName: 'Electronic Computers', exchange: 'Nasdaq',
    fiscalYear: 'FY2025', fyEnd: '2025-09-27', filed: '2025-10-31', form: '10-K',
    filingUrl: 'https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm',
    anchorSub: 'S1.2',
    segmentAxis: 'Disaggregated revenue (product / service)',
    segmentNote: 'ASC 280 segments are purely geographic, so the Mapper uses the product/service revenue table instead.',
    reportedTotal: 416161,
    revenueLines: [
      { name: 'iPhone', rev: 209586, op: null, tag: 'S1.2', tagger: 'rules' },
      { name: 'Services', rev: 109158, op: null, tag: 'S1.1', tagger: 'rules' },
      { name: 'Wearables, Home and Accessories', rev: 35686, op: null, tag: 'S1.2', tagger: 'rules' },
      { name: 'Mac', rev: 33708, op: null, tag: 'S1.2', tagger: 'rules' },
      { name: 'iPad', rev: 28023, op: null, tag: 'S1.2', tagger: 'rules' }
    ],
    years: [2023, 2024, 2025],
    fin: {
      2022: { rev:394328, cogs:223546, gp:170782, sga:25094, ebit:119437, nonop:-334, pretax:119103, tax:19300, ni:99803, dil:16325819,
        cash:23646, ar:28184, inv:4946, ca:135405, ppe:42117, ppeg:114457, ta:352755, cl:153982, cp:9982, tdc:11128, tdn:98959, tl:302083, re:-3068, eq:50672, dr:7912,
        da:11104, dep:8700, sbc:9038, cfo:122151, capex:10708, buyb:89402, utb:16758, restr:0 },
      2023: { rev:383285, cogs:214137, gp:169148, sga:24932, ebit:114301, nonop:-565, pretax:113736, tax:16741, ni:96995, dil:15812547,
        cash:29965, ar:29508, inv:6331, ca:143566, ppe:43715, ppeg:114599, ta:352583, cl:145308, cp:5985, tdc:9822, tdn:95281, tl:290437, re:-214, eq:62146, dr:8061,
        da:11519, dep:8500, sbc:10833, cfo:110543, capex:10959, buyb:77550, dwc:-6577, utb:19454, intexp:3933, restr:0 },
      2024: { rev:391035, cogs:210352, gp:180683, sga:26097, ebit:123216, nonop:269, pretax:123485, tax:29749, ni:93736, dil:15408095,
        cash:29943, ar:33410, inv:7286, ca:152987, ppe:45680, ppeg:119128, ta:364980, cl:176392, cp:9967, tdc:10912, tdn:85750, tl:308030, re:-19154, eq:56950, dr:8249,
        da:11445, dep:8200, sbc:11688, cfo:118254, capex:9447, buyb:94949, dwc:3651, utb:22038, dtag:34873, va:8866, leaseCur:1488, restr:0 },
      2025: { rev:416161, cogs:220960, gp:195201, sga:27601, ebit:133050, nonop:-321, pretax:132729, tax:20719, ni:112010, dil:15004697,
        cash:35934, ar:39777, inv:5718, ca:147957, ppe:49834, ppeg:125848, ta:359241, cl:165631, cp:7979, tdc:12350, tdn:78328, tl:285508, re:-14264, eq:73733, dr:9055,
        da:11698, dep:8000, sbc:12863, cfo:111482, capex:12715, buyb:90711, dwc:-25000, utb:23242, dtag:38417, va:10966, leaseCur:1579, po12:4752, restr:0 }
    },
    ttm: null,
    missingNotes: {
      intexp: 'Apple stopped breaking out interest expense after FY2023 while carrying ~$98.7B of debt; it sits inside "Other income/(expense), net".',
      invFG: 'Inventories are reported as one line ($5.7B) with no components vs. finished-goods split.',
      contractAssets: 'No contract-asset balance is disclosed; Services are billed up front.',
      unbilled: 'No unbilled-receivables line; hardware is invoiced at shipment.',
      cip: 'PP&E note has no separate construction-in-progress line.',
      goodwill: 'Goodwill is not material and not presented separately.',
      intang: 'Acquired intangibles are not material and not presented separately.',
      lossAcc: 'No accrual amount disclosed; management sees no reasonably possible material loss beyond accruals.',
      pension: 'No material defined-benefit pension plan.',
      fx: 'FX transaction gains/losses not disclosed separately.'
    },
    lock: { accession: '0000320193-25-000079', lockedAt: 1761868800, cached: true },
    quote: null,
    sources: {
      statements: 'Apple FY2025 Form 10-K: Statements of Operations, Balance Sheets, Cash Flows (FY2023–FY2025); FY2022 bases from prior 10-Ks.',
      footnotes: 'Notes: PP&E (depreciation $8.0B/$8.2B/$8.5B), Income Taxes (UTB, DTA, valuation allowance), Leases, Commitments (purchase obligations: $4.75B due FY2026).',
      market: 'Live price via TradingView widget; Yahoo Finance quote and market cap need the backend.'
    },
    demo: true
  }
};
