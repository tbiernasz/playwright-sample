# Checkout Flow Test Plan

> **Note:** This plan was the initial planner output. The suite has since expanded to cover cart quantities, clearing, and request-level API tests; the specs under `tests/` are authoritative.

## Application Overview

Mock shop web app served at http://localhost:3000 (app/server.js). A single-user store where unauthenticated visitors are redirected to /login. Valid credentials: test@example.com / password123 (form fields labelled 'Email' and 'Password', submit button 'Sign in'). After sign-in the user lands on the Dashboard, which lists two products (Coffee Mug $10.00, Logo T-Shirt $20.00) each with an 'Add to cart' button and a confirmation flash, plus a 'Cart' nav link with a live count. The cart supports quantity changes, line removal, and clearing; `/api/products` and `/api/cart` expose the catalog and session cart for request-level tests. The checkout flow is: Dashboard -> Add to cart -> Cart -> Proceed to checkout -> Checkout (order summary + total) -> Place order -> Order confirmed. This plan focuses on the checkout flow area and covers: (1) the happy-path checkout, (2) multi-item total calculation, (3) a negative login case (wrong password), and (4) the empty-cart state on first visit. Authenticated suites rely on the storageState produced by tests/auth.setup.ts; the login suite runs in a fresh, unauthenticated browser context. Each scenario assumes a fresh browser state; server-side cart state is keyed per session (cookie 'sid') and is isolated per Playwright test context.

## Test Environment

| Aspect | Detail |
|--------|--------|
| App URL | `http://localhost:3000` (started via `node app/server.js`; auto-started by the Playwright `webServer` in `playwright.config.ts`) |
| Backend | Zero-dependency Node HTTP server (`app/server.js`), server-rendered HTML |
| Session | Server-side; identity carried by an HttpOnly `sid` cookie. Carts are stored in memory, keyed by session. |
| Framework | Playwright + `@playwright/test` (TypeScript) |
| Run | `npx playwright test` |
| Auth | `storageState` saved to `tests/.auth/user.json` by `tests/auth.setup.ts` (the `setup` project). Authenticated suites depend on it. |

## Key Elements & Locators

Prefer `getByTestId`, then `getByRole` / `getByLabel`, then `getByText` (per `AGENTS.md`). Use web-first assertions only.

| Page | Element | Preferred locator | `data-testid` |
|------|---------|-------------------|---------------|
| `/login` | Email input | `getByLabel('Email')` | `email-input` |
| `/login` | Password input | `getByLabel('Password')` | `password-input` |
| `/login` | Sign in button | `getByRole('button', { name: 'Sign in' })` | `sign-in` |
| `/login` | Error message | `getByTestId('login-error')` | `login-error` |
| `/` (Dashboard) | Page heading | `getByRole('heading', { name: 'Dashboard' })` | — |
| `/` (Dashboard) | Product item | `getByTestId('product-item')` | `product-item` |
| `/` (Dashboard) | Add to cart | `getByTestId('add-to-cart')` | `add-to-cart` |
| `/` (Dashboard) | Add confirmation | `getByTestId('flash')` | `flash` |
| `/` (Dashboard) | Cart nav link | `getByRole('link', { name: /Cart/ })` | `cart-link` |
| `/` (Dashboard) | Cart badge | `getByTestId('cart-count')` | `cart-count` |
| `/cart` | Page heading | `getByRole('heading', { name: 'Cart', exact: true })` | — |
| `/cart` | Empty message | `getByTestId('cart-empty')` | `cart-empty` |
| `/cart` | Cart line | `getByTestId('cart-item')` | `cart-item` |
| `/cart` | Quantity | `getByTestId('item-quantity')` | `item-quantity` |
| `/cart` | Line total | `getByTestId('line-total')` | `line-total` |
| `/cart` | Quantity controls | `getByTestId('increase-quantity')` / `decrease-quantity` | `increase-quantity` / `decrease-quantity` |
| `/cart` | Remove / clear | `getByTestId('remove-item')` / `clear-cart` | `remove-item` / `clear-cart` |
| `/cart` | Proceed to checkout | `getByRole('button', { name: 'Proceed to checkout' })` | `proceed-to-checkout` |
| `/checkout` | Page heading | `getByRole('heading', { name: 'Checkout' })` | — |
| `/checkout` | Total | `getByTestId('checkout-total')` | `checkout-total` |
| `/checkout` | Place order (opens confirm modal) | `getByTestId('place-order')` | `place-order` |
| `/checkout` | Confirm order modal | `getByTestId('confirm-order-modal')` | `confirm-order-modal` |
| `/checkout` | Confirm modal total | `getByTestId('confirm-order-total')` | `confirm-order-total` |
| `/checkout` | Confirm submit | `getByTestId('confirm-order')` | `confirm-order` |
| `/checkout` | Cancel order | `getByTestId('cancel-order')` | `cancel-order` |
| Confirmation | Page heading | `getByRole('heading', { name: 'Order confirmed' })` | — |
| Confirmation | Thank-you message | `getByTestId('order-confirmation')` | `order-confirmation` |
| Confirmation | Order number | `getByTestId('order-number')` | `order-number` |

Note: cart lines show the product name, quantity, and a separate line total. Checkout items render as `Coffee Mug × 1`, with the price in a separate element.

## Test Scenarios

### 1. Checkout Flow

**Seed:** `tests/auth.setup.ts`

#### 1.1. user can add an item to the cart and complete checkout

**File:** `tests/e2e/checkout.spec.ts`

**Steps:**
  1. Navigate to the dashboard (GET /). Precondition: authenticated session (storageState from tests/auth.setup.ts) with an empty cart.
    - expect: The 'Dashboard' heading (level 1) is visible
    - expect: The product list shows 'Coffee Mug — $10.00' and 'Logo T-Shirt — $20.00'
    - expect: A 'Cart' navigation link (data-testid=cart-link) is present
  2. Click the 'Add to cart' button (data-testid=add-to-cart) inside the product item (data-testid=product-item) that contains 'Coffee Mug'.
    - expect: The browser is redirected back to the dashboard and the flash (data-testid=flash) reads 'Coffee Mug added to your cart.'
  3. Click the 'Cart' navigation link (data-testid=cart-link) (or navigate to /cart).
    - expect: The 'Cart' heading (level 1) is visible
    - expect: A cart line (data-testid=cart-item) for 'Coffee Mug' shows quantity 1 (data-testid=item-quantity) and a line total of $10.00 (data-testid=line-total)
    - expect: The 'Proceed to checkout' button (data-testid=proceed-to-checkout) is visible
  4. Click the 'Proceed to checkout' button (data-testid=proceed-to-checkout).
    - expect: The 'Checkout' heading (level 1) is visible
    - expect: The order summary lists 'Coffee Mug × 1' with a price of $10.00
    - expect: The total (data-testid=checkout-total) reads 'Total: $10.00'
    - expect: The 'Place order' button (data-testid=place-order) is visible
  5. Click the 'Place order' link (data-testid=place-order).
    - expect: The confirmation modal (data-testid=confirm-order-modal) is visible with the 'Confirm your order' heading
    - expect: The modal total (data-testid=confirm-order-total) reads '$10.00'
  6. Click 'Place order' inside the modal (data-testid=confirm-order).
    - expect: The 'Order confirmed' heading (level 1) is visible
    - expect: The confirmation message (data-testid=order-confirmation) reads 'Thank you for your purchase!'
    - expect: An order number (data-testid=order-number) matching `#\d+` is displayed
    - expect: A 'Back to dashboard' link is present
    - expect: The cart is now empty (visiting /cart again shows 'Your cart is empty.')

#### 1.2. checkout total reflects the sum of multiple cart items

**File:** `tests/e2e/checkout.spec.ts`

**Steps:**
  1. Navigate to the dashboard (GET /). Precondition: authenticated session with an empty cart.
    - expect: The 'Dashboard' heading (level 1) is visible
  2. Click 'Add to cart' (data-testid=add-to-cart) for the 'Coffee Mug' product, then click 'Add to cart' for the 'Logo T-Shirt' product.
    - expect: After each add, the browser returns to the dashboard and the flash confirms the product was added
  3. Navigate to /cart.
    - expect: The 'Cart' heading is visible
    - expect: Two cart lines are shown, with line totals of $10.00 and $20.00
  4. Click the 'Proceed to checkout' button (data-testid=proceed-to-checkout).
    - expect: The 'Checkout' heading is visible
    - expect: Both items are listed in the order summary
    - expect: The total (data-testid=checkout-total) reads 'Total: $30.00' (10 + 20)
  5. Click the 'Place order' link (data-testid=place-order); the confirmation modal (data-testid=confirm-order-modal) opens with the total (data-testid=confirm-order-total) reading '$30.00'.
    - expect: The modal total matches the summary total
  6. Click 'Place order' inside the modal (data-testid=confirm-order).
    - expect: The 'Order confirmed' heading is visible
    - expect: The 'Thank you for your purchase!' message is displayed

### 2. Login

**Seed:** `firefox-anon` project (no `storageState`)

#### 2.1. login with a wrong password shows an error and does not log in

**File:** `tests/e2e/login.spec.ts`

**Steps:**
  1. Open a fresh, unauthenticated browser context (no stored storageState, e.g. browser.newContext() without storageState) and navigate to /login.
    - expect: The 'Sign in' heading (level 1) is visible
    - expect: An 'Email' field (data-testid=email-input), a 'Password' field (data-testid=password-input), and a 'Sign in' button (data-testid=sign-in) are present
    - expect: No login error message is shown initially
  2. Type 'test@example.com' into the 'Email' field (data-testid=email-input).
  3. Type an incorrect password, e.g. 'wrongpassword', into the 'Password' field (data-testid=password-input).
  4. Click the 'Sign in' button (data-testid=sign-in).
    - expect: The error message 'Invalid email or password.' (data-testid=login-error) is displayed
    - expect: The page remains on /login — the 'Dashboard' heading is NOT visible
    - expect: The user is NOT logged in (no session established)

### 3. Cart State

**Seed:** `tests/auth.setup.ts`

#### 3.1. first visit to the cart shows an empty state

**File:** `tests/e2e/cart.spec.ts`

**Steps:**
  1. Navigate to /cart directly, without adding any items. Precondition: a fresh authenticated session with an empty cart (nothing has been added this session).
    - expect: The 'Cart' heading (level 1) is visible
    - expect: The empty message (data-testid=cart-empty) reads 'Your cart is empty.'
    - expect: The 'Proceed to checkout' button (data-testid=proceed-to-checkout) is NOT visible
    - expect: A 'Back to products' link (data-testid=back-link) is present

### 4. Additional coverage (implemented)

The suite also covers:

- `tests/e2e/cart.spec.ts`: duplicate adds merge into one line, quantity increase/decrease updates totals and removes at zero, and clearing (with confirmation) empties everything. Cancelling the clear-cart dialog keeps all items.
- `tests/e2e/checkout.spec.ts`: cancelling the order confirmation modal keeps the cart intact (no order placed, no navigation).
- `tests/api/shop-api.spec.ts`: catalog JSON, login/logout, session cart add/update/remove/clear, checkout, auth redirects, and 405 handling.

## Assumptions & Notes

- **Fresh state per scenario:** Each scenario assumes a blank/fresh browser state. Playwright isolates every test in its own browser context, and the server keys the cart by the `sid` session cookie, so cart state is independent across tests — scenarios can be run in any order.
- **Authenticated suites:** The *Checkout Flow* and *Cart State* suites reuse the `storageState` from `tests/auth.setup.ts` (a new session is created per run, so the cart starts empty).
- **Login suite is unauthenticated:** The *Login* suite must run in a fresh, unauthenticated context (e.g. `browser.newContext()` with no `storageState`). This is required because the default `firefox` project in `playwright.config.ts` applies the stored auth state, which would otherwise redirect `/login` straight to the dashboard.
- **Add-to-cart is a form POST:** Clicking "Add to cart" posts to `/cart/add`, redirects to `/?added=<id>`, and shows a status flash; the cart is not updated client-side, so assert on the cart page after navigating to it. Adding the same product twice merges the lines and increments the quantity.
- **Checkout clears the cart:** Placing an order empties the cart server-side. Visiting `/cart` afterwards shows the empty state.
- **Assertions:** Use web-first assertions only (`toBeVisible()`, `toHaveText()`, `not.toBeVisible()`). Do not use `page.waitForTimeout()`, raw CSS/XPath without justification, or `page.evaluate()` for assertions (see `AGENTS.md`).

### Success / Failure Criteria

- **Happy path (1.1):** PASS when the `Order confirmed` heading and `Thank you for your purchase!` message appear after placing the order; FAIL if any heading/total/button is missing or the flow stalls on an earlier page.
- **Multi-item total (1.2):** PASS when the checkout total reads exactly `Total: $30.00` and the order confirms; FAIL if the total is anything else (verifies the sum, not just a single item).
- **Negative login (2.1):** PASS when `Invalid email or password.` is shown and the user stays on `/login`; FAIL if the user is redirected to the dashboard or the error message is absent.
- **Empty cart (3.1):** PASS when `Your cart is empty.` is shown and the `Proceed to checkout` button is absent; FAIL if a checkout button appears for an empty cart.
