# CI/CD Plan — Playwright Sample

**Status:** Phase 1 implemented; nightly runs and Pages report adopted early
**Branch:** `master`
**Date:** 2026-11-24
**Scope:** GitHub Actions pipeline for lint, API, and Firefox E2E tests, reporting, and delivery of test artifacts.

---

## 1. Executive summary

**Yes — GitHub Actions is the right fit for this repository.** It is first-party, gives native PR checks and annotations, artifact storage, matrix jobs for sharding, merge-queue support, and GitHub Pages for publishing reports. No extra CI vendor or self-hosted runner is needed at this scale.

The target pipeline has three parallel quality gates on every PR and push:

1. **Lint, format & types** — fastest; no browser.
2. **API tests** — request-only; no browser download.
3. **E2E tests (Firefox)** — installs Firefox; runs the authenticated and anonymous projects.

Reports, traces, and videos are uploaded as artifacts; failures annotate the PR. On `master`, the merged HTML report can optionally be published to GitHub Pages. Sharding is added only when the E2E runtime justifies it — the suite currently runs in seconds, so sharding now would be pure overhead.

**Recommended rollout:** Phase 1 now (foundation), Phase 2 when the suite grows or E2E p95 exceeds ~5 minutes, Phase 3 for optimization and governance.

---

## 2. Current state

### 2.1 Suite shape

- 19 tests: 1 auth setup + 7 API (`tests/api/shop-api.spec.ts`) + 11 E2E (`tests/e2e/*`).
- Firefox-only; `...devices['Desktop Firefox']` lives in the top-level `use` block.
- Projects: `setup`, `api` (request-only), `firefox` (authenticated, `storageState`), `firefox-anon`.
- Local runtime: ~8 s with 8 workers; CI expected ~20–40 s.

### 2.2 Existing workflow

`.github/workflows/playwright.yml` currently:

- Runs one job on `ubuntu-latest` with `timeout-minutes: 15`.
- Uses `actions/checkout@v4`, `actions/setup-node@v4` (Node 22, npm cache).
- Runs `npm ci` → `npx playwright install --with-deps firefox` → `npx playwright test`.
- Uploads `playwright-report/` with `actions/upload-artifact@v4`.

### 2.3 Gaps vs. state of the art

| Area | Today | Target |
| --- | --- | --- |
| Triggers | push to `master`, PR | + `merge_group`, nightly, manual |
| Quality gates | tests only | format, lint, types, API, E2E |
| Parallelism | one job, `workers: 4` in CI | one worker per job; shard across jobs when needed |
| Reporting | HTML artifact | PR annotations, HTML artifact, failure traces/videos |
| Reliability | retries, `forbidOnly` | + `globalTimeout`, concurrency cancellation, nightly |
| Security | default token permissions | least privilege, pinned actions, Dependabot |
| Delivery | none | HTML report artifact; optional Pages publishing |
| Config portability | `baseURL` hardcoded | `PLAYWRIGHT_TEST_BASE_URL` override for post-deploy runs |

---

## 3. State of the art (2026)

### 3.1 Layered quality gates

Run the cheapest checks first and in parallel, so developers get the fastest possible signal:

- **Static:** Prettier check, ESLint, `tsc --noEmit` — seconds, no browser.
- **API:** Playwright `request` tests — seconds, no browser download.
- **E2E:** Firefox + application — tens of seconds today.

A red static check should never wait behind a browser install. Separate jobs also make the PR check list self-documenting.

### 3.2 Parallelism: workers vs. shards

Playwright's current guidance is to use **one worker per CI job** for stability, and to scale across machines with **sharding** rather than by raising `workers`:

```ts
workers: process.env.CI ? 1 : undefined,
```

Sharding (`npx playwright test --shard=1/4`) splits tests across jobs. With `fullyParallel: true` (already set), shards balance at test level, not file level. Oversubscribing workers on a small runner is a known cause of teardown timeouts — this repository already hit `Tearing down "context" exceeded the test timeout of 15000ms` at `--workers=8`.

For 19 tests, sharding is **not** worth it: each shard pays the Firefox install cost. Revisit when E2E p95 exceeds ~5 minutes or the suite passes ~100 tests.

### 3.3 Reporting: blob + merge

For sharded runs, each shard writes a **blob** report (`blob-report/`), uploads it, and a final `merge-reports` job combines them:

```bash
npx playwright merge-reports --reporter=html,github ./all-blob-reports
```

This produces one HTML report plus GitHub annotations. Without sharding, the built-in `github` and `html` reporters are enough.

Artifacts worth keeping:

- HTML report — 14–30 days.
- `test-results/` (traces, screenshots, videos) — 7 days.
- Blob reports — 1–3 days, only between shards and the merge job.

Use `if: ${{ !cancelled() }}` (not `always()`) so artifacts are uploaded on failure but not on cancellation.

### 3.4 Caching

- **npm:** `actions/setup-node` with `cache: npm` — worthwhile.
- **Playwright browsers:** official guidance says **do not cache**; restore time is comparable to download time, and Linux OS dependencies are not cacheable. Install only Firefox (`npx playwright install --with-deps firefox`).

### 3.5 Reliability

- `retries: 2` in CI, `forbidOnly: true` (already configured).
- `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'` (already configured).
- Set `globalTimeout` in `playwright.config.ts` so Playwright stops first and reporters still write a report. Keep the job `timeout-minutes` comfortably above it.
- `concurrency` with `cancel-in-progress` on PRs to stop superseded runs.
- `fail-fast: false` on shard matrices so every shard reports.
- Nightly scheduled runs catch flakiness and environment drift.

### 3.6 Security

- Top-level `permissions: contents: read`; grant `pages: write` / `id-token: write` only to the Pages job.
- No secrets are needed for these tests. Never use `pull_request_target` to check out and execute PR code.
- Fork PRs run with a read-only token and no secrets — keep it that way.
- Pin actions to commit SHAs for high-assurance supply chains; at minimum track major tags with Dependabot. Latest majors as of November 2026 are listed in §6.
- Treat reports and traces as potentially sensitive (they can contain request data, cookies, or source). Limit retention and do not publish traces from environments with real data.

### 3.7 Governance and delivery

- **Branch protection:** require PRs and the CI checks on `master`.
- **Merge queue:** add the `merge_group` trigger; the queue re-runs required checks on the combined change.
- **Nightly:** full suite on the default branch.
- **Dependabot:** weekly updates for npm and GitHub Actions.
- **Delivery:** publish the merged HTML report to GitHub Pages on `master` (optional), or keep it as a downloadable artifact. For a real deployment, add a post-deploy smoke job triggered by `deployment_status` and point `PLAYWRIGHT_TEST_BASE_URL` at the deployed URL.

### 3.8 What we deliberately skip (YAGNI)

| Practice | Why not now | Trigger to adopt |
| --- | --- | --- |
| Sharding | 19 tests, seconds of runtime | E2E p95 > 5 min or ~100+ tests |
| Playwright Docker image | `--with-deps firefox` is simpler | Visual tests or cross-OS reproducibility |
| Browser cache | Official guidance: no benefit | Never (unless self-hosted with slow network) |
| `--only-changed` fail-fast | Suite is already fast | Large suite with long feedback loops |
| Third-party dashboards (Currents, ReportPortal, Allure) | Built-in HTML + annotations are enough | Flake trends, quarantine, team analytics needed |
| Path filters on the workflow | Skipped required checks can block merges | A reliable aggregator job is in place |

---

## 4. Target design

### 4.1 Pipeline

```
PR / push / merge_group / manual
              │
   ┌──────────┼───────────────┐
   │          │               │
 lint       api             e2e (Firefox)
 ~1 min     ~1 min          ~1-2 min
   │          │               │
   └──────────┴───────────────┘
              │
        (Phase 2, when sharded)
              │
        merge-reports → HTML + GitHub annotations
              │
        (master only, optional)
              │
        GitHub Pages
```

### 4.2 Jobs

| Job | Runner | Browser | Purpose | Required check |
| --- | --- | --- | --- | --- |
| `lint` | `ubuntu-latest` | no | Prettier, ESLint, TypeScript | yes |
| `api` | `ubuntu-latest` | no | 7 request-level tests | yes |
| `e2e` | `ubuntu-latest` | Firefox | 11 UI tests + auth setup | yes |
| `merge-reports` | `ubuntu-latest` | no | Merge blobs (Phase 2 only) | when sharded |
| `publish-report` | `ubuntu-latest` | no | Pages deploy (optional) | no |

### 4.3 Triggers

- `push` to `master`.
- `pull_request` (all branches).
- `merge_group` (merge queue).
- `workflow_dispatch` (manual).
- `schedule` nightly (Phase 2).

### 4.4 Artifacts

| Artifact | Contents | Retention |
| --- | --- | --- |
| `playwright-report-<attempt>` | HTML report | 14 days |
| `test-results-<attempt>` | Traces, screenshots, videos | 7 days |
| `blob-report-<shard>-<attempt>` | Blob report per shard | 3 days |

---

## 5. Implementation plan

### Phase 1 — Foundation (do now, ~1–2 hours)

#### 5.1 Update `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;
const externalBaseURL = process.env.PLAYWRIGHT_TEST_BASE_URL;

/** E2E specs that must run in a fresh, unauthenticated context. */
const anonymousSpecs = [/login\.spec\.ts/, /auth-guard\.spec\.ts/, /navigation\.spec\.ts/];

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Official guidance: one worker per CI job; scale with shards, not workers.
  workers: isCI ? 1 : undefined,
  // Playwright stops the run itself, so reporters still produce a report.
  globalTimeout: 15 * 60_000,
  timeout: isCI ? 30_000 : 15_000,
  expect: { timeout: 3_000 },
  reporter: isCI
    ? [['github'], ['html', { open: 'never' }]]
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
```

Notes:

- `PLAYWRIGHT_TEST_BASE_URL` is the built-in Playwright override; it also lets the same suite run against a deployed environment later.
- When `PLAYWRIGHT_TEST_BASE_URL` is set, the local `webServer` is skipped.
- `workers: 1` is the official CI default; the suite is small enough that this is not a bottleneck. If wall time becomes a problem, shard — do not raise workers.

#### 5.2 Replace `.github/workflows/playwright.yml`

Use the complete Phase 1 workflow in §6.1. It adds the lint and API jobs, concurrency, least-privilege permissions, annotations, and failure artifacts.

#### 5.3 Add `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: '/'
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
  - package-ecosystem: github-actions
    directory: '/'
    schedule:
      interval: weekly
```

#### 5.4 Repository prerequisites

The local repo currently has **no remote** and the default branch is **`master`**.

1. Create an empty repository on GitHub (no README).
2. Add the remote and push:
   ```powershell
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin master
   git push -u origin feature/ci-cd-pipeline
   ```
3. Settings → Actions → General: allow Actions; set the default `GITHUB_TOKEN` permissions to read-only.
4. Settings → Branches → `master`: require a pull request and these checks:
   - `Lint, format & types`
   - `API tests`
   - `E2E tests (Firefox)`
5. Optional: enable the merge queue (public repos, or private repos on Team/Enterprise).
6. Optional: Settings → Pages → Source: **GitHub Actions** (Phase 2/3).

> If the default branch is renamed to `main`, update the `push.branches` filter in the workflow.

#### 5.5 Verification

1. Push the branch and open a draft PR.
2. Confirm all three checks pass and the API job has **no browser-install step**.
3. Download the HTML report artifact and open it locally:
   ```powershell
   npx playwright show-report <extracted-folder>
   ```
4. **Failure drill:** temporarily break one assertion on a scratch commit, push, and confirm:
   - the PR gets a GitHub annotation;
   - `test-results-*` contains the trace/video;
   - the check is red.
   Then revert the break.
5. Merge, confirm the run on `master`, and only then enable required checks.

---

### Phase 2 — Scale and reporting (only when triggered)

Adopt when E2E p95 > 5 minutes or the suite exceeds ~100 tests.

> **Adopted early:** the nightly schedule (step 5) and Pages report publishing (step 6) are already live. Sharding, blob merging, and the aggregator remain gated on the metrics above.

1. Switch the CI reporter to `blob`:
   ```ts
   reporter: isCI ? [['blob']] : [['html', { open: 'never' }], ['list']],
   ```
2. Convert `e2e` to a matrix of 2–4 shards (see §6.2).
3. Add the `merge-reports` job (see §6.2).
4. Add an aggregator `ci` job if branch protection would otherwise require every shard check:
   ```yaml
   ci:
     name: CI
     if: ${{ always() }}
     needs: [lint, api, e2e, merge-reports]
     runs-on: ubuntu-latest
     steps:
       - if: contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')
         run: exit 1
   ```
   Require only `CI` in branch protection.
5. Add the nightly schedule:
   ```yaml
   schedule:
     - cron: '0 3 * * *'
   ```
6. Optional: publish the merged report to GitHub Pages (§6.3).

---

### Phase 3 — Optimization and governance

- `--only-changed` fail-fast on PRs (`fetch-depth: 0`, compare with `origin/${{ github.base_ref }}`), followed by the full suite. Treat it as a heuristic, never as the only run.
- Flake tracking: export JUnit/JSON, feed a dashboard, and define a quarantine policy (tag `@flaky`, run separately, exclude from required checks until fixed).
- Post-deploy smoke: trigger on `deployment_status` and set `PLAYWRIGHT_TEST_BASE_URL` to the deployment URL.
- Pin actions to commit SHAs; let Dependabot update them.
- Optional CodeQL/default security setup.
- Review cost monthly: runner minutes, artifact retention, shard count.

---

## 6. Reference workflows

### 6.1 Phase 1 workflow (complete)

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
  merge_group:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  lint:
    name: Lint, format & types
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: lts/*
          cache: npm
      - run: npm ci
      - run: npm run format:check
      - run: npm run lint
      - run: npx tsc --noEmit

  api:
    name: API tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: lts/*
          cache: npm
      - run: npm ci
      # Request-only: no browser download needed.
      - run: npx playwright test --project=api

  e2e:
    name: E2E tests (Firefox)
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: lts/*
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps firefox
      - run: npx playwright test --project=firefox --project=firefox-anon
      - name: Upload HTML report
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v7
        with:
          name: playwright-report-${{ github.run_attempt }}
          path: playwright-report/
          retention-days: 14
      - name: Upload failure artifacts
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v7
        with:
          name: test-results-${{ github.run_attempt }}
          path: test-results/
          retention-days: 7
```

### 6.2 Phase 2 sharding delta

Replace the `e2e` job with a matrix and add `merge-reports`:

```yaml
  e2e:
    name: E2E shard ${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
    runs-on: ubuntu-latest
    timeout-minutes: 20
    strategy:
      fail-fast: false
      matrix:
        shardIndex: [1, 2, 3, 4]
        shardTotal: [4]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: lts/*
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps firefox
      - run: >-
          npx playwright test
          --project=firefox
          --project=firefox-anon
          --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
      - name: Upload blob report
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v7
        with:
          name: blob-report-${{ matrix.shardIndex }}-${{ github.run_attempt }}
          path: blob-report/
          retention-days: 3

  merge-reports:
    name: Merge reports
    if: ${{ !cancelled() }}
    needs: [e2e]
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: lts/*
          cache: npm
      - run: npm ci
      - uses: actions/download-artifact@v8
        with:
          path: all-blob-reports
          pattern: blob-report-*-${{ github.run_attempt }}
          merge-multiple: true
      - run: npx playwright merge-reports --reporter=html,github ./all-blob-reports
      - name: Upload HTML report
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v7
        with:
          name: playwright-report-${{ github.run_attempt }}
          path: playwright-report/
          retention-days: 14
```

### 6.3 Optional Pages publishing (Phase 2/3)

Requires **Settings → Pages → Source: GitHub Actions**. On private repositories, Pages availability depends on the plan; artifact download remains the fallback.

```yaml
  publish-report:
    name: Publish report to GitHub Pages
    if: github.event_name == 'push' && github.ref == 'refs/heads/master'
    needs: [merge-reports]
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/download-artifact@v8
        with:
          name: playwright-report-${{ github.run_attempt }}
          path: playwright-report
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: playwright-report
      - id: deployment
        uses: actions/deploy-pages@v5
```

### 6.4 Verified action versions (November 2026)

| Action | Latest major |
| --- | --- |
| `actions/checkout` | `v7` |
| `actions/setup-node` | `v7` |
| `actions/upload-artifact` | `v7` |
| `actions/download-artifact` | `v8` |
| `actions/configure-pages` | `v6` |
| `actions/upload-pages-artifact` | `v5` |
| `actions/deploy-pages` | `v5` |

Playwright's documentation still shows `checkout@v6`, `setup-node@v6`, and `upload-artifact@v5`; the majors above are newer. Use the latest majors plus Dependabot, or pin commit SHAs if supply-chain policy requires it.

---

## 7. Security notes

- Workflow default: `permissions: contents: read`.
- Pages job only: `pages: write`, `id-token: write`.
- No repository secrets are required. The mock app uses fixed test credentials.
- Do not use `pull_request_target` to run PR code; fork PRs must stay read-only and secretless.
- Artifacts can contain session cookies, request payloads, and source snippets. Keep retention short and avoid publishing traces from production-like environments.
- Pin actions to SHAs for high assurance; Dependabot can maintain them.
- Review Dependabot PRs like any other change; CI runs on them automatically.

---

## 8. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Firefox install adds ~30–60 s per E2E job | Install only Firefox; do not cache; shard only when runtime justifies it |
| Worker oversubscription causes teardown timeouts | `workers: 1` in CI; scale with shards |
| Flaky tests block merges | `retries: 2`, traces on retry, nightly runs, quarantine policy |
| Artifact quota/cost | Retention 3/7/14 days; upload failure artifacts only when useful |
| Required check skipped by path filters | No path filters on the required workflow; use an aggregator job if selective runs are added |
| Pages unavailable on private repos | Artifact download as the default; Pages only where the plan supports it |
| Action major bumps break the workflow | Dependabot PRs + CI verification; pin SHAs if needed |
| Report contains sensitive data | Short retention; do not publish traces publicly |

---

## 9. Decisions needed

| Decision | Recommended default | Alternative |
| --- | --- | --- |
| Sharding | **1 job now** | 2–4 shards when p95 > 5 min |
| Report hosting | **Artifact only** | GitHub Pages (public/Enterprise) |
| Node version | **`lts/*`** | Pin a major (e.g. `26`) for reproducibility |
| CI workers | **1** (official guidance) | 2–4 for speed at the cost of stability |
| Merge queue | **Enable** if the plan supports it | PR-only protection |
| CodeQL | Defer | Enable default setup |
| Action pinning | Major tags + Dependabot | Full commit SHAs |

---

## 10. Definition of done

- [ ] Plan reviewed and approved.
- [ ] `playwright.config.ts` updated (`globalTimeout`, `workers`, reporter, `baseURL` override).
- [ ] `.github/workflows/playwright.yml` replaced with the Phase 1 workflow.
- [ ] `.github/dependabot.yml` added.
- [ ] PR shows three green checks and a downloadable HTML report.
- [ ] Failure drill verified: annotation + trace/video artifact.
- [ ] Branch protection requires the checks on `master`.
- [ ] README CI section updated with jobs, artifacts, and how to open the report.
- [ ] Dependabot opens its first PRs.
- [ ] (Phase 2) Sharding + merge-reports verified; nightly green for 7 days.
- [ ] (Optional) Report published to GitHub Pages on `master`.

---

## 11. References

- Playwright — Continuous Integration: <https://playwright.dev/docs/ci>
- Playwright — Setting up CI: <https://playwright.dev/docs/ci-intro>
- Playwright — Sharding: <https://playwright.dev/docs/test-sharding>
- Playwright — Reporters: <https://playwright.dev/docs/test-reporters>
- GitHub Actions — Security hardening: <https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions>
- GitHub Actions — Merge queue (`merge_group`): <https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#merge_group>
- GitHub — Dependabot: <https://docs.github.com/en/code-security/dependabot>
