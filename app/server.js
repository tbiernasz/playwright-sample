/**
 * Zero-dependency mock app for Playwright testing.
 * Serves a small shop: login -> dashboard -> cart -> checkout -> confirmation.
 *
 * Valid credentials: test@example.com / password123
 */
const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Catalog and in-memory state
// ---------------------------------------------------------------------------
const PRODUCTS = [
  {
    id: 'mug',
    name: 'Coffee Mug',
    price: 10,
    description: 'A heavyweight ceramic mug for long debugging sessions.',
    tag: 'Bestseller',
    emoji: '☕',
  },
  {
    id: 'tee',
    name: 'Logo T-Shirt',
    price: 20,
    description: 'Soft cotton tee with the sample-shop logo. One size fits most.',
    tag: 'New',
    emoji: '👕',
  },
];

const USERS = { 'test@example.com': 'password123' };
const sessions = new Set(); // valid session ids
const carts = new Map(); // sessionId -> Map<productId, quantity>
let nextOrderNumber = 1001;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function money(value) {
  return `$${value.toFixed(2)}`;
}

function findProduct(id) {
  return PRODUCTS.find((product) => product.id === id) || null;
}

function cartFor(sid) {
  if (!carts.has(sid)) {
    carts.set(sid, new Map());
  }
  return carts.get(sid);
}

function cartItems(sid) {
  const cart = carts.get(sid);
  if (!cart) return [];
  return [...cart.entries()]
    .map(([id, quantity]) => {
      const product = findProduct(id);
      return product ? { ...product, quantity } : null;
    })
    .filter(Boolean);
}

function cartCount(sid) {
  const cart = carts.get(sid);
  if (!cart) return 0;
  let count = 0;
  for (const quantity of cart.values()) {
    count += quantity;
  }
  return count;
}

function cartSubtotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

const STYLES = `
  :root {
    color-scheme: dark;
    --bg: #0b0f17;
    --surface: #121826;
    --surface-2: #1a2233;
    --border: #263044;
    --text: #e6edf7;
    --muted: #93a4bd;
    --accent: #7aa2ff;
    --accent-strong: #4f7cff;
    --accent-2: #b388ff;
    --success: #3fb950;
    --danger: #ff7b72;
    --radius: 14px;
    --shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
  }
  * { box-sizing: border-box; }
  html { min-height: 100%; }
  body {
    margin: 0;
    min-height: 100vh;
    color: var(--text);
    background:
      radial-gradient(circle at 10% -10%, rgba(122, 162, 255, 0.18), transparent 40%),
      radial-gradient(circle at 90% 0%, rgba(179, 136, 255, 0.12), transparent 35%),
      var(--bg);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    line-height: 1.6;
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { color: #a8c2ff; text-decoration: underline; }
  .site-header, main, .site-footer {
    width: min(960px, 100% - 2.5rem);
    margin-inline: auto;
  }
  .site-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.5rem 0 1rem;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    color: var(--text);
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .brand:hover { color: var(--text); text-decoration: none; }
  .brand-mark {
    display: grid;
    place-items: center;
    width: 2.1rem;
    height: 2.1rem;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    color: #0b0f17;
    font-weight: 900;
  }
  nav { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; position: relative; }
  nav a {
    padding: 0.45rem 0.75rem;
    border-radius: 999px;
    color: var(--muted);
    font-size: 0.95rem;
  }
  nav a:hover, nav a[aria-current="page"] {
    background: var(--surface-2);
    color: var(--text);
    text-decoration: none;
  }
  .nav-links { display: flex; align-items: center; flex-wrap: wrap; gap: 0.35rem; }
  .nav-toggle {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
  .nav-toggle-label { display: none; }
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.35rem;
    height: 1.35rem;
    padding: 0 0.35rem;
    border-radius: 999px;
    background: var(--accent);
    color: #0b0f17;
    font-size: 0.75rem;
    font-weight: 800;
    vertical-align: middle;
  }
  .badge-soft { background: rgba(122, 162, 255, 0.14); color: var(--accent); }
  main { padding: 1rem 0 3rem; }
  h1, h2, h3 { line-height: 1.2; letter-spacing: -0.02em; margin: 0 0 0.5rem; }
  h1 { font-size: clamp(2rem, 5vw, 3rem); }
  h2 { font-size: 1.35rem; }
  h3 { font-size: 1.1rem; }
  p { margin: 0 0 1rem; }
  .muted { color: var(--muted); }
  .eyebrow {
    color: var(--accent);
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 0.35rem;
  }
  .hero { padding: 2rem 0 1.5rem; max-width: 42rem; }
  .section-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin: 1.5rem 0 0.75rem;
  }
  .product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
  }
  .product-card {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 40%), var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    transition: transform 0.18s ease, border-color 0.18s ease;
  }
  .product-card:hover { transform: translateY(-3px); border-color: #3b4b6b; }
  .product-art {
    display: grid;
    place-items: center;
    height: 8rem;
    font-size: 3.2rem;
    background: radial-gradient(circle at 30% 20%, rgba(122, 162, 255, 0.28), transparent 55%), var(--surface-2);
    border-bottom: 1px solid var(--border);
  }
  .product-body {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 1.15rem;
    flex: 1;
  }
  .product-body p { margin: 0; }
  .product-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: auto;
    padding-top: 0.5rem;
  }
  .product-actions { display: flex; align-items: center; gap: 0.4rem; }
  .price { font-size: 1.25rem; font-weight: 800; }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 0.55rem 0.9rem;
    font: inherit;
    font-weight: 700;
    font-size: 0.92rem;
    cursor: pointer;
    transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
  }
  .btn:hover { transform: translateY(-1px); text-decoration: none; }
  .btn-primary {
    background: linear-gradient(135deg, var(--accent), var(--accent-strong));
    color: #071021;
  }
  .btn-primary:hover { color: #071021; filter: brightness(1.08); }
  .btn-ghost { background: transparent; border-color: var(--border); color: var(--text); }
  .btn-ghost:hover { background: var(--surface-2); }
  .btn-small { padding: 0.35rem 0.6rem; font-size: 0.82rem; }
  .btn-block { width: 100%; }
  .btn-icon {
    width: 2rem;
    height: 2rem;
    padding: 0;
    background: var(--surface-2);
    border-color: var(--border);
    color: var(--text);
  }
  .btn-danger {
    background: rgba(255, 123, 114, 0.14);
    border-color: rgba(255, 123, 114, 0.45);
    color: var(--danger);
  }
  .btn-danger:hover { background: rgba(255, 123, 114, 0.24); color: var(--danger); }
  .modal {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(4, 8, 16, 0.66);
    backdrop-filter: blur(3px);
  }
  .modal:target { display: flex; }
  .modal-panel {
    width: min(26rem, 100%);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 1.4rem;
  }
  .modal-head { display: flex; align-items: center; gap: 0.6rem; }
  .modal-head h2 { flex: 1; margin: 0; font-size: 1.2rem; }
  .modal-close {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: 8px;
    color: var(--muted);
    font-size: 0.95rem;
  }
  .modal-close:hover { background: var(--surface-2); color: var(--text); text-decoration: none; }
  .modal-art {
    display: grid;
    place-items: center;
    height: 5.5rem;
    margin: 1rem 0;
    border-radius: 12px;
    border: 1px solid var(--border);
    font-size: 2.6rem;
    background: radial-gradient(circle at 30% 20%, rgba(122, 162, 255, 0.22), transparent 55%), var(--surface-2);
  }
  .modal-foot { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
  .modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin-top: 1.1rem;
  }
  .modal-actions form { margin: 0; }
  .flash {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 1rem 0;
    padding: 0.75rem 1rem;
    border: 1px solid rgba(63, 185, 80, 0.35);
    border-radius: 10px;
    background: rgba(63, 185, 80, 0.1);
    color: #b7f0c0;
  }
  .auth-card, .summary-card, .info-card, .empty-state, .success-card, .error-card {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 45%), var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 1.5rem;
  }
  .auth-card { max-width: 26rem; margin: 2rem auto; }
  .stack { display: grid; gap: 0.45rem; }
  label { font-size: 0.9rem; font-weight: 700; color: var(--text); }
  input {
    width: 100%;
    padding: 0.65rem 0.75rem;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text);
    font: inherit;
  }
  input:focus {
    outline: 2px solid rgba(122, 162, 255, 0.5);
    outline-offset: 1px;
    border-color: var(--accent);
  }
  .alert {
    padding: 0.75rem 1rem;
    border-radius: 10px;
    background: rgba(255, 123, 114, 0.1);
    border: 1px solid rgba(255, 123, 114, 0.35);
    color: #ffb4ae;
    margin-bottom: 1rem;
  }
  .hint { margin-top: 1rem; font-size: 0.85rem; color: var(--muted); }
  code {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.1rem 0.35rem;
    font-size: 0.85em;
  }
  .cart-layout, .checkout-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(16rem, 0.9fr);
    gap: 1rem;
    align-items: start;
  }
  .cart-list, .checkout-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.75rem; }
  .cart-item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 1rem;
    align-items: center;
    padding: 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
  }
  .cart-art {
    display: grid;
    place-items: center;
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 12px;
    background: var(--surface-2);
    font-size: 1.6rem;
  }
  .cart-info h3 { margin-bottom: 0.15rem; }
  .cart-info p { margin-bottom: 0.5rem; }
  .qty-controls { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
  .inline-form { display: inline; margin: 0; }
  .qty { min-width: 1.5rem; text-align: center; font-weight: 800; }
  .cart-line-total { text-align: right; display: grid; gap: 0.15rem; }
  .cart-line-total strong { font-size: 1.1rem; }
  .summary-card h2 { margin-bottom: 1rem; }
  .summary-row { display: flex; justify-content: space-between; gap: 1rem; padding: 0.45rem 0; color: var(--muted); }
  .summary-row strong { color: var(--text); }
  .summary-row.total {
    border-top: 1px solid var(--border);
    margin-top: 0.5rem;
    padding-top: 0.8rem;
    color: var(--text);
    font-size: 1.1rem;
  }
  .summary-card form { margin: 0.75rem 0 0; }
  .summary-card .btn-ghost { margin-top: 0.5rem; }
  .summary-card > a { display: inline-block; margin-top: 0.9rem; font-size: 0.9rem; }
  .checkout-list li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.55rem 0;
    border-bottom: 1px solid var(--border);
    color: var(--muted);
  }
  .checkout-list li strong { color: var(--text); }
  .empty-state { text-align: center; padding: 3rem 1.5rem; }
  .empty-icon { font-size: 3rem; margin-bottom: 0.5rem; }
  .success-card { max-width: 34rem; margin: 2rem auto; text-align: center; padding: 2.5rem 1.5rem; }
  .success-icon {
    display: grid;
    place-items: center;
    width: 4rem;
    height: 4rem;
    margin: 0 auto 1rem;
    border-radius: 50%;
    background: rgba(63, 185, 80, 0.14);
    color: var(--success);
    font-size: 2rem;
    font-weight: 900;
  }
  .error-card { max-width: 30rem; margin: 3rem auto; text-align: center; }
  .error-code {
    font-size: 4rem;
    font-weight: 900;
    line-height: 1;
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    margin-bottom: 0.5rem;
  }
  .site-footer { padding: 1.5rem 0 2rem; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.85rem; }
  @media (max-width: 720px) {
    .cart-layout, .checkout-layout { grid-template-columns: 1fr; }
    .site-header { align-items: flex-start; flex-direction: column; }
    .cart-item { grid-template-columns: auto 1fr; }
    .cart-line-total { grid-column: 2; text-align: left; }
    nav { width: 100%; justify-content: flex-end; }
    .nav-toggle-label {
      display: inline-grid;
      place-items: center;
      width: 2.4rem;
      height: 2.4rem;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface-2);
      cursor: pointer;
    }
    .nav-toggle-icon,
    .nav-toggle-icon::before,
    .nav-toggle-icon::after {
      transition: transform 0.18s ease, top 0.18s ease, background-color 0.18s ease;
    }
    .nav-toggle-icon {
      position: relative;
      width: 1.05rem;
      height: 2px;
      border-radius: 1px;
      background: var(--text);
    }
    .nav-toggle-icon::before,
    .nav-toggle-icon::after {
      content: "";
      position: absolute;
      left: 0;
      width: 100%;
      height: 2px;
      border-radius: 1px;
      background: var(--text);
    }
    .nav-toggle-icon::before { top: -6px; }
    .nav-toggle-icon::after { top: 6px; }
    .nav-toggle:checked + .nav-toggle-label .nav-toggle-icon { background: transparent; }
    .nav-toggle:checked + .nav-toggle-label .nav-toggle-icon::before {
      top: 0;
      transform: rotate(45deg);
    }
    .nav-toggle:checked + .nav-toggle-label .nav-toggle-icon::after {
      top: 0;
      transform: rotate(-45deg);
    }
    .nav-toggle:focus-visible ~ .nav-toggle-label {
      outline: 2px solid rgba(122, 162, 255, 0.5);
      outline-offset: 1px;
    }
    .nav-links {
      position: absolute;
      top: calc(100% + 0.4rem);
      right: 0;
      z-index: 30;
      display: none;
      flex-direction: column;
      align-items: stretch;
      gap: 0.2rem;
      min-width: 12rem;
      padding: 0.5rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }
    .nav-toggle:checked ~ .nav-links { display: flex; }
    .nav-links a { padding: 0.55rem 0.75rem; border-radius: 10px; }
  }
  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; }
  }
`;

function htmlPage(title, body, { sid = null, active = '' } = {}) {
  const count = sid ? cartCount(sid) : 0;
  const nav = sid
    ? `<nav aria-label="Main navigation">
      <input type="checkbox" id="nav-toggle" class="nav-toggle" aria-label="Toggle menu">
      <label for="nav-toggle" class="nav-toggle-label" data-testid="nav-toggle">
        <span class="nav-toggle-icon" aria-hidden="true"></span>
      </label>
      <div class="nav-links" data-testid="nav-links">
        <a href="/" data-testid="home-link"${active === 'home' ? ' aria-current="page"' : ''}>Shop</a>
        <a href="/cart" data-testid="cart-link"${active === 'cart' ? ' aria-current="page"' : ''}>Cart <span class="badge" data-testid="cart-count">${count}</span></a>
        <a href="/logout" data-testid="logout-link">Log out</a>
      </div>
    </nav>`
    : `<nav aria-label="Main navigation"><span class="muted">Demo store</span></nav>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Sample Shop</title>
<style>${STYLES}</style>
</head>
<body>
<header class="site-header">
  <a class="brand" href="/" aria-label="Sample Shop home">
    <span class="brand-mark" aria-hidden="true">P</span>
    <span>Sample Shop</span>
  </a>
  ${nav}
</header>
<main>
${body}
</main>
<footer class="site-footer">Built for Playwright testing · Zero dependencies</footer>
</body>
</html>`;
}

function getCookie(req, name) {
  const entry = (req.headers.cookie || '').split('; ').find((row) => row.startsWith(name + '='));
  return entry ? entry.slice(name.length + 1) : null;
}

function sessionId(req) {
  const sid = getCookie(req, 'sid');
  return sid && sessions.has(sid) ? sid : null;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error('payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(new URLSearchParams(data)));
    req.on('error', reject);
  });
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  res.end(body);
}

function redirect(res, location, headers = {}) {
  send(res, 302, '', { Location: location, ...headers });
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------
function loginPage(error = null) {
  return htmlPage(
    'Sign in',
    `<section class="auth-card">
  <p class="eyebrow">Welcome back</p>
  <h1>Sign in</h1>
  <p class="muted">Sign in to browse the sample store and test the checkout flow.</p>
  ${error ? `<div class="alert" role="alert" data-testid="login-error">${error}</div>` : ''}
  <form class="stack" method="post" action="/login">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="username" required data-testid="email-input">
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required data-testid="password-input">
    <button class="btn btn-primary btn-block" type="submit" data-testid="sign-in">Sign in</button>
  </form>
  <p class="hint">Demo credentials: <code>test@example.com</code> / <code>password123</code></p>
</section>`
  );
}

function dashboardPage(sid, addedId = null) {
  const added = findProduct(addedId);
  const flash = added
    ? `<div class="flash" role="status" data-testid="flash">✓ ${added.name} added to your cart.</div>`
    : '';
  const count = cartCount(sid);
  const itemLabel = count === 1 ? '1 item' : `${count} items`;

  return htmlPage(
    'Dashboard',
    `<section class="hero">
  <p class="eyebrow">Dashboard</p>
  <h1>Dashboard</h1>
  <p class="muted">Two everyday essentials, ready for your test run. Add something to the cart and head to checkout.</p>
</section>
${flash}
<section aria-labelledby="products-heading">
  <div class="section-heading">
    <h2 id="products-heading">Products</h2>
    <span class="muted">${itemLabel} in cart</span>
  </div>
  <div class="product-grid">
    ${PRODUCTS.map(
      (product) => `
      <article class="product-card" data-testid="product-item">
        <div class="product-art" aria-hidden="true">${product.emoji}</div>
        <div class="product-body">
          <span class="badge badge-soft">${product.tag}</span>
          <h3>${product.name}</h3>
          <p class="muted">${product.description}</p>
          <div class="product-footer">
            <span class="price" data-testid="product-price">${money(product.price)}</span>
            <div class="product-actions">
              <a class="btn btn-ghost btn-small" href="#product-${product.id}" data-testid="product-details">Details</a>
              <form method="post" action="/cart/add">
                <input type="hidden" name="productId" value="${product.id}">
                <button class="btn btn-primary btn-small" type="submit" data-testid="add-to-cart">Add to cart</button>
              </form>
            </div>
          </div>
        </div>
      </article>`
    ).join('')}
  </div>
</section>
${PRODUCTS.map(
  (product) => `
  <div class="modal" id="product-${product.id}" data-testid="product-modal-${product.id}">
    <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="product-${product.id}-title">
      <div class="modal-head">
        <span class="badge badge-soft">${product.tag}</span>
        <h2 id="product-${product.id}-title">${product.name}</h2>
        <a class="modal-close" href="#" data-testid="modal-close" aria-label="Close product details">✕</a>
      </div>
      <div class="modal-art" aria-hidden="true">${product.emoji}</div>
      <p class="muted">${product.description}</p>
      <div class="modal-foot">
        <span class="price" data-testid="product-price">${money(product.price)}</span>
        <form method="post" action="/cart/add">
          <input type="hidden" name="productId" value="${product.id}">
          <button class="btn btn-primary" type="submit" data-testid="modal-add-to-cart">Add to cart</button>
        </form>
      </div>
    </div>
  </div>`
).join('')}`,
    { sid, active: 'home' }
  );
}

function emptyCartState({
  icon = '🛒',
  title = 'Nothing here yet',
  message = 'Your cart is empty.',
  href = '/',
  linkText = 'Browse products',
} = {}) {
  return `<section class="empty-state">
  <div class="empty-icon" aria-hidden="true">${icon}</div>
  <h2>${title}</h2>
  <p data-testid="cart-empty">${message}</p>
  <a class="btn btn-primary" href="${href}" data-testid="back-link">${linkText}</a>
</section>`;
}

function cartPage(sid) {
  const items = cartItems(sid);
  const count = cartCount(sid);
  const total = cartSubtotal(items);
  const itemLabel = count === 1 ? '1 item' : `${count} items`;

  const body =
    items.length === 0
      ? emptyCartState()
      : `<div class="cart-layout">
  <ul class="cart-list">
    ${items
      .map(
        (item) => `
      <li class="cart-item" data-testid="cart-item">
        <div class="cart-art" aria-hidden="true">${item.emoji}</div>
        <div class="cart-info">
          <h3>${item.name}</h3>
          <p class="muted">${money(item.price)} each</p>
          <div class="qty-controls">
            <form class="inline-form" method="post" action="/cart/update">
              <input type="hidden" name="productId" value="${item.id}">
              <input type="hidden" name="action" value="decrease">
              <button class="btn btn-icon" type="submit" aria-label="Decrease quantity of ${item.name}" data-testid="decrease-quantity">−</button>
            </form>
            <span class="qty" data-testid="item-quantity" aria-label="Quantity">${item.quantity}</span>
            <form class="inline-form" method="post" action="/cart/update">
              <input type="hidden" name="productId" value="${item.id}">
              <input type="hidden" name="action" value="increase">
              <button class="btn btn-icon" type="submit" aria-label="Increase quantity of ${item.name}" data-testid="increase-quantity">+</button>
            </form>
            <form class="inline-form" method="post" action="/cart/remove">
              <input type="hidden" name="productId" value="${item.id}">
              <button class="btn btn-ghost btn-small" type="submit" data-testid="remove-item">Remove</button>
            </form>
          </div>
        </div>
        <div class="cart-line-total">
          <span class="muted">Line total</span>
          <strong data-testid="line-total">${money(item.price * item.quantity)}</strong>
        </div>
      </li>`
      )
      .join('')}
  </ul>
  <aside class="summary-card">
    <h2>Order summary</h2>
    <div class="summary-row"><span>Subtotal</span><strong data-testid="cart-subtotal">${money(total)}</strong></div>
    <div class="summary-row"><span>Shipping</span><span>Free</span></div>
    <div class="summary-row total"><span>Total</span><strong data-testid="cart-total">${money(total)}</strong></div>
    <form method="post" action="/checkout/goto">
      <button class="btn btn-primary btn-block" type="submit" data-testid="proceed-to-checkout">Proceed to checkout</button>
    </form>
    <a class="btn btn-ghost btn-block" href="#confirm-clear" data-testid="clear-cart">Clear cart</a>
    <a href="/" data-testid="back-link">Continue shopping</a>
  </aside>
</div>
<div class="modal" id="confirm-clear" data-testid="clear-cart-modal">
  <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="confirm-clear-title">
    <div class="modal-head">
      <h2 id="confirm-clear-title">Clear your cart?</h2>
      <a class="modal-close" href="#" data-testid="modal-close" aria-label="Close dialog">✕</a>
    </div>
    <p class="muted">This removes all ${itemLabel} from your cart. This cannot be undone.</p>
    <div class="modal-actions">
      <a class="btn btn-ghost" href="#" data-testid="cancel-clear">Cancel</a>
      <form method="post" action="/cart/clear">
        <button class="btn btn-danger" type="submit" data-testid="confirm-clear">Clear cart</button>
      </form>
    </div>
  </div>
</div>`;

  return htmlPage(
    'Cart',
    `<div class="page-heading">
  <p class="eyebrow">Your selection</p>
  <h1>Cart</h1>
  ${items.length ? `<p class="muted">${itemLabel} ready for checkout.</p>` : ''}
</div>
${body}`,
    { sid, active: 'cart' }
  );
}

function checkoutPage(sid) {
  const items = cartItems(sid);
  const total = cartSubtotal(items);
  const count = cartCount(sid);
  const itemLabel = count === 1 ? '1 item' : `${count} items`;

  const body =
    items.length === 0
      ? emptyCartState({
          icon: '🧾',
          title: 'Nothing to check out',
          href: '/cart',
          linkText: 'Back to cart',
        })
      : `<div class="checkout-layout">
  <section class="summary-card">
    <h2>Order summary</h2>
    <ul class="checkout-list">
      ${items
        .map(
          (item) =>
            `<li data-testid="checkout-item"><span>${item.name} × ${item.quantity}</span><strong>${money(item.price * item.quantity)}</strong></li>`
        )
        .join('')}
    </ul>
    <div class="summary-row total"><span>Total</span><strong data-testid="checkout-total">Total: ${money(total)}</strong></div>
    <a class="btn btn-primary btn-block" href="#confirm-order" data-testid="place-order">Place order</a>
    <a href="/cart" data-testid="back-link">Back to cart</a>
  </section>
  <aside class="info-card">
    <p class="eyebrow">Demo checkout</p>
    <h2>No payment required</h2>
    <p class="muted">This is a sample store. Placing an order clears the in-memory cart and shows a confirmation.</p>
  </aside>
</div>
<div class="modal" id="confirm-order" data-testid="confirm-order-modal">
  <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="confirm-order-title">
    <div class="modal-head">
      <h2 id="confirm-order-title">Confirm your order</h2>
      <a class="modal-close" href="#" data-testid="modal-close" aria-label="Close dialog">✕</a>
    </div>
    <p class="muted">You are ordering ${itemLabel} for a total of <strong data-testid="confirm-order-total">${money(total)}</strong>.</p>
    <div class="modal-actions">
      <a class="btn btn-ghost" href="#" data-testid="cancel-order">Cancel</a>
      <form method="post" action="/checkout">
        <button class="btn btn-primary" type="submit" data-testid="confirm-order">Place order</button>
      </form>
    </div>
  </div>
</div>`;

  return htmlPage(
    'Checkout',
    `<div class="page-heading">
  <p class="eyebrow">Almost there</p>
  <h1>Checkout</h1>
</div>
${body}`,
    { sid, active: 'cart' }
  );
}

function confirmationPage(orderId, sid) {
  return htmlPage(
    'Order confirmed',
    `<section class="success-card">
  <div class="success-icon" aria-hidden="true">✓</div>
  <p class="eyebrow">Order #${orderId}</p>
  <h1>Order confirmed</h1>
  <p data-testid="order-confirmation">Thank you for your purchase!</p>
  <p class="muted">Your order <strong data-testid="order-number">#${orderId}</strong> is on its way — well, in this demo it is.</p>
  <a class="btn btn-primary" href="/" data-testid="back-link">Back to dashboard</a>
</section>`,
    { sid, active: 'home' }
  );
}

function notFoundPage(sid) {
  return htmlPage(
    'Not found',
    `<section class="error-card">
  <div class="error-code" aria-hidden="true">404</div>
  <h1>404 Not found</h1>
  <p class="muted">The page you are looking for does not exist.</p>
  <a class="btn btn-primary" href="/" data-testid="back-link">Back to shop</a>
</section>`,
    { sid }
  );
}

function methodNotAllowedPage(sid) {
  return htmlPage(
    'Method not allowed',
    `<section class="error-card">
  <div class="error-code" aria-hidden="true">405</div>
  <h1>405 Method not allowed</h1>
  <p class="muted">This route does not support that HTTP method.</p>
  <a class="btn btn-primary" href="/" data-testid="back-link">Back to shop</a>
</section>`,
    { sid }
  );
}

function serverErrorPage(sid) {
  return htmlPage(
    'Server error',
    `<section class="error-card">
  <div class="error-code" aria-hidden="true">500</div>
  <h1>500 Server error</h1>
  <p class="muted">Something went wrong on the demo server.</p>
  <a class="btn btn-primary" href="/" data-testid="back-link">Back to shop</a>
</section>`,
    { sid }
  );
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const sid = sessionId(req);

  try {
    if (req.method === 'GET') {
      switch (path) {
        case '/':
          if (!sid) return redirect(res, '/login');
          return send(res, 200, dashboardPage(sid, url.searchParams.get('added')));
        case '/login':
          if (sid) return redirect(res, '/');
          return send(res, 200, loginPage());
        case '/cart':
          if (!sid) return redirect(res, '/login');
          return send(res, 200, cartPage(sid));
        case '/checkout':
          if (!sid) return redirect(res, '/login');
          return send(res, 200, checkoutPage(sid));
        case '/logout':
          if (sid) sessions.delete(sid);
          return redirect(res, '/login', {
            'Set-Cookie': 'sid=deleted; Path=/; HttpOnly; Max-Age=0',
          });
        case '/api/products':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify(
              PRODUCTS.map(({ id, name, price, description, tag }) => ({
                id,
                name,
                price,
                description,
                tag,
              }))
            )
          );
        case '/api/cart': {
          if (!sid) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Unauthorized' }));
          }
          const items = cartItems(sid).map(({ id, name, price, quantity }) => ({
            id,
            name,
            price,
            quantity,
          }));
          const count = items.reduce((sum, item) => sum + item.quantity, 0);
          const subtotal = cartSubtotal(items);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ items, count, subtotal }));
        }
        default:
          return send(res, 404, notFoundPage(sid));
      }
    }

    if (req.method === 'POST') {
      switch (path) {
        case '/login': {
          const body = await parseBody(req);
          const email = body.get('email') || '';
          const password = body.get('password') || '';
          if (USERS[email] === password) {
            const newSid = crypto.randomBytes(16).toString('hex');
            sessions.add(newSid);
            return redirect(res, '/', {
              'Set-Cookie': `sid=${newSid}; Path=/; HttpOnly`,
            });
          }
          return send(res, 401, loginPage('Invalid email or password.'), {
            'Set-Cookie': 'sid=deleted; Path=/; HttpOnly; Max-Age=0',
          });
        }
        case '/cart/add': {
          if (!sid) return redirect(res, '/login');
          const body = await parseBody(req);
          const product = findProduct(body.get('productId'));
          if (product) {
            const cart = cartFor(sid);
            cart.set(product.id, (cart.get(product.id) || 0) + 1);
            return redirect(res, `/?added=${product.id}`);
          }
          return redirect(res, '/');
        }
        case '/cart/update': {
          if (!sid) return redirect(res, '/login');
          const body = await parseBody(req);
          const product = findProduct(body.get('productId'));
          if (product) {
            const cart = cartFor(sid);
            const delta = body.get('action') === 'increase' ? 1 : body.get('action') === 'decrease' ? -1 : 0;
            const next = (cart.get(product.id) || 0) + delta;
            if (next > 0) cart.set(product.id, next);
            else cart.delete(product.id);
          }
          return redirect(res, '/cart');
        }
        case '/cart/remove': {
          if (!sid) return redirect(res, '/login');
          const body = await parseBody(req);
          const product = findProduct(body.get('productId'));
          if (product) cartFor(sid).delete(product.id);
          return redirect(res, '/cart');
        }
        case '/cart/clear':
          if (!sid) return redirect(res, '/login');
          carts.set(sid, new Map());
          return redirect(res, '/cart');
        case '/checkout/goto':
          if (!sid) return redirect(res, '/login');
          return redirect(res, '/checkout');
        case '/checkout': {
          if (!sid) return redirect(res, '/login');
          const items = cartItems(sid);
          if (items.length === 0) return redirect(res, '/cart');
          const orderId = nextOrderNumber++;
          carts.set(sid, new Map());
          return send(res, 200, confirmationPage(orderId, sid));
        }
        default:
          return send(res, 404, notFoundPage(sid));
      }
    }

    return send(res, 405, methodNotAllowedPage(sid));
  } catch (err) {
    console.error(err);
    return send(res, 500, serverErrorPage(sid));
  }
});

server.listen(PORT, () => {
  console.log(`Mock app listening on http://localhost:${PORT}`);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
function shutdown() {
  console.log('Shutting down…');
  server.close(() => process.exit(0));
  // Force exit after 3 seconds if connections hang
  setTimeout(() => process.exit(1), 3000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
