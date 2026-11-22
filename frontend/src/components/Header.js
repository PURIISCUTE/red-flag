(function () {
  const POPULAR = [['NVDA', 'NVIDIA Corp'], ['PFE', 'Pfizer Inc.'], ['UNH', 'UnitedHealth Group'], ['JNJ', 'Johnson & Johnson'], ['MDT', 'Medtronic plc'],
    ['BIIB', 'Biogen Inc.'], ['AAPL', 'Apple Inc.'], ['MSFT', 'Microsoft Corp'], ['AMZN', 'Amazon.com Inc.'], ['GOOGL', 'Alphabet Inc.'], ['META', 'Meta Platforms'],
    ['TSLA', 'Tesla Inc.'], ['WMT', 'Walmart Inc.'], ['COST', 'Costco Wholesale'], ['JPM', 'JPMorgan Chase'], ['V', 'Visa Inc.'], ['MA', 'Mastercard'],
    ['PYPL', 'PayPal Holdings'], ['CRM', 'Salesforce'], ['ORCL', 'Oracle Corp'], ['ADBE', 'Adobe Inc.'], ['AMD', 'Advanced Micro Devices'], ['INTC', 'Intel Corp'],
    ['LLY', 'Eli Lilly'], ['MRK', 'Merck & Co.'], ['ABBV', 'AbbVie Inc.'], ['XOM', 'Exxon Mobil'], ['CVX', 'Chevron'], ['KO', 'Coca-Cola Co.'], ['PG', 'Procter & Gamble'],
    ['NKE', 'Nike Inc.'], ['BA', 'Boeing Co.'], ['CAT', 'Caterpillar'], ['UPS', 'United Parcel Service'], ['NEE', 'NextEra Energy'], ['O', 'Realty Income'], ['BAC', 'Bank of America']];
  window.RFC.POPULAR = POPULAR;

  window.RFC.Header = function (s) {
    const subs = {}; window.RF_LIBRARY.forEach(f => { if (f.sub !== 'ALL') (subs[f.ind] = subs[f.ind] || {})[f.sub] = f.subName; });
    const lensOpts = `<option value="AUTO"${s.lens === 'AUTO' ? ' selected' : ''}>Industry lens: Auto (SEC-locked profile)</option>` +
      Object.entries(subs).map(([ind, m]) => `<optgroup label="${ind}">${Object.entries(m).map(([k, v]) => `<option value="${k}"${s.lens === k ? ' selected' : ''}>${k} ${v}</option>`).join('')}</optgroup>`).join('');
    return `<button class="icon-btn" id="collapse" title="Collapse sidebar">${window.RFC.icon('menu')}</button>
      <div class="search"><span class="ico">${window.RFC.icon('search', 18)}</span>
        <input id="q" placeholder="Search any NYSE / NASDAQ ticker…" value="${window.RF_FMT.esc(s.ticker || '')}" autocomplete="off" spellcheck="false">
        <div class="suggest hidden" id="suggest"></div></div>
      <select class="lens" id="lens" title="Industry lens: override the locked primary sub-industry">${lensOpts}</select>
      <span class="spacer"></span>
      <button class="cta" id="exportBtn">${window.RFC.icon('download', 16)} Export PDF Audit</button>`;
  };

  window.RFC.suggestions = function (q, remote) {
    q = (q || '').toUpperCase();
    const local = POPULAR.filter(([t, n]) => t.startsWith(q) || n.toUpperCase().includes(q)).map(([t, n]) => ({ ticker: t, name: n }));
    const seen = new Set(); const out = [];
    [...local, ...(remote || [])].forEach(x => { if (!seen.has(x.ticker)) { seen.add(x.ticker); out.push(x); } });
    return (q ? out : local.slice(0, 6)).slice(0, 8);
  };
})();
