// spec: specs/checkout.test.plan.md
// seed: tests/auth.setup.ts

import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
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

  test('user can add an item to the cart and complete checkout', async ({ page }) => {
    // 1. Navigate to the dashboard (GET /). Precondition: authenticated session (storageState from tests/auth.setup.ts) with an empty cart.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Coffee Mug — $10.00')).toBeVisible();
    await expect(page.getByText('Logo T-Shirt — $20.00')).toBeVisible();
    await expect(page.getByTestId('cart-link')).toBeVisible();

    // 2. Click the 'Add to cart' button (data-testid=add-to-cart) inside the product item (data-testid=product-item) that contains 'Coffee Mug'.
    await page.getByTestId('product-item').filter({ hasText: 'Coffee Mug' }).getByTestId('add-to-cart').click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // 3. Click the 'Cart' navigation link (data-testid=cart-link) (or navigate to /cart).
    await page.getByTestId('cart-link').click();
    await expect(page.getByRole('heading', { name: 'Cart' })).toBeVisible();
    await expect(page.getByText('Coffee Mug — $10.00')).toBeVisible();
    await expect(page.getByTestId('proceed-to-checkout')).toBeVisible();

    // 4. Click the 'Proceed to checkout' button (data-testid=proceed-to-checkout).
    await page.getByTestId('proceed-to-checkout').click();
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    await expect(page.getByText('Coffee Mug — $10.00')).toBeVisible();
    await expect(page.getByText('Total: $10.00')).toBeVisible();
    await expect(page.getByTestId('place-order')).toBeVisible();

    // 5. Click the 'Place order' button (data-testid=place-order).
    await page.getByTestId('place-order').click();
    await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
    await expect(page.getByText('Thank you for your purchase!')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to dashboard' })).toBeVisible();
    await page.goto('/cart');
    await expect(page.getByText('Your cart is empty.')).toBeVisible();
  });

  test('checkout total reflects the sum of multiple cart items', async ({ page }) => {
    // 1. Navigate to the dashboard (GET /). Precondition: authenticated session with an empty cart.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // 2. Click 'Add to cart' (data-testid=add-to-cart) for the 'Coffee Mug' product, then click 'Add to cart' for the 'Logo T-Shirt' product.
    await page.getByTestId('product-item').filter({ hasText: 'Coffee Mug' }).getByTestId('add-to-cart').click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await page.getByTestId('product-item').filter({ hasText: 'Logo T-Shirt' }).getByTestId('add-to-cart').click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // 3. Navigate to /cart.
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Cart' })).toBeVisible();
    await expect(page.getByText('Coffee Mug — $10.00')).toBeVisible();
    await expect(page.getByText('Logo T-Shirt — $20.00')).toBeVisible();

    // 4. Click the 'Proceed to checkout' button (data-testid=proceed-to-checkout).
    await page.getByTestId('proceed-to-checkout').click();
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    await expect(page.getByText('Coffee Mug — $10.00')).toBeVisible();
    await expect(page.getByText('Logo T-Shirt — $20.00')).toBeVisible();
    await expect(page.getByText('Total: $30.00')).toBeVisible();

    // 5. Click the 'Place order' button (data-testid=place-order).
    await page.getByTestId('place-order').click();
    await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
    await expect(page.getByText('Thank you for your purchase!')).toBeVisible();
  });
});
