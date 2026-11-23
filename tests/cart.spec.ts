// spec: specs/checkout.test.plan.md
// seed: tests/auth.setup.ts

import { test, expect } from '@playwright/test';

test.describe('Cart State', () => {
  test.beforeEach(async ({ page, request }) => {
    // Mint a fresh server-side session per test so each test owns its own cart
    // (all chromium-project tests otherwise share one sid via storageState).
    const response = await request.post('/login', {
      form: { email: 'test@example.com', password: 'password123' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    const match = /sid=([^;]+)/.exec(response.headers()['set-cookie'] || '');
    expect(match?.[1]).toBeTruthy();
    await page.context().addCookies([
      { name: 'sid', value: match![1], domain: 'localhost', path: '/' },
    ]);
  });

  test('first visit to the cart shows an empty state', async ({ page }) => {
    // 1. Navigate to /cart directly, without adding any items. Precondition: a fresh authenticated session with an empty cart.
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Cart' })).toBeVisible();
    await expect(page.getByText('Your cart is empty.')).toBeVisible();
    await expect(page.getByTestId('proceed-to-checkout')).not.toBeVisible();
    // The page renders two 'Back to products' links (empty-cart body + footer), so scope to the first one.
    await expect(page.getByRole('link', { name: 'Back to products' }).first()).toBeVisible();
  });
});
