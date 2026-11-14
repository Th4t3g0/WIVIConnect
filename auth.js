/* Auth layer: register + login.
   WRITE -> posts to a Google Form (no-cors).
   READ  -> fetches the form's response sheet, published as CSV.
FOR DEMO PUPOSES ONLY THIS IS A DEMO AND NOT FOR PRODUCTION */

const Auth = (() => {
  const USERS_KEY = 'wivi-users';
  const SESSION_KEY = 'wivi-session';

  const isLive = () => Boolean(CONFIG.FORM_URL && CONFIG.SHEET_CSV_URL);
  const localUsers = () => JSON.parse(localStorage.getItem(USERS_KEY) || '[]');

  // Passwords are hashed in the browser so plain text never reaches the sheet.
  // DEMO ONLY
  async function hash(email, password) {
    const text = email.toLowerCase() + ':' + password;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return btoa(text); // fallback if crypto.subtle is unavailable
  }

  // Minimal CSV parse
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

  async function remoteUsers() {
    const sep = CONFIG.SHEET_CSV_URL.includes('?') ? '&' : '?';
    const res = await fetch(CONFIG.SHEET_CSV_URL + sep + 't=' + Date.now());
    if (!res.ok) throw new Error('Could not read the user sheet. Check SHEET_CSV_URL.');
    const rows = parseCSV(await res.text());
    const head = rows.shift().map(h => h.trim());
    return rows
      .filter(r => r.length > 1)
      .map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
  }

  // Sheet users + users registered in this browser (so login works instantly,
  // 
  async function allUsers() {
    const local = localUsers();
    if (!isLive()) return local;
    let remote = [];
    try { remote = await remoteUsers(); }
    catch (err) { if (!local.length) throw err; }
    const seen = new Set(remote.map(u => (u.email || '').toLowerCase()));
    return [...remote, ...local.filter(u => !seen.has(u.email.toLowerCase()))];
  }

  // Registered contractors (no passwords) for the "Find Contractors" page
  async function contractors() {
    const users = await allUsers();
    return users
      .filter(u => u.role === 'contractor')
      .map(u => ({ id: u.id, name: u.name, location: u.details || '' }));
  }

  async function submitToForm(user) {
    const E = CONFIG.ENTRIES;
    const body = new URLSearchParams();
    body.append(E.id, user.id);
    body.append(E.role, user.role);
    body.append(E.name, user.name);
    body.append(E.email, user.email);
    body.append(E.passwordHash, user.passwordHash);
    body.append(E.details, user.details);
    // no-cors: we can't read the reply, but Google still records the response.
    await fetch(CONFIG.FORM_URL, { method: 'POST', mode: 'no-cors', body });
  }

  const publicUser = u => ({ id: u.id, role: u.role, name: u.name, email: u.email });

  async function register({ role, name, email, password, details }) {
    email = email.trim().toLowerCase();
    if (password.length < 4) throw new Error('Password must be at least 4 characters.');
    const users = await allUsers();
    if (users.some(u => (u.email || '').toLowerCase() === email))
      throw new Error('That email is already registered. Try logging in.');

    const user = {
      id: role[0] + Math.random().toString(36).slice(2, 8),
      role, name: name.trim(), email,
      passwordHash: await hash(email, password),
      details: (details || '').trim(),
    };
    if (isLive()) await submitToForm(user);
    localStorage.setItem(USERS_KEY, JSON.stringify([...localUsers(), user]));
    localStorage.setItem(SESSION_KEY, JSON.stringify(publicUser(user)));
    return publicUser(user);
  }

  async function login(email, password) {
    email = email.trim().toLowerCase();
    const users = await allUsers();
    const user = users.find(u => (u.email || '').toLowerCase() === email);
    if (!user || user.passwordHash !== await hash(email, password))
      throw new Error('Incorrect email or password. (New accounts can take a few minutes to appear.)');
    localStorage.setItem(SESSION_KEY, JSON.stringify(publicUser(user)));
    return publicUser(user);
  }

  return {
    isLive, register, login, contractors,
    logout: () => localStorage.removeItem(SESSION_KEY),
    currentUser: () => JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'),
  };
})();
