// spec: specs/nav-and-modals.test.plan.md
// seed: tests/auth.setup.ts

import { test, expect } from '../fixtures';

test.describe('Product details modals', () => {
  test('opening product details shows the full description, price and add control', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/');
    const card = page.getByTestId('product-item').filter({ hasText: 'Coffee Mug' });
    await card.getByTestId('product-details').click();

    const modal = page.getByTestId('product-modal-mug');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Coffee Mug' })).toBeVisible();
    await expect(modal).toContainText('A heavyweight ceramic mug for long debugging sessions.');
    await expect(modal.getByTestId('product-price')).toHaveText('$10.00');
    await expect(modal.getByTestId('modal-add-to-cart')).toBeVisible();
  });

  test('closing the product details modal returns to the dashboard', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    const card = page.getByTestId('product-item').filter({ hasText: 'Coffee Mug' });
    await card.getByTestId('product-details').click();
    const modal = page.getByTestId('product-modal-mug');
    await expect(modal).toBeVisible();

    await modal.getByTestId('modal-close').click();
    await expect(modal).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('the second product opens its own modal', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    const card = page.getByTestId('product-item').filter({ hasText: 'Logo T-Shirt' });
    await card.getByTestId('product-details').click();

    const modal = page.getByTestId('product-modal-tee');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Logo T-Shirt' })).toBeVisible();
    await expect(modal).toContainText('Soft cotton tee with the sample-shop logo. One size fits most.');
    await expect(modal.getByTestId('product-price')).toHaveText('$20.00');
    await expect(page.getByTestId('product-modal-mug')).toBeHidden();
  });

  test('adding from the product modal updates the cart and closes the modal', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    const card = page.getByTestId('product-item').filter({ hasText: 'Logo T-Shirt' });
    await card.getByTestId('product-details').click();
    const modal = page.getByTestId('product-modal-tee');
    await expect(modal).toBeVisible();

    await modal.getByTestId('modal-add-to-cart').click();

    // Post/Redirect/Get returns to the dashboard: flash shown, badge bumped, modal gone.
    await expect(page.getByTestId('flash')).toContainText('Logo T-Shirt added to your cart.');
    await expect(page.getByTestId('cart-count')).toHaveText('1');
    await expect(modal).toBeHidden();
  });
});
