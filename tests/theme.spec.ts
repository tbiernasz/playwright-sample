import { test, expect } from '@playwright/test';

test.describe('Theme', () => {
  test('pages render with the dark background and light text', async ({ page }) => {
    await page.goto('/login');

    // `body` has no accessible role, so a raw selector is the only option for page-level styling.
    const body = page.locator('body');
    await expect(body).toHaveCSS('background-color', 'rgb(18, 18, 18)');
    await expect(body).toHaveCSS('color', 'rgb(230, 230, 230)');
  });
});
