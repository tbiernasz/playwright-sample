import { test, expect } from '../fixtures';

test.describe('Logout', () => {
  test('user can log out and is redirected to login @smoke', async ({ authenticatedPage: page }) => {
    // 1. Navigate to the dashboard.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // 2. Click the 'Log out' link.
    await page.getByTestId('logout-link').click();

    // 3. Verify redirect to login page and session is destroyed.
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    // 4. Attempting to visit a protected page redirects back to login.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
