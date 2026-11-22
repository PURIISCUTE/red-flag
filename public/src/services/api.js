/* API client for the FastAPI backend (POST /api/v1/analyze). Live data only — no offline demo. Override the base URL with ?api=https://your-app.onrender.com or the
   Settings box in the sidebar (stored in localStorage). */
(function () {
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  function defaultBase() {
    const qp = new URLSearchParams(location.search).get('api');
    if (qp) { store.set('rf:api', qp); return qp.replace(/\/$/, ''); }
    const saved = store.get('rf:api');
    if (saved) return saved.replace(/\/$/, '');
    if (location.protocol.startsWith('http')) return location.origin; // served by FastAPI
    return 'http://localhost:8000';
  }
  let BASE = defaultBase();
  let live = null; // null = unknown, true/false after health check

  async function req(path, opts = {}, timeout = 45000) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(BASE + path, { ...opts, signal: ctl.signal, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(body.detail || ('HTTP ' + r.status)), { status: r.status });
      return body;
    } finally { clearTimeout(t); }
  }

  window.RF_API = {
    get base() { return BASE; },
    setBase(b) { BASE = (b || '').replace(/\/$/, ''); store.set('rf:api', BASE); live = null; },
    get live() { return live; },
    async health() {
      try { await req('/api/v1/health', {}, 4000); live = true; } catch (e) { live = false; }
      return live;
    },
    async analyze(ticker) {
      try { const d = await req('/api/v1/analyze', { method: 'POST', body: JSON.stringify({ ticker }) }, 120000); live = true; return d; }
      catch (e) {
        if (e.status) throw e;
        live = false;
        throw Object.assign(new Error(e.name === 'AbortError'
          ? `SEC download for ${ticker} took too long — please try again (the second attempt uses the cache).`
          : `Can't reach the RedFlag API at ${BASE}. Check that the backend is running.`), { offline: true });
      }
    },
    async quote(ticker) { if (!live) return null; try { return await req('/api/v1/quote/' + encodeURIComponent(ticker), {}, 10000); } catch (e) { return null; } },
    async search(q) { if (!live || !q) return []; try { return await req('/api/v1/search?q=' + encodeURIComponent(q), {}, 5000); } catch (e) { return []; } }
  };
})();
