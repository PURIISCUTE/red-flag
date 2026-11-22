/* Step 1 (lock profile) + Step 2 (route categories) — the deterministic mapping logic, made visible. */
(function () {
  const F = () => window.RF_FMT;
  window.RFC.ProfilePipeline = function (s) {
    const co = s.co, agg = s.agg, f = F(), names = co.subNames || {};
    const nm = x => x === 'ALL' ? 'Universal' : `${x} ${names[x] || ''}`;
    const L = [];
    L.push(`> ticker ${f.esc(co.ticker)} · CIK ${f.esc(co.cik)}`);
    L.push(`> [1] DB cache check → ${co.lock && co.lock.cached ? '<span class="ok">HIT</span> locked profile for ' : '<span class="hi">MISS</span> → Mapper ran and locked '}${f.esc(co.form || '10-K')} ${f.esc(co.lock ? co.lock.accession : '')}`);
    L.push(`> [2] SEC SIC ${f.esc(co.sic)} (${f.esc(co.sicName || '')}) → anchor ${f.esc(nm(co.anchorSub))}`);
    L.push(`> [3] Source table: ${f.esc(co.segmentAxis || 'none tagged in XBRL')}${co.segmentNote ? ' — ' + f.esc(co.segmentNote) : ''}`);
    const chk = co.reportedTotal ? (Math.abs(agg.total - co.reportedTotal) / co.reportedTotal < 0.005
      ? `<span class="ok">PASS</span> (Σ ${f.money(agg.total)} = reported ${f.money(co.reportedTotal)})`
      : `<span class="rd">FAIL</span> (Σ ${f.money(agg.total)} vs reported ${f.money(co.reportedTotal)})`) : 'n/a';
    L.push(`> [3A] ${co.revenueLines.length} line item(s) force-tagged (${[...new Set(co.revenueLines.map(l => l.tagger || 'rules'))].join('/')}) · 100% completeness ${chk}`);
    agg.list.forEach(b => L.push(`> [3B] ${b.sub} ${f.money(b.rev)} · ${(b.revPct * 100).toFixed(2)}% rev${b.opPct != null ? ' · ' + (b.opPct * 100).toFixed(1) + '% op. profit' : ''} → ${b === agg.s1 ? '<span class="ok">PRIMARY (S1)</span>' : b.gate ? '<span class="ok">SECONDARY (S2) via ' + b.gate + ' ≥ 20%</span>' : 'below 20% — ignored'}`));
    L.push(`> [4] ${s.s2 ? 'Hybrid' : 'Pure-play'} locked · lock id ${s.lockId}${s.lens !== 'AUTO' ? ' · <span class="hi">lens override S1 = ' + s.lens + '</span>' : ''}`);
    const colors = ['#3B82F6', '#8B5CF6', '#475569', '#334155', '#1E293B'];
    const cls = { shared: 'Shared core', physical: 'Physical / balance-sheet', digital: 'Digital / intangible' };
    return `<div class="row r-2b">
      <div class="card mod"><div class="mod-h"><h3>Step 1 · Locked company profile</h3><span class="sub">no AI guesswork — SIC anchor + 20% materiality gate</span></div>
        <div class="splitbar">${agg.list.map((b, i) => `<div style="width:${Math.max(b.revPct * 100, 7)}%;background:${colors[i] || '#1E293B'}">${b.sub} ${(b.revPct * 100).toFixed(1)}%</div>`).join('')}</div>
        <div class="log">${L.join('\n')}</div>
        <table class="t" style="margin-top:10px"><thead><tr><th>10-K line item</th><th class="num">Revenue</th><th class="num">Op. inc.</th><th>Tag</th></tr></thead><tbody>
        ${co.revenueLines.map(l => `<tr><td>${f.esc(l.name)}</td><td class="num">${f.money(l.rev)}</td><td class="num">${l.op == null ? '—' : f.money(l.op)}</td><td><span class="tag ${l.tag === s.s1 ? 's1' : l.tag === s.s2 ? 's2' : ''}">${f.esc(l.tag)}</span></td></tr>`).join('')}</tbody></table>
      </div>
      <div class="card mod"><div class="mod-h"><h3>Step 2 · Category routing</h3><span class="sub">${s.cards.length} flags routed · ${s.s2 ? 'S1 + S2' : 'S1 only'}</span></div>
        <table class="t"><thead><tr><th>#</th><th>Master category</th><th>Class</th><th>Active source</th><th class="num">Flags</th></tr></thead><tbody>
        ${Object.entries(s.plan).map(([c, subs]) => `<tr><td class="mono mute">${c.slice(4)}</td><td>${f.esc(s.catName[c])}</td><td class="xs mute">${c === 'CAT-13' ? 'Universal' : cls[window.RF.CAT_CLASS[c]]}</td>
          <td>${c === 'CAT-13' ? '<span class="tag all">ALL</span> <span class="xs">Beneish · Altman Z″ · Sloan</span>' : subs.length > 1 ? '<span class="tag both">BOTH</span> <span class="xs">' + subs.join(' + ') + '</span>' : `<span class="tag ${subs[0] === s.s1 ? 's1' : 's2'}">${subs[0] === s.s1 ? 'S1' : 'S2'}</span> <span class="xs">${f.esc(nm(subs[0]))}</span>`}</td>
          <td class="num">${s.cards.filter(x => x.flag.cat === c).length}</td></tr>`).join('')}</tbody></table></div></div>`;
  };
})();
