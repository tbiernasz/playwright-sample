import { defineConfig, devices } from '@playwright/test';

/** E2E specs that must run in a fresh, unauthenticated context. */
const anonymousSpecs = [/login\.spec\.ts/, /auth-guard\.spec\.ts/, /navigation\.spec\.ts/];

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  timeout: 15_000,
  expect: { timeout: 3_000 },
  reporter: [['html'], ['list']],
  webServer: {
    command: 'node app/server.js',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    ...devices['Desktop Firefox'],
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      slowMo: process.env.SLOWMO ? parseInt(process.env.SLOWMO, 10) : 0,
    },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    // Request-only specs: no browser and no stored auth state.
    { name: 'api', testDir: './tests/api' },
    {
      name: 'firefox',
      testDir: './tests/e2e',
      testIgnore: anonymousSpecs,
      use: { storageState: 'tests/.auth/user.json' },
      dependencies: ['setup'],
    },
    {
      name: 'firefox-anon',
      testDir: './tests/e2e',
      testMatch: anonymousSpecs,
      dependencies: ['setup'],
    },
  ],
});
