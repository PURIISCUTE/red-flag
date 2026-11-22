/* Secondary views: Watchlist, Thresholds, Audit Reports (stored in this browser). */
(function () {
  const F = () => window.RF_FMT;
  const ls = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  window.RF_LS = ls;

  window.RFC.Watchlist = function (s) {
    const f = F(), wl = ls.get('rf:watchlist', []);
    return `<div class="card mod"><div class="mod-h"><h3>Watchlist</h3><span class="sub">saved in this browser · click a row to open its report</span>
      ${s.co ? `<button class="chipf" id="wlAdd" style="margin-left:auto">${window.RFC.icon('star', 13)} Add ${f.esc(s.co.ticker)}</button>` : ''}</div>
      ${wl.length ? `<table class="t"><thead><tr><th>Ticker</th><th>Company</th><th>Profile</th><th class="num">Score</th><th>G / Y / R / Alerts</th><th>Last run</th><th></th></tr></thead><tbody>
      ${wl.map(w => `<tr data-open="${f.esc(w.ticker)}" style="cursor:pointer"><td class="mono"><b>${f.esc(w.ticker)}</b></td><td>${f.esc(w.name)}</td><td class="xs">${f.esc(w.profile)}</td>
        <td class="num">${w.score == null ? '—' : w.score}</td><td class="mono xs"><span class="tc-g">${w.G}</span> / <span class="tc-y">${w.Y}</span> / <span class="tc-r">${w.R}</span> / <span class="tc-alert">${w.alerts}</span></td>
        <td class="xs mute">${new Date(w.at).toLocaleString()}</td><td><button class="chipf" data-wldel="${f.esc(w.ticker)}">Remove</button></td></tr>`).join('')}</tbody></table>`
        : '<div class="empty">No tickers yet. Analyze a company and press "Add".</div>'}</div>`;
  };
  window.RFC.Watchlist.add = function (s) {
    const wl = ls.get('rf:watchlist', []).filter(w => w.ticker !== s.co.ticker);
    wl.unshift({ ticker: s.co.ticker, name: s.co.name, profile: s.profileText, score: s.sc.score, G: s.sc.G, Y: s.sc.Y, R: s.sc.R, alerts: s.sc.greyNotOk, at: Date.now() });
    ls.set('rf:watchlist', wl);
  };
  window.RFC.Watchlist.remove = t => ls.set('rf:watchlist', ls.get('rf:watchlist', []).filter(w => w.ticker !== t));

  window.RFC.Thresholds = function (s) {
    const f = F();
    if (!s.cards) return '<div class="card mod empty">Analyze a ticker to see its active thresholds.</div>';
    return `<div class="card mod"><div class="mod-h"><h3>Active thresholds — ${f.esc(s.co.ticker)}</h3><span class="sub">from the Master Flag Library; grading code in src/engine/engine.js</span></div>
      <div style="overflow-x:auto"><table class="t"><thead><tr><th>ID</th><th>Category</th><th>Red flag</th><th>Formula</th><th>Green</th><th>Yellow</th><th>Red</th></tr></thead><tbody>
      ${s.cards.map(c => `<tr><td class="mono xs">${c.flag.id}</td><td class="xs">${f.esc(c.flag.catName)}</td><td>${f.esc(c.flag.name)}</td><td class="mono xs">${f.esc(c.flag.formula)}</td>
        <td class="xs tc-g">${f.esc(c.flag.g)}</td><td class="xs tc-y">${f.esc(c.flag.y)}</td><td class="xs tc-r">${f.esc(c.flag.r)}</td></tr>`).join('')}</tbody></table></div></div>`;
  };

  window.RFC.Reports = function () {
    const f = F(), rep = ls.get('rf:reports', []);
    return `<div class="card mod"><div class="mod-h"><h3>Audit reports</h3><span class="sub">exports from this browser · click to reopen and export again</span></div>
      ${rep.length ? `<table class="t"><thead><tr><th>Ticker</th><th>Fiscal year</th><th class="num">Score</th><th>Exported</th></tr></thead><tbody>
      ${rep.map(r => `<tr data-open="${f.esc(r.ticker)}" style="cursor:pointer"><td class="mono"><b>${f.esc(r.ticker)}</b></td><td>${f.esc(r.fy)}</td><td class="num">${r.score == null ? '—' : r.score}</td><td class="xs mute">${new Date(r.at).toLocaleString()}</td></tr>`).join('')}</tbody></table>`
        : '<div class="empty">No reports exported yet.</div>'}</div>`;
  };
  window.RFC.Reports.log = s => { const r = ls.get('rf:reports', []); r.unshift({ ticker: s.co.ticker, fy: s.co.fiscalYear, score: s.sc.score, at: Date.now() }); ls.set('rf:reports', r.slice(0, 50)); };
})();
