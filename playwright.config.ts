import { defineConfig, devices } from '@playwright/test';

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
    {
      name: 'chromium',
      testIgnore: [/login\.spec\.ts/, /auth-guard\.spec\.ts/, /navigation\.spec\.ts/, /seed\.spec\.ts/],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'chromium-anon',
      testMatch: [/login\.spec\.ts/, /auth-guard\.spec\.ts/, /navigation\.spec\.ts/],
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to run cross-browser:
    // {
    //   name: 'firefox',
    //   testIgnore: [/login\.spec\.ts/, /auth-guard\.spec\.ts/, /navigation\.spec\.ts/, /seed\.spec\.ts/],
    //   use: {
    //     ...devices['Desktop Firefox'],
    //     storageState: 'tests/.auth/user.json',
    //   },
    //   dependencies: ['setup'],
    // },
    // {
    //   name: 'webkit',
    //   testIgnore: [/login\.spec\.ts/, /auth-guard\.spec\.ts/, /navigation\.spec\.ts/, /seed\.spec\.ts/],
    //   use: {
    //     ...devices['Desktop Safari'],
    //     storageState: 'tests/.auth/user.json',
    //   },
    //   dependencies: ['setup'],
    // },
  ],
});
