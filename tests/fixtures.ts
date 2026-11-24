/**
 * Shared Playwright fixtures for the mock-shop test suite.
 *
 * `authenticatedPage` — a page with its own fresh server-side session,
 * so each test owns an independent cart even under `fullyParallel`.
 */
import { test as base, expect } from '@playwright/test';

type ShopFixtures = {
  /** A page backed by a freshly-minted server session (empty cart). */
  authenticatedPage: import('@playwright/test').Page;
};

export const test = base.extend<ShopFixtures>({
  authenticatedPage: async ({ page, request }, use) => {
    const response = await request.post('/login', {
      form: { email: 'test@example.com', password: 'password123' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    const setCookie = response.headers()['set-cookie'] || '';
    const match = /sid=([^;]+)/.exec(setCookie);
    if (!match?.[1]) {
      throw new Error('Login did not return a session cookie');
    }
    await page.context().addCookies([{ name: 'sid', value: match[1], domain: 'localhost', path: '/' }]);
    await use(page);
  },
});

export { expect };
