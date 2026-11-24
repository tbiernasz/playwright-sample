import { test, expect } from '@playwright/test';

test('loads dashboard with products and navigation @smoke', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(page.getByTestId('cart-link')).toBeVisible();
  await expect(page.getByTestId('cart-count')).toHaveText('0');

  const productCards = page.getByTestId('product-item');
  await expect(productCards).toHaveCount(2);
  await expect(productCards.filter({ hasText: 'Coffee Mug' }).getByTestId('product-price')).toHaveText('$10.00');
  await expect(productCards.filter({ hasText: 'Logo T-Shirt' }).getByTestId('product-price')).toHaveText('$20.00');
});
