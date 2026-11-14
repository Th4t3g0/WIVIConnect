
const Store = (() => {
  const EVENTS_KEY = 'wivi-events';
  const D = (typeof CONFIG !== 'undefined' && CONFIG.DATA) || {};
  const isLive = () => Boolean(D.FORM_URL && D.SHEET_CSV_URL);
  const uid = () => Math.random().toString(36).slice(2, 10);
  const COLLECTIONS = ['products', 'requests', 'quotes', 'orders'];


  const SEED = { contractors: [], products: [] };

  let remoteEvents = [];                 // rows read from the Google Sheet
  const state = {};                      // the current data the app renders

  const readLocal = () => { try { return JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]'); } catch { return []; } };
  const writeLocal = list => localStorage.setItem(EVENTS_KEY, JSON.stringify(list));

  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        rows.push(row); row = [];
      } else field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  // Replay all events (sheet first)
  function rebuild() {
    const maps = {};
    COLLECTIONS.forEach(c => maps[c] = new Map());
    SEED.products.forEach(p => maps.products.set(p.id, { ...p }));

    const seen = new Set();
    for (const ev of [...remoteEvents, ...readLocal()]) {
      if (seen.has(ev.eid)) continue;          
      seen.add(ev.eid);
      const map = maps[ev.collection];
      if (!map) continue;
      map.set(ev.id, { ...(map.get(ev.id) || {}), ...ev.data });
    }

    state.contractors = SEED.contractors;
    COLLECTIONS.forEach(c => { state[c] = [...maps[c].values()].filter(x => !x._deleted); });
  }

  function markSent(eid) {
    writeLocal(readLocal().map(e => e.eid === eid ? { ...e, sent: true } : e));
  }

  function post(ev) {
    const E = D.ENTRIES;
    const body = new URLSearchParams();
    body.append(E.eid, ev.eid);
    body.append(E.collection, ev.collection);
    body.append(E.id, ev.id);
    body.append(E.data, JSON.stringify(ev.data));
    // 
    return fetch(D.FORM_URL, { method: 'POST', mode: 'no-cors', body }).then(() => markSent(ev.eid));
  }

  // Save a change. Shows up in the app immediately, then goes to Google.
  function commit(collection, id, data) {
    const ev = { eid: uid(), collection, id, data };
    writeLocal([...readLocal(), ev]);
    rebuild();
    if (isLive()) post(ev).catch(() => {});     // retried on next sync if it fails
    return ev;
  }

  // Pull the latest rows from the Google Sheet
  async function sync() {
    if (isLive()) {
      try {
        const sep = D.SHEET_CSV_URL.includes('?') ? '&' : '?';
        const res = await fetch(D.SHEET_CSV_URL + sep + 't=' + Date.now());
        if (!res.ok) throw new Error('Sheet not readable');
        const rows = parseCSV(await res.text());
        const head = rows.shift().map(h => h.trim());
        const col = n => head.indexOf(n);
        remoteEvents = rows.map(r => {
          try {
            return { eid: r[col('eid')], collection: r[col('collection')], id: r[col('id')], data: JSON.parse(r[col('data')]) };
          } catch { return null; }
        }).filter(e => e && e.eid);

        // Forget local copies that Google now has; re-send any that never went out
        const published = new Set(remoteEvents.map(e => e.eid));
        const pending = readLocal().filter(e => !published.has(e.eid));
        writeLocal(pending);
        pending.filter(e => !e.sent).forEach(e => post(e).catch(() => {}));
      } catch (err) {
        console.warn('Sync failed:', err.message);
      }
    }
    rebuild();
  }

  rebuild();
  return { state, commit, sync, uid, isLive };
})();
