import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;
const externalBaseURL = process.env.PLAYWRIGHT_TEST_BASE_URL;
// Quarantine mode (set by the non-blocking e2e-flaky CI job): run only @flaky tests.
// See CI-CD-PLAN.md, Phase 3 "Flake tracking" for the quarantine policy.
const quarantineOnly = process.env.PLAYWRIGHT_QUARANTINE === '1';

/**
 * Per-project filter for flaky-test quarantine (see CI-CD-PLAN.md, Phase 3):
 * - `PLAYWRIGHT_QUARANTINE=1` (non-blocking `e2e-flaky` CI job): run only `@flaky` tests.
 * - Any other CI run: exclude `@flaky` tests so a quarantined test never blocks a merge.
 * - Local runs: unfiltered, so `npm test` still covers quarantined tests.
 * The `setup` project intentionally has no filter: if a dependency project has
 * zero matching tests, Playwright would skip its dependents as well.
 */
const flakyFilter = isCI ? (quarantineOnly ? { grep: /@flaky/ } : { grepInvert: /@flaky/ }) : {};

// Smoke mode (set by the post-deploy workflow): run only @smoke tests.
// See CI-CD-PLAN.md, Phase 3 "Post-deploy smoke".
const smokeOnly = process.env.PLAYWRIGHT_SMOKE === '1';

/**
 * Per-project filter for post-deploy smoke runs: only `@smoke` tests, in CI.
 * `setup` intentionally has no filter: if a dependency project has zero matching
 * tests, Playwright would skip its dependents. Local runs stay unfiltered.
 */
const smokeFilter = isCI && smokeOnly ? { grep: /@smoke/ } : {};

/** E2E specs that must run in a fresh, unauthenticated context. */
const anonymousSpecs = [/login\.spec\.ts/, /auth-guard\.spec\.ts/, /navigation\.spec\.ts/];

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // One worker per CI job; scale with shards instead of oversubscribing the runner.
  workers: isCI ? 1 : undefined,
  // Playwright stops the run itself, so reporters still write a report.
  globalTimeout: 15 * 60_000,
  timeout: isCI ? 30_000 : 15_000,
  expect: { timeout: 3_000 },
  reporter: isCI
    ? [
        ['github'],
        ['html', { open: 'never' }],
        // Machine-readable exports for flake tracking and dashboards (Phase 3).
        ['junit', { outputFile: 'junit.xml' }],
        ['json', { outputFile: 'results.json' }],
      ]
    : [['html', { open: 'never' }], ['list']],
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'node app/server.js',
        url: 'http://localhost:3000',
        reuseExistingServer: !isCI,
      },
  use: {
    ...devices['Desktop Firefox'],
    baseURL: externalBaseURL ?? 'http://localhost:3000',
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
    { name: 'api', testDir: './tests/api', ...flakyFilter, ...smokeFilter },
    {
      name: 'firefox',
      testDir: './tests/e2e',
      testIgnore: anonymousSpecs,
      use: { storageState: 'tests/.auth/user.json' },
      dependencies: ['setup'],
      ...flakyFilter,
      ...smokeFilter,
    },
    {
      name: 'firefox-anon',
      testDir: './tests/e2e',
      testMatch: anonymousSpecs,
      dependencies: ['setup'],
      ...flakyFilter,
      ...smokeFilter,
    },
  ],
});
