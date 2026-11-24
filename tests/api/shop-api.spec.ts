import { test, expect, type APIRequestContext } from '@playwright/test';

const CREDENTIALS = { email: 'test@example.com', password: 'password123' };

/** Logs in through the API and leaves the session cookie in the request context. */
async function login(request: APIRequestContext) {
  const response = await request.post('/login', { form: CREDENTIALS, maxRedirects: 0 });
  expect(response.status(), 'valid credentials should start a session').toBe(302);
  return response;
}

/** Adds one unit of a product through the form endpoint. */
async function addProduct(request: APIRequestContext, productId = 'mug') {
  const response = await request.post('/cart/add', { form: { productId }, maxRedirects: 0 });
  expect(response.status(), `adding ${productId} should redirect`).toBe(302);
  return response;
}

test.describe('API', () => {
  test('GET /api/products returns the product catalog as JSON', async ({ request }) => {
    const response = await request.get('/api/products');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const products = await response.json();
    expect(products).toEqual([
      {
        id: 'mug',
        name: 'Coffee Mug',
        price: 10,
        description: 'A heavyweight ceramic mug for long debugging sessions.',
        tag: 'Bestseller',
      },
      {
        id: 'tee',
        name: 'Logo T-Shirt',
        price: 20,
        description: 'Soft cotton tee with the sample-shop logo. One size fits most.',
        tag: 'New',
      },
    ]);
  });

  test('POST /login with valid credentials starts a session', async ({ request }) => {
    const response = await login(request);
    expect(response.headers()['location']).toBe('/');
    expect(response.headers()['set-cookie']).toContain('sid=');
  });

  test('POST /login with invalid credentials is rejected', async ({ request }) => {
    const response = await request.post('/login', {
      form: { ...CREDENTIALS, password: 'wrong-password' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(401);
    expect(await response.text()).toContain('Invalid email or password.');
    expect(response.headers()['set-cookie']).toContain('sid=deleted');
  });

  test('protected form endpoints redirect anonymous requests to the login page', async ({ request }) => {
    for (const path of ['/cart/add', '/cart/update', '/cart/remove', '/cart/clear', '/checkout/goto', '/checkout']) {
      const response = await request.post(path, {
        form: { productId: 'mug', action: 'increase' },
        maxRedirects: 0,
      });
      expect(response.status(), `${path} should redirect`).toBe(302);
      expect(response.headers()['location'], `${path} should redirect to /login`).toBe('/login');
    }
  });

  test('GET /api/cart requires an authenticated session', async ({ request }) => {
    const response = await request.get('/api/cart');
    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  test('adding the same product twice increments its quantity and subtotal', async ({ request }) => {
    await login(request);
    await addProduct(request);
    await addProduct(request);

    const response = await request.get('/api/cart');
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      items: [{ id: 'mug', name: 'Coffee Mug', price: 10, quantity: 2 }],
      count: 2,
      subtotal: 20,
    });
  });

  test('cart update and remove endpoints change the session cart', async ({ request }) => {
    await login(request);
    await addProduct(request);

    let response = await request.post('/cart/update', {
      form: { productId: 'mug', action: 'increase' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    let cart = await (await request.get('/api/cart')).json();
    expect(cart.items[0].quantity).toBe(2);

    response = await request.post('/cart/update', {
      form: { productId: 'mug', action: 'decrease' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    cart = await (await request.get('/api/cart')).json();
    expect(cart.items[0].quantity).toBe(1);

    response = await request.post('/cart/update', {
      form: { productId: 'mug', action: 'decrease' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    cart = await (await request.get('/api/cart')).json();
    expect(cart).toEqual({ items: [], count: 0, subtotal: 0 });

    await addProduct(request);
    response = await request.post('/cart/remove', {
      form: { productId: 'mug' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    cart = await (await request.get('/api/cart')).json();
    expect(cart).toEqual({ items: [], count: 0, subtotal: 0 });
  });

  test('POST /cart/clear empties the session cart', async ({ request }) => {
    await login(request);
    await addProduct(request, 'mug');
    await addProduct(request, 'tee');

    const response = await request.post('/cart/clear', { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(await (await request.get('/api/cart')).json()).toEqual({ items: [], count: 0, subtotal: 0 });
  });

  test('POST /checkout with an empty cart redirects back to the cart', async ({ request }) => {
    await login(request);
    const response = await request.post('/checkout', { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toBe('/cart');
  });

  test('cart API flow places an order and empties the cart', async ({ request }) => {
    await login(request);
    await addProduct(request);
    await addProduct(request);

    const checkout = await request.post('/checkout', { maxRedirects: 0 });
    expect(checkout.status()).toBe(200);
    const html = await checkout.text();
    expect(html).toContain('Thank you for your purchase!');
    expect(html).toContain('data-testid="order-number"');

    const cart = await request.get('/api/cart');
    expect(await cart.json()).toEqual({ items: [], count: 0, subtotal: 0 });
  });

  test('POST /cart/add ignores unknown products', async ({ request }) => {
    await login(request);
    const response = await addProduct(request, 'unknown');

    expect(response.headers()['location']).toBe('/');
    expect(await (await request.get('/api/cart')).json()).toEqual({ items: [], count: 0, subtotal: 0 });
  });

  test('logout invalidates the session', async ({ request }) => {
    await login(request);

    const logout = await request.get('/logout', { maxRedirects: 0 });
    expect(logout.status()).toBe(302);
    expect(logout.headers()['location']).toBe('/login');
    expect(logout.headers()['set-cookie']).toContain('sid=deleted');

    const cart = await request.get('/api/cart');
    expect(cart.status()).toBe(401);
  });

  test('unsupported HTTP methods return 405', async ({ request }) => {
    const response = await request.put('/api/products');
    expect(response.status()).toBe(405);
  });
});
