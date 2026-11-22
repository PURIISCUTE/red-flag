(function () {
  const F = () => window.RF_FMT;
  window.RFC.FinancialTable = function (s) {
    const f = F(), co = s.co, ys = co.years, tabs = Object.keys(window.RF_FINROWS), rows = window.RF_FINROWS[s.finTab];
    const fin = co.fin, prevOf = y => fin[y - 1] || null;
    const ttm = co.ttm;
    const body = rows.map(r => {
      const vals = ys.map(y => { try { return r.v(fin[y] || {}); } catch (e) { return null; } });
      const tv = ttm ? (() => { try { return r.v(ttm); } catch (e) { return null; } })() : null;
      const anoms = r.anomaly ? ys.map(y => { try { return r.anomaly(fin[y] || {}, prevOf(y)); } catch (e) { return null; } }) : ys.map(() => null);
      const first = vals.find(v => v != null), last = [...vals].reverse().find(v => v != null);
      let trend = '';
      if (first != null && last != null && vals.filter(v => v != null).length >= 2) {
        if (['m', 'sh'].includes(r.fmt) && first > 0 && last > 0) { const n = vals.filter(v => v != null).length - 1; const cagr = (Math.pow(last / first, 1 / n) - 1) * 100; trend = `${cagr >= 0 ? '+' : ''}${cagr.toFixed(1)}%/yr`; }
        else trend = `${last - first >= 0 ? '+' : ''}${f.metric(last - first, r.fmt === '%' ? 'pts' : r.fmt).replace('+', '')}`;
      }
      const sig = anoms.map((a, i) => a ? `<span class="pill st-r">FY${ys[i]}: ${f.esc(a)}</span>` : '').filter(Boolean);
      return `<tr class="${sig.length ? 'anom' : ''}"><td>${f.esc(r.label)}</td>${vals.map((v, i) => `<td class="num ${anoms[i] ? 'cellflag' : ''}">${f.esc(f.metric(v, r.fmt))}</td>`).join('')}
        <td class="num">${f.esc(f.metric(tv, r.fmt))}</td><td class="num">${f.sparkline([...vals, tv])}<div class="xs mute">${f.esc(trend)}</div></td>
        <td class="sig">${sig.length ? sig.join(' ') : '<span class="pill st-g">Normal</span>'}</td></tr>`;
    }).join('');
    return `<div class="card mod fin"><div class="mod-h"><h3>3-Year + TTM financial forensics</h3><span class="sub">${ttm ? 'TTM through ' + f.esc(ttm._asOf) + ' (latest 10-Q YTD + FY − prior YTD)' : 'TTM needs the live backend (computed from the latest 10-Q)'}</span></div>
      <div class="tabs">${tabs.map(t => `<button data-fin="${t}" class="${s.finTab === t ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div style="overflow-x:auto"><table class="t"><thead><tr><th>Metric</th>${ys.map((y, i) => `<th class="num">FY-${ys.length - i} · ${y}</th>`).join('')}<th class="num">TTM (Live)</th><th class="num">3Y trend</th><th>Anomaly signal</th></tr></thead><tbody>${body}</tbody></table></div>
      <div class="xs mute" style="margin-top:8px">$ millions. Source: ${f.esc(co.sources ? co.sources.statements : 'SEC EDGAR')}</div></div>`;
  };
})();
