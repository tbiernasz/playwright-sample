import { test, expect, type APIRequestContext } from '@playwright/test';

const CREDENTIALS = { email: 'test@example.com', password: 'password123' };

/** Logs in through the API and leaves the session cookie in the request context. */
async function login(request: APIRequestContext) {
  const response = await request.post('/login', { form: CREDENTIALS, maxRedirects: 0 });
  expect(response.status(), 'valid credentials should start a session').toBe(302);
  return response;
}

test.describe('API', () => {
  test('GET /api/products returns the product catalog as JSON', async ({ request }) => {
    const response = await request.get('/api/products');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const products = await response.json();
    expect(products).toEqual([
      { id: 'mug', name: 'Coffee Mug', price: 10 },
      { id: 'tee', name: 'Logo T-Shirt', price: 20 },
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
  });

  test('protected endpoints redirect anonymous requests to the login page', async ({ request }) => {
    for (const path of ['/cart/add', '/checkout/goto', '/checkout']) {
      const response = await request.post(path, { form: { productId: 'mug' }, maxRedirects: 0 });
      expect(response.status(), `${path} should redirect`).toBe(302);
      expect(response.headers()['location'], `${path} should redirect to /login`).toBe('/login');
    }
  });

  test('cart API flow places an order and empties the cart', async ({ request }) => {
    await login(request);

    const add = await request.post('/cart/add', { form: { productId: 'mug' }, maxRedirects: 0 });
    expect(add.status()).toBe(302);

    const cart = await request.get('/cart');
    expect(cart.status()).toBe(200);
    expect(await cart.text()).toContain('Coffee Mug');

    const checkout = await request.post('/checkout', { maxRedirects: 0 });
    expect(checkout.status()).toBe(200);
    expect(await checkout.text()).toContain('Thank you for your purchase!');

    const emptyCart = await request.get('/cart');
    expect(await emptyCart.text()).toContain('Your cart is empty.');
  });

  test('logout invalidates the session', async ({ request }) => {
    await login(request);

    const logout = await request.get('/logout', { maxRedirects: 0 });
    expect(logout.status()).toBe(302);
    expect(logout.headers()['location']).toBe('/login');

    const cart = await request.get('/cart', { maxRedirects: 0 });
    expect(cart.status()).toBe(302);
    expect(cart.headers()['location']).toBe('/login');
  });

  test('unsupported HTTP methods return 405', async ({ request }) => {
    const response = await request.put('/api/products');
    expect(response.status()).toBe(405);
  });
});
