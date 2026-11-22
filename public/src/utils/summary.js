/* Executive summary: 4 bullets generated deterministically from the graded flags and statements,
   so the same ticker always produces the same thesis. */
(function () {
  const pct = (a, b) => (a / b - 1) * 100;
  window.RF_SUMMARY = function (state) {
    const { co, cards, sc, plan, s1, s2 } = state;
    const F = co.fin, ys = co.years, y3 = ys[ys.length - 1], y1 = ys[0];
    const names = co.subNames || {};
    const nm = s => s === 'ALL' ? 'Universal' : (names[s] || s);
    const tier = sc.score == null ? 'not yet scorable' : sc.score >= 80 ? 'low forensic risk' : sc.score >= 60 ? 'moderate forensic risk' : 'elevated forensic risk';
    const worstCats = window.RF.CATS.map(c => ({ c, n: cards.filter(x => x.flag.cat === c && !x.flag._dupOf && (x.res.status === 'R' || x.res.status === 'Y')).length,
      r: cards.filter(x => x.flag.cat === c && !x.flag._dupOf && x.res.status === 'R').length }))
      .filter(x => x.n).sort((a, b) => b.r - a.r || b.n - a.n).slice(0, 2).map(x => cards.find(k => k.flag.cat === x.c).flag.catName);
    const b1 = `<b>Accounting health:</b> Composite score ${sc.score == null ? '—' : sc.score}/100 (${tier}) across ${sc.counted} unique flags — ${sc.G} green, ${sc.Y} yellow, ${sc.R} red. ` +
      `Profile locked as ${s2 ? `a hybrid of ${nm(s1)} and ${nm(s2)}` : `a pure-play ${nm(s1)}`}${worstCats.length ? `; pressure concentrates in ${worstCats.join(' and ')}.` : '; no category shows concentrated stress.'}`;

    let b2 = '<b>Cash conversion:</b> insufficient cash-flow data.';
    if (F[y3] && F[y3].cfo != null && F[y3].ni) {
      const c3 = F[y3].cfo / F[y3].ni, c1 = F[y1] && F[y1].cfo != null && F[y1].ni ? F[y1].cfo / F[y1].ni : null;
      const fcf = F[y3].capex != null ? F[y3].cfo - F[y3].capex : null;
      b2 = `<b>Cash conversion:</b> CFO covered net income ${c3.toFixed(2)}x in FY${y3}${c1 != null ? ` (vs ${c1.toFixed(2)}x in FY${y1})` : ''}` +
        `${fcf != null ? `; free cash flow was $${(fcf / 1000).toFixed(1)}B` : ''}. ` +
        (c3 < 0.8 ? 'Reported earnings are running ahead of cash — a classic accrual warning.' : c1 != null && c3 < c1 - 0.15 ? 'Conversion is weakening and deserves monitoring.' : 'Earnings remain well backed by operating cash.');
    }
    const hits = cards.filter(c => !c.flag._dupOf && (c.res.status === 'R' || c.res.status === 'Y'))
      .sort((a, b) => (a.res.status === 'R' ? 0 : 1) - (b.res.status === 'R' ? 0 : 1)).slice(0, 3);
    const alerts = cards.filter(c => c.res.status === 'GREY_NOT_OK' && !c.flag._dupOf);
    const b3 = `<b>Major flags:</b> ` + (hits.length ? hits.map(h => `${h.flag.name} (${h.res.status === 'R' ? 'RED' : 'YELLOW'}${h.res.vals && h.res.latestY ? ', ' + window.RF_FMT.metric(h.res.vals[h.res.latestY], h.res.fmt) : ''})`).join('; ') + '.' : 'no red or yellow flags.') +
      (alerts.length ? ` Disclosure alerts: ${alerts.map(a => (a.res.missing || []).join(', ')).join('; ')} not reported.` : '');
    const growth = F[y1] && F[y3] && F[y1].rev ? pct(F[y3].rev, F[y1].rev) : null;
    const b4 = `<b>Data sources:</b> SEC EDGAR primary (${co.form || '10-K'} filed ${co.filed || '—'}, FY${ys[0]}–FY${y3}${growth != null ? `, revenue ${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% over the window` : ''})` +
      `${co.ttm ? `; TTM through ${co.ttm._asOf} from 10-Q` : ''}; market data from ${co.quote ? 'Yahoo Finance' : 'TradingView live feed'}. Coverage ${Math.round(sc.coverage * 100)}% — ${sc.greyOk} flags not applicable to this business model.`;
    return [b1, b2, b3, b4];
  };
})();
