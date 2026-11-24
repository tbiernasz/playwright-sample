// spec: specs/checkout.test.plan.md
// seed: tests/auth.setup.ts

import { test, expect } from './fixtures';

test.describe('Cart State', () => {
  test('first visit to the cart shows an empty state', async ({ authenticatedPage: page }) => {
    // 1. Navigate to /cart directly, without adding any items. Precondition: a fresh authenticated session with an empty cart.
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Cart' })).toBeVisible();
    await expect(page.getByTestId('cart-empty')).toHaveText('Your cart is empty.');
    await expect(page.getByTestId('proceed-to-checkout')).not.toBeVisible();
    await expect(page.getByTestId('back-link').first()).toBeVisible();
  });
});
