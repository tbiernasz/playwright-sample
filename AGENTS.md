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
