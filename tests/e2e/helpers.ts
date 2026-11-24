import { expect, type Page } from '@playwright/test';

/** Adds a product from the dashboard and waits for the confirmation flash. */
export async function addToCart(page: Page, productName: string) {
  await page.getByTestId('product-item').filter({ hasText: productName }).getByTestId('add-to-cart').click();
  await expect(page.getByTestId('flash')).toContainText(`${productName} added to your cart.`);
}
