import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('unknown route returns 404 page', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const response = await page.goto('/this-route-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: '404 Not found' })).toBeVisible();
    await context.close();
  });
});
