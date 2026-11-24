// spec: specs/nav-and-modals.test.plan.md
// seed: tests/auth.setup.ts

import { test, expect } from '../fixtures';

const NARROW_VIEWPORT = { width: 420, height: 900 };

test.describe('Responsive navigation', () => {
  test('wide viewport shows the pill navigation and hides the hamburger', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await expect(page.getByTestId('nav-toggle')).toBeHidden();
    await expect(page.getByTestId('nav-links')).toBeVisible();
    await expect(page.getByTestId('home-link')).toBeVisible();
    await expect(page.getByTestId('cart-link')).toBeVisible();
    await expect(page.getByTestId('logout-link')).toBeVisible();
  });

  test('narrow viewport hides the links behind the hamburger menu', async ({ authenticatedPage: page }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    await page.goto('/');

    await expect(page.getByTestId('nav-toggle')).toBeVisible();
    await expect(page.getByTestId('nav-links')).toBeHidden();
    await expect(page.getByTestId('home-link')).toBeHidden();
    await expect(page.getByTestId('cart-link')).toBeHidden();
    await expect(page.getByTestId('logout-link')).toBeHidden();
  });

  test('narrow viewport hamburger opens and closes the menu', async ({ authenticatedPage: page }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    await page.goto('/');
    await expect(page.getByTestId('nav-links')).toBeHidden();

    await page.getByTestId('nav-toggle').click();
    await expect(page.getByTestId('nav-links')).toBeVisible();
    await expect(page.getByTestId('home-link')).toBeVisible();
    await expect(page.getByTestId('cart-link')).toBeVisible();
    await expect(page.getByTestId('logout-link')).toBeVisible();

    await page.getByTestId('nav-toggle').click();
    await expect(page.getByTestId('nav-links')).toBeHidden();
  });

  test('narrow viewport navigation through the open menu lands on the page with the menu closed', async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    await page.goto('/');

    await page.getByTestId('nav-toggle').click();
    await page.getByTestId('cart-link').click();

    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole('heading', { name: 'Cart', exact: true })).toBeVisible();

    // Navigating resets the checkbox-hack, so the menu starts closed on the new page.
    await expect(page.getByTestId('nav-toggle')).toBeVisible();
    await expect(page.getByTestId('nav-links')).toBeHidden();
  });
});
