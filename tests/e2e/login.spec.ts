// spec: specs/checkout.test.plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('login with a wrong password shows an error and does not log in', async ({ page }) => {
    // 1. Navigate to /login (firefox-anon project has no storageState, so this is unauthenticated).
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByTestId('email-input')).toBeVisible();
    await expect(page.getByTestId('password-input')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByTestId('login-error')).not.toBeVisible();

    // 2. Type 'test@example.com' into the 'Email' field.
    await page.getByTestId('email-input').fill('test@example.com');

    // 3. Type an incorrect password into the 'Password' field.
    await page.getByTestId('password-input').fill('wrongpassword');

    // 4. Click the 'Sign in' button.
    await page.getByTestId('sign-in').click();
    await expect(page.getByTestId('login-error')).toHaveText('Invalid email or password.');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).not.toBeVisible();
  });

  test('successful login redirects to dashboard @smoke', async ({ page }) => {
    // 1. Navigate to /login.
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    // 2. Fill in valid credentials.
    await page.getByTestId('email-input').fill('test@example.com');
    await page.getByTestId('password-input').fill('password123');

    // 3. Click the 'Sign in' button.
    await page.getByTestId('sign-in').click();

    // 4. Verify redirect to dashboard.
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page).toHaveURL('/');
  });
});
