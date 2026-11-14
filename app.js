/* WIVI Connect – front-end template
   Accounts: Google Form + Sheet (auth.js)
   App data: Google Form + Sheet (data.js) */

const ME = {                       // filled in with the real account at login
  client:     { id: 'u1', name: 'Demo Client' },
  contractor: { id: 'c1', name: 'BuildRight Construction' },
  supplier:   { id: 's1', name: 'BuildMart Hardware' },
};

const TABS = {
  client: [
    ['client-quote', 'Request Quote'],
    ['client-contractors', 'Find Contractors'],
    ['client-requests', 'My Requests'],
    ['client-shop', 'Hardware Shop'],
  ],
  contractor: [
    ['contractor-requests', 'Open Requests'],
    ['contractor-quotes', 'My Quotes'],
  ],
  supplier: [
    ['supplier-products', 'Products'],
    ['supplier-orders', 'Orders'],
  ],
};

/* ---------- Data ---------- */
const db = Store.state;            // always the latest data (contractors, products, requests, quotes, orders)

// The cart is personal to this device, so it stays in the browser
let cart = JSON.parse(localStorage.getItem('wivi-cart') || '[]');
const saveCart = () => localStorage.setItem('wivi-cart', JSON.stringify(cart));

const money = n => 'R' + Number(n).toFixed(2);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = id => document.getElementById(id);

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- Tab navigation ---------- */
let role = 'client';
let activeTab = null;

function setRole(r) {
  role = r;
  $('tabs').innerHTML = TABS[r].map(([id, label]) =>
    `<button data-tab="${id}">${label}</button>`).join('');
  showTab(TABS[r][0][0]);
}

function showTab(id) {
  activeTab = id;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  render();
  Store.sync().then(refreshView);              // fetch the latest from Google
}

// Re-draw after a sync, but never while someone is typing in a form
function refreshView() {
  const a = document.activeElement;
  if (a && a.closest && a.closest('form')) return;
  render();
}

$('tabs').addEventListener('click', e => { if (e.target.dataset.tab) showTab(e.target.dataset.tab); });
setInterval(() => Store.sync().then(refreshView), 30000);

/* ---------- Rendering ---------- */
function render() {
  ({
    'client-contractors':  renderContractors,
    'client-requests':     renderMyRequests,
    'client-shop':         renderShop,
    'contractor-requests': renderOpenRequests,
    'contractor-quotes':   renderMyQuotes,
    'supplier-products':   renderSupplierProducts,
    'supplier-orders':     renderSupplierOrders,
  }[activeTab] || (() => {}))();
}

const empty = msg => `<div class="empty card">${msg}</div>`;

/* Client: contractor search */
function fillSelect(sel, values, first) {
  if (sel.dataset.filled) return;
  sel.innerHTML = `<option value="">${first}</option>` + values.map(v => `<option>${esc(v)}</option>`).join('');
  sel.dataset.filled = '1';
}

function renderContractors() {
  fillSelect($('cCategory'), [...new Set(db.contractors.map(c => c.category))], 'All categories');
  const q = $('cSearch').value.toLowerCase();
  const cat = $('cCategory').value;
  const sort = $('cSort').value;
  const list = db.contractors
    .filter(c => (!cat || c.category === cat) && (c.name + c.location).toLowerCase().includes(q))
    .sort((a, b) => sort === 'price' ? a.rate - b.rate : b.rating - a.rating);

  $('contractorList').innerHTML = list.map(c => `
    <div class="card">
      <h3>${esc(c.name)}</h3>
      <div class="muted">${esc(c.category)} · ${esc(c.location)}</div>
      <div><span class="stars">★</span> ${c.rating.toFixed(1)}</div>
      <div class="price">From ${money(c.rate)}/hr</div>
    </div>`).join('') || empty('No contractors match your search.');
}

/* Client: my requests with incoming quotes */
function renderMyRequests() {
  const mine = db.requests.filter(r => r.clientId === ME.client.id).reverse();
  $('myRequests').innerHTML = mine.map(r => {
    const quotes = db.quotes.filter(q => q.requestId === r.id);
    return `
      <div class="card">
        <h3>${esc(r.title)} <span class="badge ${r.status === 'Accepted' ? 'good' : ''}">${r.status}</span></h3>
        <div class="muted">${esc(r.category)} · ${esc(r.location)}${r.budget ? ' · Budget ' + money(r.budget) : ''}</div>
        <p>${esc(r.description)}</p>
        ${(r.files || []).length ? `<div class="muted">📎 ${r.files.map(esc).join(', ')}</div>` : ''}
        <strong>Quotes (${quotes.length})</strong>
        ${quotes.map(q => `
          <div class="quote-line">
            <div>${esc(q.contractorName)}<div class="muted">${q.days} days · ${esc(q.note || '')}</div></div>
            <div><span class="price">${money(q.price)}</span>
              ${r.status === 'Open'
                ? `<button class="btn small good" data-accept="${q.id}">Accept</button>`
                : (q.status === 'Accepted' ? '<span class="badge good">Accepted</span>' : '')}
            </div>
          </div>`).join('') || '<div class="muted">No quotes yet.</div>'}
      </div>`;
  }).join('') || empty('You have not requested any quotes yet.');
}

/* Client: shop */
function renderShop() {
  fillSelect($('pCategory'), [...new Set(db.products.map(p => p.category))], 'All categories');
  const q = $('pSearch').value.toLowerCase();
  const cat = $('pCategory').value;
  $('productGrid').innerHTML = db.products
    .filter(p => (!cat || p.category === cat) && p.name.toLowerCase().includes(q))
    .map(p => `
      <div class="card">
        <h3>${esc(p.name)}</h3>
        <div class="muted">${esc(p.category)} · ${esc(p.supplier)}</div>
        <div class="price">${money(p.price)}</div>
        <div class="muted">${p.stock} in stock</div>
        <button class="btn small" data-add="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>Add to cart</button>
      </div>`).join('') || empty('No products found.');

  let total = 0;
  $('cartItems').innerHTML = cart.map(i => {
    const p = db.products.find(x => x.id === i.productId);
    if (!p) return '';
    total += p.price * i.qty;
    return `<div class="cart-item"><span>${esc(p.name)} × ${i.qty}</span>
      <span>${money(p.price * i.qty)} <a href="#" data-remove="${p.id}">✕</a></span></div>`;
  }).join('') || '<div class="muted">Cart is empty.</div>';
  $('cartTotal').textContent = money(total);
}

/* Contractor */
function renderOpenRequests() {
  const open = db.requests.filter(r => r.status === 'Open').reverse();
  $('openRequests').innerHTML = open.map(r => {
    const already = db.quotes.some(q => q.requestId === r.id && q.contractorId === ME.contractor.id);
    return `
      <div class="card">
        <h3>${esc(r.title)}</h3>
        <div class="muted">${esc(r.category)} · ${esc(r.location)}${r.budget ? ' · Budget ' + money(r.budget) : ''}</div>
        <p>${esc(r.description)}</p>
        ${already ? '<span class="badge good">Quote submitted</span>' : `
        <form class="inline-form" data-quote="${r.id}">
          <label>Price (R)<input name="price" type="number" min="1" required></label>
          <label>Days<input name="days" type="number" min="1" required></label>
          <label>Note<input name="note" placeholder="Optional"></label>
          <button class="btn small" type="submit">Send quote</button>
        </form>`}
      </div>`;
  }).join('') || empty('No open requests right now.');
}

function renderMyQuotes() {
  const mine = db.quotes.filter(q => q.contractorId === ME.contractor.id).reverse();
  $('myQuotes').innerHTML = mine.map(q => {
    const r = db.requests.find(x => x.id === q.requestId);
    return `
      <div class="card">
        <h3>${esc(r ? r.title : 'Request removed')}
          <span class="badge ${q.status === 'Accepted' ? 'good' : 'warn'}">${q.status}</span></h3>
        <div class="price">${money(q.price)}</div>
        <div class="muted">${q.days} days · ${esc(q.note || '')}</div>
      </div>`;
  }).join('') || empty('You have not submitted any quotes.');
}

/* Supplier */
function renderSupplierProducts() {
  const mine = db.products.filter(p => p.supplierId === ME.supplier.id);
  $('supplierProducts').innerHTML = mine.map(p => `
    <div class="card">
      <h3>${esc(p.name)}</h3>
      <div class="muted">${esc(p.category)}</div>
      <div class="price">${money(p.price)}</div>
      <div class="muted">${p.stock} in stock</div>
      <button class="btn small ghost" data-delete="${p.id}">Remove</button>
    </div>`).join('') || empty('No products listed yet.');
}

function renderSupplierOrders() {
  const mine = db.orders.filter(o => o.items.some(i => i.supplierId === ME.supplier.id)).reverse();
  $('supplierOrders').innerHTML = mine.map(o => `
    <div class="card">
      <h3>Order #${esc(o.id)} <span class="badge ${o.status === 'Delivered' ? 'good' : 'warn'}">${o.status}</span></h3>
      <div class="muted">${new Date(o.date).toLocaleString()}</div>
      ${o.items.filter(i => i.supplierId === ME.supplier.id).map(i =>
        `<div class="quote-line"><span>${esc(i.name)} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`).join('')}
      ${o.status !== 'Delivered' ? `<button class="btn small good" data-deliver="${o.id}">Mark delivered</button>` : ''}
    </div>`).join('') || empty('No orders yet.');
}

/* ---------- Event handlers (inputs) ---------- */

// Client: submit quote request
$('quoteForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const id = Store.uid();
  Store.commit('requests', id, {
    id, clientId: ME.client.id, status: 'Open',
    title: f.get('title'), category: f.get('category'), location: f.get('location'),
    budget: f.get('budget'), description: f.get('description'),
    files: [...e.target.files.files].map(x => x.name),   // file names only (uploads need extra setup)
  });
  e.target.reset(); toast('Request sent to contractors');
  showTab('client-requests');
});

// Filters
['cSearch', 'cCategory', 'cSort'].forEach(id => $(id).addEventListener('input', renderContractors));
['pSearch', 'pCategory'].forEach(id => $(id).addEventListener('input', renderShop));

// Supplier: add product
$('productForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const id = Store.uid();
  Store.commit('products', id, {
    id, supplierId: ME.supplier.id, supplier: ME.supplier.name,
    name: f.get('name'), category: f.get('category'),
    price: +f.get('price'), stock: +f.get('stock'),
  });
  e.target.reset(); toast('Product added'); renderSupplierProducts();
});

// Checkout
$('checkoutBtn').addEventListener('click', () => {
  if (!cart.length) return toast('Cart is empty');
  const items = cart.map(i => {
    const p = db.products.find(x => x.id === i.productId);
    return p && { productId: p.id, supplierId: p.supplierId, name: p.name, price: p.price, qty: i.qty };
  }).filter(Boolean);

  items.forEach(i => {
    const p = db.products.find(x => x.id === i.productId);
    Store.commit('products', p.id, { stock: Math.max(0, p.stock - i.qty) });
  });
  const oid = Store.uid().toUpperCase();
  Store.commit('orders', oid, { id: oid, clientId: ME.client.id, items, status: 'Pending', date: Date.now() });

  cart = []; saveCart();
  toast('Order placed'); renderShop();
});

// Delegated clicks + forms for dynamically rendered content
document.addEventListener('click', e => {
  const d = e.target.dataset;

  if (d.accept) {
    const q = db.quotes.find(x => x.id === d.accept);
    const others = db.quotes.filter(x => x.requestId === q.requestId && x.id !== q.id);
    Store.commit('quotes', q.id, { status: 'Accepted' });
    Store.commit('requests', q.requestId, { status: 'Accepted' });
    others.forEach(x => Store.commit('quotes', x.id, { status: 'Declined' }));
    toast('Quote accepted'); render();
  }
  if (d.add) {
    const item = cart.find(i => i.productId === d.add);
    item ? item.qty++ : cart.push({ productId: d.add, qty: 1 });
    saveCart(); renderShop();
  }
  if (d.remove !== undefined && e.target.tagName === 'A') {
    e.preventDefault();
    cart = cart.filter(i => i.productId !== d.remove);
    saveCart(); renderShop();
  }
  if (d.delete) {
    Store.commit('products', d.delete, { _deleted: true });
    render();
  }
  if (d.deliver) {
    Store.commit('orders', d.deliver, { status: 'Delivered' });
    render();
  }
});

document.addEventListener('submit', e => {
  const requestId = e.target.dataset.quote;
  if (!requestId) return;
  e.preventDefault();
  const f = new FormData(e.target);
  const id = Store.uid();
  Store.commit('quotes', id, {
    id, requestId, status: 'Pending',
    contractorId: ME.contractor.id, contractorName: ME.contractor.name,
    price: +f.get('price'), days: +f.get('days'), note: f.get('note'),
  });
  toast('Quote sent'); renderOpenRequests();
});

/* ---------- Auth (login / register) ---------- */
function enterApp(user) {
  ME[user.role] = { id: user.id, name: user.name };   // use the real account
  $('userName').textContent = user.name;
  $('userRole').textContent = user.role;
  $('userBox').hidden = false;
  setRole(user.role);
}

function showAuth() {
  $('userBox').hidden = true;
  $('tabs').innerHTML = '';
  showTab('auth');
}

function setAuthMsg(text, isError) {
  const el = $('authMsg');
  el.textContent = text;
  el.classList.toggle('error', !!isError);
}

function authMode(mode) {
  const login = mode === 'login';
  $('loginForm').hidden = !login;
  $('registerForm').hidden = login;
  $('showLogin').classList.toggle('active', login);
  $('showRegister').classList.toggle('active', !login);
  setAuthMsg('');
}

$('showLogin').addEventListener('click', () => authMode('login'));
$('showRegister').addEventListener('click', () => authMode('register'));

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  setAuthMsg('Checking…');
  try {
    const user = await Auth.login(f.get('email'), f.get('password'));
    e.target.reset(); setAuthMsg(''); enterApp(user);
  } catch (err) { setAuthMsg(err.message, true); }
});

$('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  setAuthMsg('Creating account…');
  try {
    const user = await Auth.register(Object.fromEntries(f));
    e.target.reset(); setAuthMsg(''); toast('Welcome, ' + user.name); enterApp(user);
  } catch (err) { setAuthMsg(err.message, true); }
});

$('logoutBtn').addEventListener('click', () => { Auth.logout(); showAuth(); });

const bothLive = Auth.isLive() && Store.isLive();
$('modeBanner').textContent = bothLive
  ? 'Connected to Google Forms backend'
  : Auth.isLive()
    ? 'Accounts: Google Forms. App data: demo mode (this browser only).'
    : 'Demo mode: data is saved in this browser only. See SETUP.md to connect Google Forms.';
$('modeBanner').classList.toggle('live', bothLive);

/* ---------- Start ---------- */
const session = Auth.currentUser();
session ? enterApp(session) : showAuth();
