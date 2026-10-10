// Static-demo shim: lets the Quote Desk UI run with no server (e.g. on GitHub Pages).
// fetch('/api/...') is served from recorded JSON under ./api/, EventSource streams are
// replayed from recorded event lists with live-like pacing, and write actions explain
// that they need the live app. Generated alongside scripts/export_static.py.
(function () {
  const REC = 'api/';
  const realFetch = window.fetch.bind(window);
  const json = (obj, status) => new Response(JSON.stringify(obj), {status: status || 200, headers: {'content-type': 'application/json'}});
  const LIVE_ONLY = 'This hosted demo replays recorded runs. Pasting an RFQ and editing the Playbook need the live app: run `python serve.py` from the repo.';
  let cache = {};
  const load = (p) => (cache[p] = cache[p] || realFetch(REC + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); }));

  function search(q) {
    q = (q || '').toLowerCase();
    return Promise.all([load('rfqs.json'), load('customers.json'), load('catalog.json')]).then(([rfqs, cs, cat]) => {
      const out = [];
      rfqs.forEach(r => { if ((r.id + ' ' + r.subject + ' ' + r.customer).toLowerCase().includes(q)) out.push({kind: 'rfq', id: r.id, label: r.id + ' · ' + r.customer, sub: r.subject}); });
      cs.forEach(c => { if (c.name.toLowerCase().includes(q)) out.push({kind: 'buyer', id: c.id, label: c.name, sub: 'tier ' + c.tier}); });
      cat.parts.forEach(p => { if ((p.sku + ' ' + p.name + ' ' + (p.specs.standard || '')).toLowerCase().includes(q)) out.push({kind: 'item', id: p.sku, label: p.sku + ' · ' + p.name, sub: p.brand}); });
      return {results: out.slice(0, 10)};
    });
  }

  window.fetch = function (u, opts) {
    const url = typeof u === 'string' ? u : u.url;
    if (!url.startsWith('/api/')) return realFetch(u, opts);
    const path = url.slice(5).split('?')[0], qs = new URLSearchParams(url.split('?')[1] || '');
    const method = ((opts && opts.method) || 'GET').toUpperCase();
    if (method === 'POST') {
      if (path === 'brain/demo') return load('brain/demo.json').then(json);
      if (path === 'brain/reset') return load('brain.json').then(json);
      return Promise.resolve(json({detail: LIVE_ONLY}, 400));
    }
    if (path === 'search') return search(qs.get('q')).then(json);
    return load(path + '.json').then(json).catch(() => json({detail: 'not recorded in the static demo'}, 404));
  };

  class Replay {
    constructor(url) {
      this.listeners = {}; this.closed = false; this.onerror = null;
      const qs = new URLSearchParams(url.split('?')[1] || '');
      let src;
      if (url.startsWith('/api/stream/quote')) src = load('stream/quote/' + qs.get('rfq') + '.json');
      else src = load('stream/ask/index.json').then(idx => {
        const f = idx[(qs.get('q') || '').trim().toLowerCase()];
        if (f) return load(f);
        return [['user', {text: qs.get('q')}], ['step', {label: 'Hosted demo', status: 'done'}],
          ['token', {text: 'This hosted demo replays recorded answers, so free-form questions need the live app. Try one of the suggested questions, or run it locally for live Nicrron answers.'}],
          ['sources', {items: []}], ['done', {cached: true}]];
      });
      src.then(evs => this._play(evs, 0)).catch(() => this.onerror && this.onerror());
    }
    _play(evs, i) {
      if (this.closed || i >= evs.length) return;
      const [name, payload] = evs[i];
      (this.listeners[name] || []).forEach(fn => fn({data: JSON.stringify(payload)}));
      const wait = name === 'resolve' ? 380 : name === 'guard' ? 260 : name === 'token' ? 45 : name === 'step' ? 220 : 120;
      setTimeout(() => this._play(evs, i + 1), wait);
    }
    addEventListener(n, fn) { (this.listeners[n] = this.listeners[n] || []).push(fn); }
    close() { this.closed = true; }
  }
  window.EventSource = Replay;

  document.addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div');
    b.textContent = 'Hosted demo: recorded agent runs replayed in your browser. Live Nicrron + PRISM run in the full app.';
    b.style.cssText = 'background:#e8f6f4;color:#0b5f58;border-bottom:1px solid #c3e8e1;font:600 12px Inter,sans-serif;padding:6px 26px;text-align:center';
    const main = document.querySelector('.mainwrap');
    if (main) main.insertBefore(b, main.firstChild);
  });
})();
