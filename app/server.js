/**
 * Zero-dependency mock app for Playwright testing.
 * Serves a small shop: login -> dashboard -> cart -> checkout -> confirmation.
 *
 * Valid credentials: test@example.com / password123
 */
const http = require('http');

const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------
const USERS = { 'test@example.com': 'password123' };
const sessions = new Set(); // valid session ids
const carts = new Map(); // sessionId -> [{ id, name, price }]

const PRODUCTS = [
  { id: 'mug', name: 'Coffee Mug', price: 10 },
  { id: 'tee', name: 'Logo T-Shirt', price: 20 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function htmlPage(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 2rem auto;
    max-width: 40rem;
    padding: 0 1rem;
    background: #121212;
    color: #e6e6e6;
    font-family: system-ui, sans-serif;
    line-height: 1.5;
  }
  a { color: #8ab4f8; }
  nav { display: flex; gap: 1rem; margin-bottom: 1rem; }
  button, input {
    background: #1e1e1e;
    color: inherit;
    border: 1px solid #555;
    border-radius: 4px;
    padding: 0.4rem 0.75rem;
    font: inherit;
  }
  button { cursor: pointer; }
  button:hover { background: #2c2c2c; }
  li { margin: 0.25rem 0; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function getCookie(req, name) {
  const entry = (req.headers.cookie || '')
    .split('; ')
    .find((row) => row.startsWith(name + '='));
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
    `<h1>Sign in</h1>
${error ? `<p data-testid="login-error">${error}</p>` : ''}
<form method="post" action="/login">
  <label for="email">Email</label>
  <input id="email" name="email" data-testid="email-input">
  <label for="password">Password</label>
  <input id="password" name="password" type="password" data-testid="password-input">
  <button type="submit" data-testid="sign-in">Sign in</button>
</form>`
  );
}

function dashboardPage(sid) {
  const items = PRODUCTS.map(
    (p) => `
  <li data-testid="product-item">
    <span>${p.name}</span> &mdash; $${p.price.toFixed(2)}
    <form method="post" action="/cart/add" style="display:inline">
      <input type="hidden" name="productId" value="${p.id}">
      <button type="submit" data-testid="add-to-cart">Add to cart</button>
    </form>
  </li>`
  ).join('');
  return htmlPage(
    'Dashboard',
    `<h1>Dashboard</h1>
<nav>
  <a href="/cart" data-testid="cart-link">Cart</a>
  <a href="/logout" data-testid="logout-link">Log out</a>
</nav>
<h2>Products</h2>
<ul>${items}
</ul>`
  );
}

function cartPage(sid) {
  const cart = carts.get(sid) || [];
  const body =
    cart.length === 0
      ? `<p data-testid="cart-empty">Your cart is empty.</p><a href="/" data-testid="back-link">Back to products</a>`
      : `<ul>${cart
          .map((item) => `<li data-testid="cart-item">${item.name} &mdash; $${item.price.toFixed(2)}</li>`)
          .join('')}</ul>
<form method="post" action="/checkout/goto">
  <button type="submit" data-testid="proceed-to-checkout">Proceed to checkout</button>
</form>`;
  return htmlPage('Cart', `<h1>Cart</h1>${body}<p><a href="/" data-testid="back-link">Back to products</a></p>`);
}

function checkoutPage(sid) {
  const cart = carts.get(sid) || [];
  if (cart.length === 0) {
    return htmlPage('Checkout', `<h1>Checkout</h1><p data-testid="cart-empty">Your cart is empty.</p>`);
  }
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  return htmlPage(
    'Checkout',
    `<h1>Checkout</h1>
<ul>${cart.map((item) => `<li data-testid="checkout-item">${item.name} &mdash; $${item.price.toFixed(2)}</li>`).join('')}</ul>
<p data-testid="checkout-total">Total: $${total.toFixed(2)}</p>
<form method="post" action="/checkout">
  <button type="submit" data-testid="place-order">Place order</button>
</form>`
  );
}

function confirmationPage() {
  return htmlPage('Order confirmed', `<h1>Order confirmed</h1><p data-testid="order-confirmation">Thank you for your purchase!</p><a href="/" data-testid="back-link">Back to dashboard</a>`);
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
          return send(res, 200, dashboardPage(sid));
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
          return redirect(res, '/login');
        case '/api/products':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(PRODUCTS));
        default:
          return send(res, 404, htmlPage('Not found', '<h1>404 Not found</h1>'));
      }
    }

    if (req.method === 'POST') {
      switch (path) {
        case '/login': {
          const body = await parseBody(req);
          const email = body.get('email') || '';
          const password = body.get('password') || '';
          if (USERS[email] === password) {
            const newSid = require('crypto').randomBytes(16).toString('hex');
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
          const product = PRODUCTS.find((p) => p.id === body.get('productId'));
          if (product) {
            const cart = carts.get(sid) || [];
            cart.push({ ...product });
            carts.set(sid, cart);
          }
          return redirect(res, '/');
        }
        case '/cart/clear': {
          if (!sid) return redirect(res, '/login');
          carts.set(sid, []);
          return redirect(res, '/cart');
        }
        case '/checkout/goto':
          if (!sid) return redirect(res, '/login');
          return redirect(res, '/checkout');
        case '/checkout': {
          if (!sid) return redirect(res, '/login');
          const cart = carts.get(sid) || [];
          if (cart.length === 0) return redirect(res, '/cart');
          carts.set(sid, []);
          return send(res, 200, confirmationPage());
        }
        default:
          return send(res, 404, htmlPage('Not found', '<h1>404 Not found</h1>'));
      }
    }

    return send(res, 405, htmlPage('Method not allowed', '<h1>405</h1>'));
  } catch (err) {
    console.error(err);
    return send(res, 500, htmlPage('Server error', '<h1>500</h1>'));
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
