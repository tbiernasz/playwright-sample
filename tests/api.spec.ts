import { test, expect } from '@playwright/test';

test.describe('API', () => {
  test('GET /api/products returns the product catalog as JSON', async ({ request }) => {
    const response = await request.get('/api/products');
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('application/json');

    const products = await response.json();
    expect(products).toEqual([
      { id: 'mug', name: 'Coffee Mug', price: 10 },
      { id: 'tee', name: 'Logo T-Shirt', price: 20 },
    ]);
  });
});
