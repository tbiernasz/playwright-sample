# Test Specifications

This directory contains **markdown test plans** produced by the Playwright planner agent.

## Workflow

1. **Planner agent** explores the running app via MCP and writes a detailed test plan here.
2. **Generator agent** reads the plan and writes Playwright spec files into `tests/`.
3. **Healer agent** runs the suite, finds failures, and patches the spec files.

## Files

| File | Description |
|------|-------------|
| `checkout.test.plan.md` | Full checkout flow: happy path, multi-item total, failed login, empty cart |

## Conventions

- Plans list every step with explicit locators and expected outcomes.
- Each scenario references a **seed file** (the starting test code the generator builds on).
- Locators follow `AGENTS.md` priority: `getByTestId` → `getByRole` → `getByLabel` → `getByText`.
