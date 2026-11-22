(function () {
  const F = () => window.RF_FMT;
  window.RFC.CompanyCard = function (s) {
    const co = s.co, sc = s.sc, q = co.quote, f = F();
    const names = co.subNames || {};
    const ind = (window.RF_LIBRARY.find(x => x.sub === s.s1) || {}).ind || '';
    const sector = `${co.ticker} • ${ind.replace(/^IND-\d+:\s*/, '').toUpperCase()} / ${(names[s.s1] || s.s1).toUpperCase()}`;
    const col = sc.score == null ? 'var(--na)' : sc.score >= 80 ? 'var(--g)' : sc.score >= 60 ? 'var(--y)' : 'var(--r)';
    const C = 2 * Math.PI * 54, frac = sc.score == null ? 0 : sc.score / 100;
    const chg = q && q.change != null ? `<span class="mono ${q.change >= 0 ? 'tc-g' : 'tc-r'}">${q.change >= 0 ? '+' : ''}${q.change.toFixed(2)} (${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%)</span>` : '';
    const price = q && q.price != null
      ? `<span class="p">$${q.price.toFixed(2)}</span>${chg}<span class="small mute">Market cap <b class="ink2">${f.big(q.marketCap)}</b> · Yahoo Finance${q.marketTime ? ' · ' + new Date(q.marketTime * 1000).toLocaleTimeString() : ''}</span>`
      : `<span class="small mute">Live price streams in the chart below${window.RF_API.live ? ' · Yahoo quote unavailable right now' : ''}</span>`;
    return `<div class="card company">
      <div>
        <div class="co-tk">${f.esc(co.ticker)}</div>
        <div class="co-sector">${f.esc(sector)}</div>
        <div class="co-name">${f.esc(co.name)}</div>
        <div class="co-price" id="priceRow">${price}</div>
        <div class="co-meta"><span>SIC <b>${f.esc(co.sic)}</b> ${f.esc(co.sicName || '')}</span><span>${f.esc(co.form || '10-K')} <b>${f.esc(co.fiscalYear)}</b> filed ${f.esc(co.filed)}</span>
          <span>Lock <b class="mono">${s.lockId}</b>${co.lock && co.lock.cached ? ' (cache hit)' : ' (new lock)'}</span>${s.lens !== 'AUTO' ? '<span class="tc-y">Lens override active — not the locked profile</span>' : ''}</div>
      </div>
      <div class="score-wrap">
        <div class="dist">
          <span class="pill st-g">GREEN</span><span class="n tc-g">${sc.G}</span>
          <span class="pill st-y">YELLOW</span><span class="n tc-y">${sc.Y}</span>
          <span class="pill st-r">RED</span><span class="n tc-r">${sc.R}</span>
          <span class="pill st-na">N/A</span><span class="n tc-na">${sc.greyOk}</span>
          <span class="pill st-alert">DISCLOSURE</span><span class="n tc-alert">${sc.greyNotOk}</span>
        </div>
        <div class="ring"><svg width="128" height="128"><circle cx="64" cy="64" r="54" stroke="rgba(255,255,255,.07)" stroke-width="10" fill="none"/>
          <circle cx="64" cy="64" r="54" stroke="${col}" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="${C * frac} ${C}"/></svg>
          <div class="v"><div><b style="color:${col}">${sc.score == null ? '—' : sc.score}</b><span>HEALTH / 100</span></div></div></div>
      </div></div>`;
  };
})();
