// spec: specs/checkout.test.plan.md
// seed: tests/auth.setup.ts

import { test, expect } from '../fixtures';
import { addToCart } from './helpers';

test.describe('Cart', () => {
  test('first visit to the cart shows an empty state', async ({ authenticatedPage: page }) => {
    // 1. Navigate to /cart directly, without adding any items. Precondition: a fresh authenticated session with an empty cart.
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Cart', exact: true })).toBeVisible();
    await expect(page.getByTestId('cart-empty')).toHaveText('Your cart is empty.');
    await expect(page.getByTestId('proceed-to-checkout')).not.toBeVisible();
    await expect(page.getByTestId('back-link')).toBeVisible();
  });

  test('adding the same product twice increments its quantity and cart badge', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await expect(page.getByTestId('cart-count')).toHaveText('0');

    // 1. Add the same product twice; the server should merge the lines.
    await addToCart(page, 'Coffee Mug');
    await expect(page.getByTestId('cart-count')).toHaveText('1');
    await addToCart(page, 'Coffee Mug');
    await expect(page.getByTestId('cart-count')).toHaveText('2');

    // 2. The cart shows one line with quantity 2 and the correct totals.
    await page.getByTestId('cart-link').click();
    await expect(page.getByRole('heading', { name: 'Cart', exact: true })).toBeVisible();

    const item = page.getByTestId('cart-item').filter({ hasText: 'Coffee Mug' });
    await expect(item).toHaveCount(1);
    await expect(item.getByTestId('item-quantity')).toHaveText('2');
    await expect(item.getByTestId('line-total')).toHaveText('$20.00');
    await expect(page.getByTestId('cart-subtotal')).toHaveText('$20.00');
    await expect(page.getByTestId('cart-total')).toHaveText('$20.00');
  });

  test('quantity controls update the line total and remove the item at zero', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await addToCart(page, 'Coffee Mug');
    await page.getByTestId('cart-link').click();

    const item = page.getByTestId('cart-item').filter({ hasText: 'Coffee Mug' });
    await expect(item.getByTestId('item-quantity')).toHaveText('1');
    await expect(item.getByTestId('line-total')).toHaveText('$10.00');

    // 1. Increase the quantity; the line total and header badge should update.
    await item.getByTestId('increase-quantity').click();
    await expect(item.getByTestId('item-quantity')).toHaveText('2');
    await expect(item.getByTestId('line-total')).toHaveText('$20.00');
    await expect(page.getByTestId('cart-count')).toHaveText('2');

    // 2. Decrease it again; the totals return to a single item.
    await item.getByTestId('decrease-quantity').click();
    await expect(item.getByTestId('item-quantity')).toHaveText('1');
    await expect(item.getByTestId('line-total')).toHaveText('$10.00');

    // 3. Decreasing at quantity 1 removes the line and shows the empty state.
    await item.getByTestId('decrease-quantity').click();
    await expect(page.getByTestId('cart-empty')).toHaveText('Your cart is empty.');
    await expect(page.getByTestId('cart-count')).toHaveText('0');
  });

  test('clear cart removes every item after confirmation', async ({ authenticatedPage: page }) => {
    // 1. Seed two lines, then open the cart.
    await page.goto('/');
    await addToCart(page, 'Coffee Mug');
    await addToCart(page, 'Logo T-Shirt');
    await page.getByTestId('cart-link').click();
    await expect(page.getByTestId('cart-item')).toHaveCount(2);

    // 2. "Clear cart" opens the confirmation modal instead of acting immediately.
    await page.getByTestId('clear-cart').click();
    const modal = page.getByTestId('clear-cart-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Clear your cart?' })).toBeVisible();
    await expect(modal).toContainText('This removes all 2 items');

    // 3. Confirming clears the cart and navigates away from the dialog.
    await modal.getByTestId('confirm-clear').click();
    await expect(page.getByTestId('cart-empty')).toHaveText('Your cart is empty.');
    await expect(page.getByTestId('cart-count')).toHaveText('0');
  });

  test('cancel on the clear-cart dialog keeps every item', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await addToCart(page, 'Coffee Mug');
    await addToCart(page, 'Logo T-Shirt');
    await page.getByTestId('cart-link').click();
    await expect(page.getByTestId('cart-item')).toHaveCount(2);

    // 1. Open the dialog, then cancel it.
    await page.getByTestId('clear-cart').click();
    const modal = page.getByTestId('clear-cart-modal');
    await expect(modal).toBeVisible();
    await modal.getByTestId('cancel-clear').click();

    // 2. No page navigation happened and nothing was removed (the # fragment from the cancel link stays).
    await expect(page).toHaveURL(/\/cart/);
    await expect(modal).toBeHidden();
    await expect(page.getByTestId('cart-item')).toHaveCount(2);
    await expect(page.getByTestId('cart-count')).toHaveText('2');
  });
});
