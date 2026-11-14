/* Data layer for requests, quotes, products and orders.

   Every change is saved as an "event": (collection, id, data).
   - A new item is an event with the full object.
   - An update is an event with just the changed fields (e.g. {status:'Accepted'}).
   - A delete is an event with {_deleted:true}.
   The app replays all events in order to build its current data.

   LIVE MODE : events are posted to a Google Form and read back from the
               published Google Sheet (CONFIG.DATA in config.js).
   DEMO MODE : if CONFIG.DATA is empty, events are kept in this browser only. */

const Store = (() => {
  const EVENTS_KEY = 'wivi-events';
  const D = (typeof CONFIG !== 'undefined' && CONFIG.DATA) || {};
  const isLive = () => Boolean(D.FORM_URL && D.SHEET_CSV_URL);
  const uid = () => Math.random().toString(36).slice(2, 10);
  const COLLECTIONS = ['products', 'requests', 'quotes', 'orders'];

  // Starting data that every user sees
  const SEED = {
    contractors: [
      { id: 'c1', name: 'BuildRight Construction', category: 'Construction', location: 'Johannesburg', rating: 4.8, rate: 450 },
      { id: 'c2', name: 'Spark Electrical',        category: 'Electrical',   location: 'Pretoria',     rating: 4.5, rate: 380 },
      { id: 'c3', name: 'FlowFix Plumbing',        category: 'Plumbing',     location: 'Johannesburg', rating: 4.2, rate: 320 },
      { id: 'c4', name: 'ColourCraft Painters',    category: 'Painting',     location: 'Sandton',      rating: 4.6, rate: 290 },
    ],
    products: [
      { id: 'p1', supplierId: 's1', supplier: 'BuildMart Hardware', name: 'Cement 50kg',        category: 'Building materials', price: 115, stock: 200 },
      { id: 'p2', supplierId: 's1', supplier: 'BuildMart Hardware', name: 'Cordless Drill',     category: 'Tools & equipment',  price: 899, stock: 25 },
      { id: 'p3', supplierId: 's1', supplier: 'BuildMart Hardware', name: 'Interior Paint 20L', category: 'Paint & finishing',  price: 749, stock: 60 },
      { id: 'p4', supplierId: 's1', supplier: 'BuildMart Hardware', name: 'PVC Pipe 3m',        category: 'Plumbing',           price: 89,  stock: 120 },
    ],
  };

  let remoteEvents = [];                 // rows read from the Google Sheet
  const state = {};                      // the current data the app renders

  const readLocal = () => { try { return JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]'); } catch { return []; } };
  const writeLocal = list => localStorage.setItem(EVENTS_KEY, JSON.stringify(list));

  // Minimal CSV parser (handles quoted fields)
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

  // Replay all events (sheet first, then not-yet-published local ones)
  function rebuild() {
    const maps = {};
    COLLECTIONS.forEach(c => maps[c] = new Map());
    SEED.products.forEach(p => maps.products.set(p.id, { ...p }));

    const seen = new Set();
    for (const ev of [...remoteEvents, ...readLocal()]) {
      if (seen.has(ev.eid)) continue;           // same event from sheet + local
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
    // no-cors: we can't read the reply, but Google still records the response
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
