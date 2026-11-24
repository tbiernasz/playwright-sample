# Playwright + AI Test Automation Sample

[![CI](https://github.com/tbiernasz/playwright-sample/actions/workflows/playwright.yml/badge.svg)](https://github.com/tbiernasz/playwright-sample/actions/workflows/playwright.yml)

Playwright (TypeScript) project wired into [opencode](https://opencode.ai) using Playwright's built-in AI test agents (**planner → generator → healer**) and a local LLM (llama.cpp).

## Prerequisites

- **Node.js** ≥ 20
- **npm** (bundled with Node)
- Firefox (installed by Playwright — see Quick Start)

## Stack

- Playwright Test 1.65 (TypeScript, Firefox)
- opencode + Playwright agents (configured in `opencode.json`, prompts in `.opencode/prompts/`)
- Playwright Test MCP server (`npx playwright run-test-mcp-server`)
- Local LLM: Qwen3.8-27B via llama.cpp (OpenAI-compatible endpoint, tool use enabled, 65k context)
- Zero-dependency mock app (`app/server.js`) standing in for the app under test

## Layout

```
app/server.js            # mock shop: login -> dashboard -> cart -> checkout (port 3000)
tests/
  fixtures.ts            # shared Playwright fixtures (authenticatedPage)
  auth.setup.ts          # login once, saves storageState to tests/.auth/user.json
  api/
    shop-api.spec.ts     # request-level API tests (no browser)
  e2e/
    smoke.spec.ts        # smoke test (dashboard loads)
    checkout.spec.ts     # full checkout flow + multi-item total
    cart.spec.ts         # empty-cart state
    login.spec.ts        # failed login + successful login (runs unauthenticated)
    logout.spec.ts       # logout flow
    auth-guard.spec.ts   # unauthenticated access redirects to login
    navigation.spec.ts   # 404 page
specs/                   # markdown test plans produced by the planner agent
opencode.json            # project opencode config: MCP server + 3 agent definitions
AGENTS.md                # conventions the AI agents follow
.github/workflows/       # CI: lint, API, and Firefox E2E jobs
.github/dependabot.yml   # weekly npm + GitHub Actions updates
```

Projects in `playwright.config.ts`: `setup` (auth) → `api` (request-only, no browser), `firefox` (authenticated, `storageState`) and `firefox-anon` (no `storageState`, runs the anonymous specs: `login.spec.ts`, `auth-guard.spec.ts`, `navigation.spec.ts`).

## Quick start

```bash
npm ci
npx playwright install firefox
npm test          # auto-starts the mock app via the webServer config, runs all tests
npm run report    # open the HTML report
```

Mock app credentials: `test@example.com` / `password123`
Run the mock app standalone: `npm run start:mock`

## CI

GitHub Actions runs three parallel jobs on every pull request, on pushes to `master`, and nightly at 03:00 UTC (`.github/workflows/playwright.yml`):

| Job | What it runs |
|-----|--------------|
| Lint, format & types | `npm run format:check`, `npm run lint`, `npm run typecheck` |
| API tests | `npx playwright test --project=api` (request-only, no browser) |
| E2E tests (Firefox) | installs Firefox, runs the `firefox` and `firefox-anon` projects |

Every run uploads `playwright-report` (HTML report, overwritten on re-run, 14 days) and `test-results-<attempt>` (traces, screenshots, videos, 7 days). Download them from the run's **Artifacts** section, then open the report locally:

```bash
npx playwright show-report <extracted-folder>
```

Failed tests also appear as annotations on the pull request. CI uses one worker for stability and retries twice; set `PLAYWRIGHT_TEST_BASE_URL` to run the same suite against an external deployment (the local mock server is skipped).

On `master`, the HTML report is also published to GitHub Pages: <https://tbiernasz.github.io/playwright-sample/>. This requires **Settings → Pages → Source: GitHub Actions** to be set once in the repository.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port for the mock server | `3000` |
| `CI` | Set by CI runners; enables retries, one worker, and a 30s test timeout | _(unset)_ |
| `PLAYWRIGHT_TEST_BASE_URL` | Run against an external deployment instead of starting the local mock app | `http://localhost:3000` |

## Day-to-day AI workflow

Agents are subagents in opencode (`playwright-test-planner`, `playwright-test-generator`, `playwright-test-healer`), each backed by the Playwright Test MCP server.

1. **Plan** — `Use the playwright-test-planner agent to explore http://localhost:3000 and plan tests for the checkout flow`
   Produces a markdown plan in `specs/`. Review and edit it — it is the source of truth for generation.
2. **Generate** — `Use the playwright-test-generator agent to turn specs/<plan>.md into test files`
   The generator replays each scenario in a real browser and writes spec files into `tests/`.
3. **Run** — `npx playwright test`
4. **Heal** — `Use the playwright-test-healer agent, run the suite and fix any failures`
   The healer runs `test_run`/`test_debug`, fixes locators/assertions, and iterates until green.

Regenerate agent definitions after Playwright updates:

```bash
npx playwright init-agents --loop=opencode
```

## Useful commands

| Task | Command |
|------|---------|
| Run all tests | `npm test` |
| Run smoke tests only | `npm run test:smoke` |
| Run regression tests only | `npm run test:regression` |
| Re-run only failed tests | `npx playwright test --last-failed` |
| Show trace of a failure | `npx playwright show-trace <trace.zip>` |
| Tag filtering | add `@smoke` / `@regression` to test titles, run with `--grep` |
| CI sharding | `npx playwright test --shard=1/4` |
| Type-check | `npm run typecheck` |
| Lint tests | `npm run lint` |
| Format code | `npm run format` |

## Test tagging

Tests are tagged in their titles for selective execution:
- `@smoke` — fast core-path tests (dashboard loads, login works, logout works)
- `@regression` — deeper flow tests (full checkout, multi-item totals)

Run tagged subsets: `npx playwright test --grep @smoke`

## Key patterns (learned during the planner → generator → healer cycle)

1. **Project `storageState` applies to *every* context in the project — including manual ones.**
   The runner injects an instrumentation hook (`runBeforeCreateBrowserContext` in `@playwright/test`) that merges the project's `use` options (including `storageState`) into every `browser.newContext()` and `request.newContext()` call. A "fresh" `browser.newContext()` in an authenticated project is therefore *not* anonymous — it carries the stored cookies. **Fix:** give unauthenticated tests their own project with no `storageState` (`firefox-anon` here). Alternative: `await context.clearCookies()` right after creating the manual context.

2. **One `storageState` = one server-side session = shared state under `fullyParallel`.**
   If the app keeps per-session server state (e.g. a cart keyed by session id), every test in the project shares that state, and sibling tests corrupt each other mid-flow (a `beforeEach` cart-clear in test B empties test A's cart). **Fix:** mint a fresh session per test using a shared fixture (`tests/fixtures.ts`):
   ```ts
   import { test, expect } from '../fixtures';

   test('example', async ({ authenticatedPage: page }) => {
     // Each test gets its own fresh server session and empty cart.
   });
   ```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `EADDRINUSE: address already in use :::3000` | A previous server instance is still running. Kill it: `npx kill-port 3000` or `taskkill /F /IM node.exe` on Windows. |
| `browserType.launch: Executable doesn't exist` | Run `npx playwright install firefox` to download the browser. |
| Tests pass locally but fail in CI | Check that `CI=true` is set (GitHub Actions sets it automatically). The config enables retries, a single worker, and a 30s test timeout in CI. |
| Shared cart state between tests | Use `authenticatedPage` from `tests/fixtures.ts` to mint a fresh session per test. |

## Conventions

All AI-generated tests follow `AGENTS.md` (locator priority, web-first assertions, no `waitForTimeout`, one spec per user flow, `storageState` for auth).
