// spec: specs/checkout.test.plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('login with a wrong password shows an error and does not log in', async ({ browser }) => {
    // 1. Open a fresh, unauthenticated browser context (no stored storageState) and navigate to /login.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByTestId('email-input')).toBeVisible();
    await expect(page.getByTestId('password-input')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByTestId('login-error')).not.toBeVisible();

    // 2. Type 'test@example.com' into the 'Email' field (data-testid=email-input).
    await page.getByTestId('email-input').fill('test@example.com');

    // 3. Type an incorrect password, e.g. 'wrongpassword', into the 'Password' field (data-testid=password-input).
    await page.getByTestId('password-input').fill('wrongpassword');

    // 4. Click the 'Sign in' button (data-testid=sign-in).
    await page.getByTestId('sign-in').click();
    await expect(page.getByTestId('login-error')).toHaveText('Invalid email or password.');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).not.toBeVisible();
    const cookies = await context.cookies();
    expect(cookies.map((cookie) => cookie.name)).not.toContain('sid');
    await context.close();
  });
});
