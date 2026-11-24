import { test, expect } from '@playwright/test';

test('loads dashboard @smoke', async ({ page }) => {
  await page.goto('/');
  // TEMPORARY: intentional failure for the CI failure drill.
  await expect(page.getByRole('heading', { name: 'Failure drill' })).toBeVisible();
});
