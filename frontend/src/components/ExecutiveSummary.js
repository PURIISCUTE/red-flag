(function () {
  window.RFC.ExecutiveSummary = function (s) {
    return `<div class="card mod ai"><div class="mod-h"><span style="color:var(--brand)">${window.RFC.icon('sparkles', 18)}</span><h3>Executive summary</h3>
      <span class="sub">generated from the graded flags — same inputs, same thesis</span></div>
      <ul>${s.summary.map(b => `<li>${b}</li>`).join('')}</ul>
      <div class="filters" style="margin:6px 0 0"><span class="tag src">SEC EDGAR Primary</span><span class="tag src">${s.co.quote ? 'Yahoo Finance' : 'TradingView live'}</span><span class="tag src">Master Flag Library thresholds</span></div></div>`;
  };
})();
