(function () {
  window.RFC = window.RFC || {};
  const I = (d, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    watchlist: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    thresholds: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    reports: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
    sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'
  };
  window.RFC.icon = (n, s) => I(ICONS[n], s);

  window.RFC.Sidebar = function (s) {
    const live = window.RF_API.live;
    const nav = [['dashboard', 'Dashboard'], ['watchlist', 'Watchlist'], ['thresholds', 'Thresholds'], ['reports', 'Audit Reports']];
    return `<div class="brand"><div class="brand-mark">${I(ICONS.flag, 17)}</div><div class="brand-name">RED<b>FLAG</b> Terminal<span class="brand-badge">BETA</span></div></div>
      <nav class="nav">${nav.map(([k, l]) => `<button data-nav="${k}" class="${s.view === k ? 'active' : ''}">${I(ICONS[k])}<span>${l}</span></button>`).join('')}</nav>
      <div class="side-foot">
        <div class="feed"><span class="pulse ${live ? '' : 'amber'}"></span><span class="txt">${live ? 'SEC EDGAR • Yahoo Finance • Benchmarks' : live === false ? 'Offline demo — backend not reachable' : 'Connecting…'}</span></div>
        <div class="api-box"><input id="apiBase" value="${window.RF_FMT.esc(window.RF_API.base)}" title="Backend URL"><button id="apiSave">Set</button></div>
      </div>`;
  };
})();
