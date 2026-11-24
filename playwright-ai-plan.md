# Playwright + AI Test Automation Plan

> [!NOTE]
> This was the original setup plan. The final implementation differs in some details
> (e.g. `.mcp.json` was dropped in favour of `opencode.json`).
> See README.md for the current state.

## Current State

- [x] llama.cpp running locally
- [x] Local LLM configured with opencode

---

## Step 1: Scaffold the Sample Playwright (TypeScript) Solution

Create a working Playwright project that serves as the base for everything else.

```bash
mkdir playwright-ai-demo && cd playwright-ai-demo
npm init -y
npm init @playwright/test@latest
```

### Project Structure

```
playwright-ai-demo/
├── tests/
│   ├── auth.setup.ts          # login fixture (storageState)
│   ├── smoke.spec.ts          # example smoke test
│   └── checkout.spec.ts       # example multi-step flow
├── playwright.config.ts
├── AGENTS.md                  # conventions for the AI agent
├── .mcp.json                  # MCP server config for opencode
├── package.json
└── tsconfig.json
```

### Key Files to Write

**`playwright.config.ts`**
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [['html'], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
```

**`tests/auth.setup.ts`** — storageState login fixture:
```ts
import { test as setup, expect } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Dashboard')).toBeVisible();
});
```

**`tests/smoke.spec.ts`** — example test using the auth fixture:
```ts
import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/.auth/user.json' });

test('loads dashboard', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});
```

### Verify It Works

```bash
npx playwright test
npx playwright show-report
```

---

## Step 2: Add Playwright MCP to opencode

### Option A: `.mcp.json` (project-level)

Create `.mcp.json` in the project root:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

### Option B: opencode config (`~/.config/opencode/config.json` or `opencode.json`)

```json
{
  "mcp": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

### Verify MCP is Connected

In opencode, ask:
> "List the available Playwright MCP tools"

You should see tools like `browser_navigate`, `browser_click`, `browser_type`, `browser_snapshot`, etc.

---

## Step 3: Write AGENTS.md (Conventions File)

This is what makes the agent produce consistent, high-quality code. Place it in the project root.

```markdown
# AGENTS.md — Playwright Test Conventions

## Locator Priority (strict order)
1. `page.getByTestId('...')` — if data-testid exists
2. `page.getByRole('button', { name: '...' })` — accessible role + name
3. `page.getByLabel('...')` — form fields
4. `page.getByText('...')` — last resort for static text
5. NEVER use raw CSS selectors or XPath unless absolutely no alternative

## Assertions
- Use web-first assertions ONLY: `await expect(locator).toHaveText(...)`, `.toBeVisible()`, etc.
- NEVER use `page.waitForTimeout()`
- NEVER use `expect(...).toBeTruthy()` for DOM state

## Structure
- Tests live in `tests/`
- One spec file per user flow / feature area
- Shared setup (auth) goes in `tests/auth.setup.ts` with `storageState`
- Reuse fixtures from `@playwright/test`, do not reinvent them

## Auth & Data
- Use `storageState` for authenticated sessions
- Seed test data via API calls in `test.beforeAll` or a dedicated fixture
- Clean up in `test.afterAll` where needed

## Naming
- Spec files: `<feature>.spec.ts`
- Test titles: descriptive sentences, e.g. `'user can add item to cart and see updated total'`

## Prohibited Patterns
- `page.waitForTimeout()`
- Raw CSS/XPath selectors (without justification in a comment)
- `page.evaluate()` for assertions
- Global state between tests
```

---

## Step 4: Initialize Playwright Test Agents

Playwright ships three built-in agents: **planner**, **generator**, and **healer**.

```bash
npx playwright init-agents --loop=opencode
```

This generates agent definition files (markdown) in your project that opencode will pick up. They define:

| Agent | Purpose |
|-------|---------|
| 🎭 planner | Explores the app via MCP, produces a Markdown test plan |
| 🎭 generator | Takes the plan and writes Playwright spec files |
| 🎭 healer | Runs the suite, identifies failures, patches the code |

### Usage in opencode

```
# Plan tests for the checkout flow
> Use the planner agent to explore http://localhost:3000 and plan tests for the checkout flow

# Generate tests from the plan
> Use the generator agent to turn plans/checkout-plan.md into test files

# Heal failing tests
> Use the healer agent — run the suite and fix any failures
```

### Regenerate After Playwright Updates

```bash
npx playwright init-agents --loop=opencode
```

---

## Step 5: Configure opencode for Local LLM + Code Mode

Ensure your opencode config points to your llama.cpp server:

```json
{
  "model": {
    "provider": "openai-compatible",
    "baseURL": "http://localhost:8080/v1",
    "model": "your-local-model-name"
  },
  "mcp": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

### Notes on Local LLM + MCP

- **Context window matters**: Playwright MCP `browser_snapshot` returns the full accessibility tree. On complex pages this can be 5–15k tokens. Make sure your model has at least 32k context (ideally 64k+).
- **Code mode / tool use**: Your local model must support function calling / tool use in the OpenAI-compatible format. llama.cpp supports this via `--jinja` flag with a chat template that includes tool definitions.
- **If tool calling is unreliable** on your local model, fall back to prompting the agent to interpret MCP tool results as text and write code based on those observations (less reliable but works).

### Recommended llama.cpp Flags

```bash
llama-server \
  -m your-model.gguf \
  --port 8080 \
  --ctx-size 65536 \
  --jinja \
  --parallel 2
```

---

## Step 6: Workflow (Day-to-Day)

### Writing New Tests

1. Start your app: `npm run dev` (or however it runs locally)
2. In opencode, invoke the **planner** agent:
   > "Plan tests for the user registration flow on http://localhost:3000"
3. Review the generated Markdown plan — edit if needed
4. Invoke the **generator** agent:
   > "Generate Playwright tests from plans/registration-plan.md"
5. Run: `npx playwright test`
6. If failures, invoke the **healer** agent:
   > "Heal the failing tests in tests/registration.spec.ts"

### Adding a New Feature to Coverage

1. Update AGENTS.md if new conventions apply
2. Ask planner to explore the new feature area
3. Generator → Healer loop as above

### CI Integration

```yaml
# .github/workflows/playwright.yml (or equivalent)
- run: npx playwright install --with-deps
- run: npx playwright test --grep @smoke --workers=4
- uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: playwright-report
    path: playwright-report/
```

---

## Step 7: Optional Enhancements

| Enhancement | How |
|-------------|-----|
| Video on all failures | Already in config (`video: 'retain-on-failure'`) |
| Trace viewer for debugging | `npx playwright show-trace trace.zip` |
| Re-run only failed | `npx playwright test --last-failed` |
| Tag-based filtering | Add `@smoke`, `@regression` tags in test titles, use `--grep` |
| Parallel sharding in CI | `npx playwright test --shard=1/4` per worker |
| Custom MCP tools | Extend with a local MCP server that wraps your app's API for data setup |

---

## Checklist

- [x] Playwright project scaffolded and tests pass locally (7/7 passing)
- [x] MCP connected in opencode (via project `opencode.json` — the standalone `.mcp.json` was dropped because it duplicated the MCP server and blocked the session)
- [x] `AGENTS.md` written with conventions
- [x] `npx playwright init-agents --loop=opencode` run
- [x] opencode config points to llama.cpp with tool-use enabled
- [x] Full planner → generator → healer cycle tested end-to-end (healer fixed 2 failures: storageState leaking into manual contexts, shared sid/cart under `fullyParallel`)
- [x] CI pipeline wired up (`.github/workflows/playwright.yml`, triggers on push to `master`)
