/* Live price chart: TradingView advanced chart (streams ticks; Yahoo-style area chart and ranges). */
(function () {
  const RANGES = [['1D', '1D'], ['5D', '5D'], ['1M', '1M'], ['6M', '6M'], ['YTD', 'YTD'], ['1Y', '12M'], ['5Y', '60M'], ['Max', 'ALL']];
  const EXCH = { Nasdaq: 'NASDAQ', NASDAQ: 'NASDAQ', NYSE: 'NYSE', 'NYSE American': 'AMEX', 'NYSE Arca': 'AMEX', CBOE: 'CBOE' };
  let cur = { sym: null, range: '1D' };

  function embed(el, script, cfg) {
    el.innerHTML = '';
    const c = document.createElement('div'); c.className = 'tradingview-widget-container'; c.style.height = '100%';
    const w = document.createElement('div'); w.className = 'tradingview-widget-container__widget'; w.style.height = '100%'; c.appendChild(w);
    const sc = document.createElement('script'); sc.src = 'https://s3.tradingview.com/external-embedding/' + script; sc.async = true; sc.text = JSON.stringify(cfg);
    c.appendChild(sc); el.appendChild(c);
  }
  function draw() {
    const el = document.getElementById('tv-chart'); if (!el || !cur.sym) return;
    embed(el, 'embed-widget-advanced-chart.js', { autosize: true, symbol: cur.sym, range: cur.range, timezone: 'America/New_York', theme: 'dark', style: '3',
      locale: 'en', backgroundColor: 'rgba(20,25,37,1)', gridColor: 'rgba(255,255,255,0.05)', hide_side_toolbar: true, allow_symbol_change: false,
      save_image: false, calendar: false, support_host: 'https://www.tradingview.com' });
  }
  window.RFC.LiveChart = function (s) {
    return `<div class="card mod"><div class="mod-h"><h3>Live market</h3><span class="sub">streams tick-by-tick while the market is open</span>
      <div class="chart-ranges" id="ranges">${RANGES.map(([l, v]) => `<button data-range="${v}" class="${v === cur.range ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div id="tv-chart"></div>
      <div class="xs mute" style="margin-top:6px">Chart data: TradingView. <a href="https://finance.yahoo.com/quote/${encodeURIComponent(s.co.ticker)}" target="_blank" rel="noopener">Open ${window.RF_FMT.esc(s.co.ticker)} on Yahoo Finance ↗</a></div></div>`;
  };
  window.RFC.LiveChart.mount = function (s) {
    const ex = EXCH[s.co.exchange] || EXCH[(s.co.exchange || '').toUpperCase()];
    const sym = (ex ? ex + ':' : '') + s.co.ticker.replace('-', '.');
    if (sym !== cur.sym || !document.querySelector('#tv-chart iframe, #tv-chart script')) { cur.sym = sym; draw(); }
  };
  window.RFC.LiveChart.setRange = function (r) { cur.range = r; document.querySelectorAll('#ranges button').forEach(b => b.classList.toggle('on', b.dataset.range === r)); draw(); };
})();
