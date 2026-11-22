/* RedFlag Terminal — app state, deterministic pipeline, rendering and events. */
(function () {
  const $ = s => document.querySelector(s);
  const LIB = window.RF_LIBRARY;
  const CATNAME = {}; LIB.forEach(f => { CATNAME[f.cat] = f.catName; });
  const SUBNAMES = {}; LIB.forEach(f => { if (f.sub !== 'ALL') SUBNAMES[f.sub] = f.subName; });

  const S = { view: 'dashboard', ticker: 'AAPL', co: null, lens: 'AUTO', tab: 'ALL', statusFilter: 'ALL', sortRisk: true, showLib: false, libQuery: '',
    finTab: 'Income Statement', openFlag: null, error: null, catName: CATNAME };

  /* ---------------- Pipeline: lock → route → grade → score ---------------- */
  function compute() {
    const co = S.co; co.subNames = co.subNames || SUBNAMES;
    const agg = window.RF.aggregate(co.revenueLines, co.anchorSub);
    let s1 = agg.s1.sub, s2 = agg.s2 ? agg.s2.sub : null;
    if (S.lens !== 'AUTO') { if (s2 === S.lens) s2 = s1 === S.lens ? null : s1; s1 = S.lens; if (s2 === s1) s2 = null; }
    const plan = window.RF.route(s1, s2);
    const flags = window.RF.selectFlags(LIB, plan);
    const cards = flags.map(f => ({ flag: f, res: window.RF.gradeFlag(f, co, f.sub === 'ALL' ? s1 : f.sub) }));
    const sc = window.RF.score(cards);
    const lockId = window.RF.hashStr(JSON.stringify({ t: co.ticker, fy: co.fiscalYear, s1: agg.s1.sub, s2: agg.s2 && agg.s2.sub, split: agg.list.map(b => [b.sub, +(b.revPct * 100).toFixed(2)]) }));
    const profileText = s2 ? `${(agg.list.find(b => b.sub === s1) || { revPct: 1 }).revPct * 100 | 0}% ${s1} ${SUBNAMES[s1]} / ${((agg.list.find(b => b.sub === s2) || { revPct: 0 }).revPct * 100).toFixed(0)}% ${s2} ${SUBNAMES[s2]}` : `Pure-play ${s1} ${SUBNAMES[s1]}`;
    Object.assign(S, { agg, s1, s2, plan, cards, sc, lockId, profileText });
    S.summary = window.RF_SUMMARY(S);
  }

  /* ---------------- Rendering ---------------- */
  function render() {
    $('#sidebar').innerHTML = window.RFC.Sidebar(S);
    $('#topbar').innerHTML = window.RFC.Header(S);
    const m = $('#main'); let html = '';
    if (S.error) html += `<div class="banner ${S.error.kind || 'err'}">${window.RF_FMT.esc(S.error.msg)}</div>`;
    if (S.view === 'watchlist') html += window.RFC.Watchlist(S);
    else if (S.view === 'thresholds') html += window.RFC.Thresholds(S);
    else if (S.view === 'reports') html += window.RFC.Reports(S);
    else if (S.co) {
      html += `<div class="row">${window.RFC.CompanyCard(S)}</div>
        <div class="row r-2">${window.RFC.LiveChart(S)}${window.RFC.ExecutiveSummary(S)}</div>
        ${window.RFC.ProfilePipeline(S)}
        <div class="row">${window.RFC.FlagMatrix(S)}</div>
        <div class="row">${window.RFC.FinancialTable(S)}</div>
        <div class="card mod small mute">Primary filing: <a href="${S.co.filingUrl}" target="_blank" rel="noopener">${window.RF_FMT.esc(S.co.name)} ${window.RF_FMT.esc(S.co.form || '10-K')} (${window.RF_FMT.esc(S.co.fiscalYear)}) on SEC EDGAR ↗</a><br>${window.RF_FMT.esc(S.co.sources ? S.co.sources.footnotes : '')}<br>${window.RF_FMT.esc(S.co.sources ? S.co.sources.market : '')}</div>`;
    } else html += `<div class="card empty">${window.RF_API.live === false ? 'The live API is not reachable. <button class="chipf" data-open="' + window.RF_FMT.esc(S.ticker) + '">Retry</button>' : 'Search any NYSE / NASDAQ ticker to begin.'}</div>`;
    m.innerHTML = html;
    $('#app').classList.toggle('collapsed', !!S.collapsed);
    if (S.view === 'dashboard' && S.co) window.RFC.LiveChart.mount(S);
  }
  function renderMainOnly() { const y = window.scrollY; render(); window.scrollTo(0, y); }

  /* ---------------- Actions ---------------- */
  let quoteTimer = null;
  async function analyze(t) {
    t = (t || '').trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, '');
    if (!t) return;
    S.ticker = t; S.error = null; S.openFlag = null; S.tab = 'ALL'; S.statusFilter = 'ALL'; S.view = 'dashboard'; S.lens = 'AUTO';
    const ld = document.createElement('div'); ld.className = 'loading';
    ld.innerHTML = `<div class="box">&gt; ${t}: checking profile lock…<br>&gt; pulling SEC EDGAR filings (3 FY + TTM)…<br>&gt; decomposing segments · 20% gate…<br>&gt; routing 13 categories · grading flags…<br><span style="color:#64748B">first run of a ticker can take 10–40 s</span></div>`;
    document.body.appendChild(ld);
    try {
      S.co = await window.RF_API.analyze(t);
      compute();
      clearInterval(quoteTimer);
      if (window.RF_API.live) quoteTimer = setInterval(refreshQuote, 15000);
    } catch (e) {
      S.error = { msg: e.message, kind: 'err' };
      if (S.co && S.co.ticker !== t) S.error.msg += ` Still showing ${S.co.ticker}.`;
    } finally { ld.remove(); render(); }
  }
  async function refreshQuote() {
    if (!S.co || !window.RF_API.live || S.view !== 'dashboard') return;
    const q = await window.RF_API.quote(S.co.ticker);
    if (q) { S.co.quote = q; const el = $('#priceRow'); if (el) { const tmp = document.createElement('div'); tmp.innerHTML = window.RFC.CompanyCard(S); const n = tmp.querySelector('#priceRow'); if (n) el.innerHTML = n.innerHTML; } }
  }
  function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 4200); }

  /* ---------------- Events (delegated) ---------------- */
  let sugIdx = -1, sugList = [], sugTimer = null;
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-nav],[data-tab],[data-sf],[data-sort],[data-fin],[data-flag],[data-range],[data-open],[data-wldel],#libToggle,#exportBtn,#collapse,#apiSave,#wlAdd,.suggest div');
    if (!el) { const sg = $('#suggest'); if (sg && !e.target.closest('.search')) sg.classList.add('hidden'); return; }
    if (el.matches('.suggest div')) { analyze(el.dataset.t); return; }
    if (el.dataset.nav) { S.view = el.dataset.nav; render(); return; }
    if (el.dataset.tab) { S.tab = el.dataset.tab; renderMainOnly(); return; }
    if (el.dataset.sf) { S.statusFilter = el.dataset.sf; renderMainOnly(); return; }
    if (el.dataset.sort) { S.sortRisk = !S.sortRisk; renderMainOnly(); return; }
    if (el.dataset.fin) { S.finTab = el.dataset.fin; renderMainOnly(); return; }
    if (el.dataset.range) { window.RFC.LiveChart.setRange(el.dataset.range); return; }
    if (el.dataset.flag) { S.openFlag = S.openFlag === el.dataset.flag ? null : el.dataset.flag; renderMainOnly(); return; }
    if (el.dataset.wldel) { e.stopPropagation(); window.RFC.Watchlist.remove(el.dataset.wldel); render(); return; }
    if (el.dataset.open) { analyze(el.dataset.open); return; }
    if (el.id === 'libToggle') { S.showLib = !S.showLib; renderMainOnly(); return; }
    if (el.id === 'collapse') { S.collapsed = !S.collapsed; $('#app').classList.toggle('collapsed', S.collapsed); return; }
    if (el.id === 'wlAdd') { window.RFC.Watchlist.add(S); render(); toast(S.co.ticker + ' added to watchlist'); return; }
    if (el.id === 'apiSave') { window.RF_API.setBase($('#apiBase').value); window.RF_API.health().then(() => { render(); toast(window.RF_API.live ? 'Backend connected' : 'Backend not reachable'); }); return; }
    if (el.id === 'exportBtn') { const r = window.exportAuditPDF(S.cards ? S : null); if (r.ok) window.RFC.Reports.log(S); toast(r.msg); return; }
  });
  document.addEventListener('change', e => { if (e.target.id === 'lens' && S.co) { S.lens = e.target.value; compute(); render(); } });
  document.addEventListener('input', e => {
    if (e.target.id === 'libq') { S.libQuery = e.target.value; const pos = e.target.selectionStart; renderMainOnly(); const n = $('#libq'); n.focus(); n.setSelectionRange(pos, pos); }
    if (e.target.id === 'q') {
      const v = e.target.value; clearTimeout(sugTimer);
      const show = remote => { sugList = window.RFC.suggestions(v, remote); sugIdx = -1; const sg = $('#suggest');
        sg.innerHTML = sugList.map((x, i) => `<div data-t="${x.ticker}"><b>${x.ticker}</b><span class="mute">${window.RF_FMT.esc(x.name)}</span></div>`).join('');
        sg.classList.toggle('hidden', !sugList.length); };
      show([]); sugTimer = setTimeout(() => window.RF_API.search(v).then(show), 220);
    }
  });
  document.addEventListener('focusin', e => { if (e.target.id === 'q') { sugList = window.RFC.suggestions(e.target.value, []); const sg = $('#suggest');
    sg.innerHTML = sugList.map(x => `<div data-t="${x.ticker}"><b>${x.ticker}</b><span class="mute">${window.RF_FMT.esc(x.name)}</span></div>`).join(''); sg.classList.toggle('hidden', !sugList.length); } });
  document.addEventListener('keydown', e => {
    if (e.target.id !== 'q') return;
    const items = [...document.querySelectorAll('#suggest div')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sugIdx = Math.max(0, Math.min(items.length - 1, sugIdx + (e.key === 'ArrowDown' ? 1 : -1))); items.forEach((d, i) => d.classList.toggle('on', i === sugIdx)); }
    if (e.key === 'Enter') { e.preventDefault(); analyze(sugIdx >= 0 && items[sugIdx] ? items[sugIdx].dataset.t : e.target.value); }
    if (e.key === 'Escape') $('#suggest').classList.add('hidden');
  });

  /* ---------------- Boot ---------------- */
  window.RF_APP = { state: S, analyze, compute };
  render();
  window.RF_API.health().then(() => analyze(new URLSearchParams(location.search).get('t') || 'AAPL'));
})();
