// spec: specs/checkout.test.plan.md
// seed: tests/auth.setup.ts

import { test, expect } from '../fixtures';

test.describe('Checkout Flow', () => {
  test('user can add an item to the cart and complete checkout @regression', async ({ authenticatedPage: page }) => {
    // 1. Navigate to the dashboard (GET /). Precondition: authenticated session with an empty cart.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Coffee Mug — $10.00')).toBeVisible();
    await expect(page.getByText('Logo T-Shirt — $20.00')).toBeVisible();
    await expect(page.getByTestId('cart-link')).toBeVisible();

    // 2. Click the 'Add to cart' button inside the product item that contains 'Coffee Mug'.
    await page.getByTestId('product-item').filter({ hasText: 'Coffee Mug' }).getByTestId('add-to-cart').click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // 3. Click the 'Cart' navigation link.
    await page.getByTestId('cart-link').click();
    await expect(page.getByRole('heading', { name: 'Cart' })).toBeVisible();
    await expect(page.getByText('Coffee Mug — $10.00')).toBeVisible();
    await expect(page.getByTestId('proceed-to-checkout')).toBeVisible();

    // 4. Click the 'Proceed to checkout' button.
    await page.getByTestId('proceed-to-checkout').click();
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    await expect(page.getByText('Coffee Mug — $10.00')).toBeVisible();
    await expect(page.getByTestId('checkout-total')).toHaveText('Total: $10.00');
    await expect(page.getByTestId('place-order')).toBeVisible();

    // 5. Click the 'Place order' button.
    await page.getByTestId('place-order').click();
    await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
    await expect(page.getByTestId('order-confirmation')).toHaveText('Thank you for your purchase!');
    await expect(page.getByTestId('back-link')).toBeVisible();
    await page.goto('/cart');
    await expect(page.getByTestId('cart-empty')).toHaveText('Your cart is empty.');
  });

  test('checkout total reflects the sum of multiple cart items @regression', async ({ authenticatedPage: page }) => {
    // 1. Navigate to the dashboard (GET /). Precondition: authenticated session with an empty cart.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // 2. Click 'Add to cart' for the 'Coffee Mug' product, then 'Logo T-Shirt'.
    await page.getByTestId('product-item').filter({ hasText: 'Coffee Mug' }).getByTestId('add-to-cart').click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await page.getByTestId('product-item').filter({ hasText: 'Logo T-Shirt' }).getByTestId('add-to-cart').click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // 3. Navigate to /cart.
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Cart' })).toBeVisible();
    await expect(page.getByText('Coffee Mug — $10.00')).toBeVisible();
    await expect(page.getByText('Logo T-Shirt — $20.00')).toBeVisible();

    // 4. Click the 'Proceed to checkout' button.
    await page.getByTestId('proceed-to-checkout').click();
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    await expect(page.getByText('Coffee Mug — $10.00')).toBeVisible();
    await expect(page.getByText('Logo T-Shirt — $20.00')).toBeVisible();
    await expect(page.getByTestId('checkout-total')).toHaveText('Total: $30.00');

    // 5. Click the 'Place order' button.
    await page.getByTestId('place-order').click();
    await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
    await expect(page.getByTestId('order-confirmation')).toHaveText('Thank you for your purchase!');
  });
});
