(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (v, dp = 0) => v == null || !isFinite(v) ? '—' : (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: dp, minimumFractionDigits: dp }) + 'M';
  const big = v => { if (v == null || !isFinite(v)) return '—'; const a = Math.abs(v);
    return a >= 1e12 ? '$' + (v / 1e12).toFixed(2) + 'T' : a >= 1e9 ? '$' + (v / 1e9).toFixed(2) + 'B' : a >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : '$' + v.toFixed(0); };
  function metric(v, fmt) {
    if (v == null || (typeof v === 'number' && !isFinite(v))) return '—';
    if (fmt === 'combo') return (v.inv != null ? 'Inv ' + (v.inv >= 0 ? '+' : '') + v.inv.toFixed(1) + '% · ' : '') + 'GM ' + (v.gm >= 0 ? '+' : '') + v.gm.toFixed(0) + ' bps';
    if (fmt === '%') return v.toFixed(1) + '%';
    if (fmt === 'pts') return (v >= 0 ? '+' : '') + v.toFixed(1) + ' pts';
    if (fmt === 'x') return v.toFixed(2) + 'x';
    if (fmt === 'bps') return (v >= 0 ? '+' : '') + v.toFixed(0) + ' bps';
    if (fmt === 'days') return v.toFixed(1) + ' d';
    if (fmt === 'yrs') return v + ' yr' + (v === 1 ? '' : 's');
    if (fmt === 'm') return money(v);
    if (fmt === 'sh') return (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 }) + 'M sh';
    return v.toFixed(2);
  }
  const STATUS = {
    G: { label: 'GREEN', cls: 'st-g' }, Y: { label: 'YELLOW', cls: 'st-y' }, R: { label: 'RED', cls: 'st-r' },
    GREY_OK: { label: 'N/A', cls: 'st-na' }, GREY_NOT_OK: { label: 'DISCLOSURE ALERT', cls: 'st-alert' }, PENDING: { label: 'NO EVALUATOR', cls: 'st-na' }
  };
  function sparkline(vals, w = 84, h = 22) {
    const pts = vals.filter(v => v != null && isFinite(v));
    if (pts.length < 2) return '';
    const min = Math.min(...pts), max = Math.max(...pts), rng = max - min || 1;
    const step = w / (vals.length - 1);
    const xy = vals.map((v, i) => v == null || !isFinite(v) ? null : [i * step, h - 3 - ((v - min) / rng) * (h - 6)]).filter(Boolean);
    const up = pts[pts.length - 1] >= pts[0];
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="spark"><polyline fill="none" stroke="${up ? '#10B981' : '#EF4444'}" stroke-width="1.6" points="${xy.map(p => p.join(',')).join(' ')}"/>${xy.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="1.8" fill="${up ? '#10B981' : '#EF4444'}"/>`).join('')}</svg>`;
  }
  window.RF_FMT = { esc, money, big, metric, STATUS, sparkline };
})();
