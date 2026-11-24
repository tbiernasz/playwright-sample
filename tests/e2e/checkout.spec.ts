// spec: specs/checkout.test.plan.md
// seed: tests/auth.setup.ts

import { test, expect } from '../fixtures';
import { addToCart } from './helpers';

test.describe('Checkout Flow', () => {
  test('user can add an item to the cart and complete checkout @regression', async ({ authenticatedPage: page }) => {
    // 1. Navigate to the dashboard (GET /). Precondition: authenticated session with an empty cart.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    const products = page.getByTestId('product-item');
    await expect(products.filter({ hasText: 'Coffee Mug' }).getByTestId('product-price')).toHaveText('$10.00');
    await expect(products.filter({ hasText: 'Logo T-Shirt' }).getByTestId('product-price')).toHaveText('$20.00');
    await expect(page.getByTestId('cart-link')).toBeVisible();

    // 2. Add 'Coffee Mug' to the cart.
    await addToCart(page, 'Coffee Mug');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // 3. Open the cart and verify the line item.
    await page.getByTestId('cart-link').click();
    await expect(page.getByRole('heading', { name: 'Cart', exact: true })).toBeVisible();
    const cartItem = page.getByTestId('cart-item').filter({ hasText: 'Coffee Mug' });
    await expect(cartItem.getByTestId('item-quantity')).toHaveText('1');
    await expect(cartItem.getByTestId('line-total')).toHaveText('$10.00');
    await expect(page.getByTestId('proceed-to-checkout')).toBeVisible();

    // 4. Proceed to checkout and verify the summary.
    await page.getByTestId('proceed-to-checkout').click();
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    const checkoutItem = page.getByTestId('checkout-item').filter({ hasText: 'Coffee Mug' });
    await expect(checkoutItem).toContainText('Coffee Mug × 1');
    await expect(checkoutItem).toContainText('$10.00');
    await expect(page.getByTestId('checkout-total')).toHaveText('Total: $10.00');
    await expect(page.getByTestId('place-order')).toBeVisible();

    // 5. "Place order" opens the confirmation modal showing the total.
    await page.getByTestId('place-order').click();
    const modal = page.getByTestId('confirm-order-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Confirm your order' })).toBeVisible();
    await expect(modal.getByTestId('confirm-order-total')).toHaveText('$10.00');

    // 6. Confirm the order and verify confirmation plus an empty cart.
    await modal.getByTestId('confirm-order').click();
    await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
    await expect(page.getByTestId('order-confirmation')).toHaveText('Thank you for your purchase!');
    await expect(page.getByTestId('order-number')).toHaveText(/^#\d+$/);
    await expect(page.getByTestId('back-link')).toBeVisible();
    await page.goto('/cart');
    await expect(page.getByTestId('cart-empty')).toHaveText('Your cart is empty.');
  });

  test('checkout total reflects the sum of multiple cart items @regression', async ({ authenticatedPage: page }) => {
    // 1. Navigate to the dashboard. Precondition: authenticated session with an empty cart.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // 2. Add both products.
    await addToCart(page, 'Coffee Mug');
    await addToCart(page, 'Logo T-Shirt');

    // 3. The cart merges each product into its own line.
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Cart', exact: true })).toBeVisible();
    await expect(page.getByTestId('cart-item')).toHaveCount(2);
    await expect(page.getByTestId('cart-item').filter({ hasText: 'Coffee Mug' }).getByTestId('line-total')).toHaveText(
      '$10.00',
    );
    await expect(
      page.getByTestId('cart-item').filter({ hasText: 'Logo T-Shirt' }).getByTestId('line-total'),
    ).toHaveText('$20.00');

    // 4. Checkout shows both items and the summed total.
    await page.getByTestId('proceed-to-checkout').click();
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    await expect(page.getByTestId('checkout-item').filter({ hasText: 'Coffee Mug' })).toBeVisible();
    await expect(page.getByTestId('checkout-item').filter({ hasText: 'Logo T-Shirt' })).toBeVisible();
    await expect(page.getByTestId('checkout-total')).toHaveText('Total: $30.00');

    // 5. Confirm the order from the modal; the total shown matches the summary.
    await page.getByTestId('place-order').click();
    const modal = page.getByTestId('confirm-order-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByTestId('confirm-order-total')).toHaveText('$30.00');
    await modal.getByTestId('confirm-order').click();
    await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
    await expect(page.getByTestId('order-confirmation')).toHaveText('Thank you for your purchase!');
  });

  test('cancel on the order confirmation keeps the cart intact', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await addToCart(page, 'Coffee Mug');

    // 1. Reach the checkout and open the confirmation modal.
    await page.getByTestId('cart-link').click();
    await page.getByTestId('proceed-to-checkout').click();
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    await page.getByTestId('place-order').click();
    const modal = page.getByTestId('confirm-order-modal');
    await expect(modal).toBeVisible();

    // 2. Cancel; no order is placed and the cart is unchanged (the # fragment from the cancel link stays).
    await modal.getByTestId('cancel-order').click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(modal).toBeHidden();
    await expect(page.getByTestId('place-order')).toBeVisible();
    await page.goto('/cart');
    await expect(page.getByTestId('cart-item')).toHaveCount(1);
    await expect(page.getByTestId('cart-count')).toHaveText('1');
  });

  test('checkout with an empty cart shows the empty state and no order button', async ({ authenticatedPage: page }) => {
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    await expect(page.getByTestId('cart-empty')).toHaveText('Your cart is empty.');
    await expect(page.getByTestId('place-order')).not.toBeVisible();
    await expect(page.getByTestId('back-link')).toBeVisible();
  });
});
