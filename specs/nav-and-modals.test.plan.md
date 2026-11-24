# Navbar & Modals Test Plan

## Application Overview

The mock shop (`app/server.js`) is 100% server-rendered with zero client-side JavaScript, so two interaction patterns are built from plain HTML/CSS:

- **Responsive navbar (checkbox-hack):** An `<input type="checkbox" id="nav-toggle">` plus a `<label for="nav-toggle">` "hamburger" button sit in the `<nav>` before the `.nav-links` container. At `max-width: 720px` the link row is hidden and the label is shown; checking the box reveals `.nav-links` as an absolute-positioned dropdown panel (`.nav-toggle:checked ~ .nav-links { display: flex }`). The label icon animates from three bars (☰) to a cross (✕) when checked. On wide viewports the toggle and label are hidden and the links render inline as before. Navigation to another page resets the checkbox, so the menu is always closed on arrival.
- **`:target` modals:** A `.modal` element is `display: none` until its `id` matches the URL fragment (`.modal:target { display: flex }`). Opening links use `href="#<modal-id>"`; close/cancel links use `href="#"`, which clears the fragment via same-document navigation (no reload, no page change). Three modals exist:
  - `#product-mug` / `#product-tee` — product details on the Dashboard, opened from each card's "Details" link.
  - `#confirm-clear` — "Clear your cart?" dialog on `/cart`, opened from the "Clear cart" link.
  - `#confirm-order` — "Confirm your order" dialog on `/checkout`, opened from the "Place order" link.

Both destructive actions ("Clear cart", "Place order") are now two-step: a link opens the dialog, and only the form button inside the dialog (`/cart/clear`, `/checkout`) performs the action.

## Test Environment

| Aspect | Detail |
|--------|--------|
| App URL | `http://localhost:3000` (started via `node app/server.js`; auto-started by the Playwright `webServer` in `playwright.config.ts`) |
| Backend | Zero-dependency Node HTTP server (`app/server.js`), server-rendered HTML, no client JS |
| Framework | Playwright + `@playwright/test` (TypeScript) |
| Browser / viewport | Firefox (desktop project); wide = default `1280×720`, narrow = `page.setViewportSize({ width: 420, height: 900 })` |
| Auth | `authenticatedPage` fixture (fresh session per test) from `tests/fixtures.ts` |
| Run | `npx playwright test` |

## Key Elements & Locators

Prefer `getByTestId`, then `getByRole` / `getByLabel`, then `getByText` (per `AGENTS.md`). Use web-first assertions only.

| Page | Element | `data-testid` |
|------|---------|---------------|
| Any (authed) | Hamburger button (label) | `nav-toggle` |
| Any (authed) | Nav link container | `nav-links` |
| `/` (Dashboard) | "Details" link (per card) | `product-details` |
| `/` (Dashboard) | Product details modal (per product) | `product-modal-mug` / `product-modal-tee` |
| Modal | Close (✕) — always scope through the modal container | `modal-close` |
| Product modal | Add to cart inside modal | `modal-add-to-cart` |
| `/cart` | "Clear cart" link (opens dialog) | `clear-cart` |
| `/cart` | Clear-cart confirmation dialog | `clear-cart-modal` |
| `/cart` | Confirm clear (form → `/cart/clear`) | `confirm-clear` |
| `/cart` | Cancel clear | `cancel-clear` |
| `/checkout` | "Place order" link (opens dialog) | `place-order` |
| `/checkout` | Order confirmation dialog | `confirm-order-modal` |
| `/checkout` | Total inside dialog | `confirm-order-total` |
| `/checkout` | Confirm order (form → `/checkout`) | `confirm-order` |
| `/checkout` | Cancel order | `cancel-order` |

Note: `modal-close`, `modal-add-to-cart`, `confirm-*` and `cancel-*` live inside a modal; always scope them through the modal container locator (e.g. `page.getByTestId('clear-cart-modal').getByTestId('cancel-clear')`) to keep strict mode satisfied.

## Test Scenarios

**Seed:** `tests/auth.setup.ts`

### 1. Responsive navbar — `tests/e2e/navbar.spec.ts`

#### 1.1. wide viewport shows the pill navigation and hides the hamburger

1. Navigate to `/` (default 1280×720 viewport).
   - expect: `nav-toggle` is NOT visible
   - expect: `nav-links` and all three links (`home-link`, `cart-link`, `logout-link`) are visible

#### 1.2. narrow viewport hides the links behind the hamburger menu

1. Set viewport to 420×900 and navigate to `/`.
   - expect: `nav-toggle` is visible
   - expect: `nav-links` is hidden, and `home-link` / `cart-link` / `logout-link` are NOT visible

#### 1.3. narrow viewport hamburger opens and closes the menu

1. Set viewport to 420×900 and navigate to `/`.
   - expect: `nav-links` is hidden
2. Click `nav-toggle`.
   - expect: `nav-links` is visible with all three links visible
3. Click `nav-toggle` again.
   - expect: `nav-links` is hidden again

#### 1.4. narrow viewport navigation through the open menu lands on the page with the menu closed

1. Set viewport to 420×900 and navigate to `/`.
2. Click `nav-toggle`, then click `cart-link`.
   - expect: URL is `/cart` and the 'Cart' heading is visible
   - expect: `nav-toggle` is visible and `nav-links` is hidden (navigation reset the checkbox-hack)

### 2. Product details modals — `tests/e2e/modals.spec.ts`

#### 2.1. opening product details shows the full description, price and add control

1. Navigate to `/`.
2. Click the "Details" link (`product-details`) inside the Coffee Mug card.
   - expect: `product-modal-mug` is visible
   - expect: The modal contains the 'Coffee Mug' heading, the description 'A heavyweight ceramic mug for long debugging sessions.', the price '$10.00', and the `modal-add-to-cart` control

#### 2.2. closing the product details modal returns to the dashboard

1. Navigate to `/` and open the Coffee Mug modal.
   - expect: `product-modal-mug` is visible
2. Click `modal-close` (scoped to the modal).
   - expect: `product-modal-mug` is hidden
   - expect: The 'Dashboard' heading is still visible (no navigation occurred)

#### 2.3. the second product opens its own modal

1. Navigate to `/` and click "Details" on the Logo T-Shirt card.
   - expect: `product-modal-tee` is visible with the 'Logo T-Shirt' heading, its description, and '$20.00'
   - expect: `product-modal-mug` is hidden (modals are independent)

#### 2.4. adding from the product modal updates the cart and closes the modal

1. Navigate to `/` and open the Logo T-Shirt modal.
2. Click `modal-add-to-cart` (scoped to the modal).
   - expect: The flash reads 'Logo T-Shirt added to your cart.' (PRG back to the dashboard)
   - expect: `cart-count` reads '1'
   - expect: `product-modal-tee` is hidden (the dialog cannot survive the redirect)

### 3. Destructive-action confirmations

Covered in `tests/e2e/cart.spec.ts` and `tests/e2e/checkout.spec.ts`:

- **Clear cart (cart.spec.ts):** "Clear cart" opens `clear-cart-modal` showing the item count; confirming empties the cart; cancelling (via `cancel-clear`) stays on `/cart` with every item intact.
- **Place order (checkout.spec.ts):** "Place order" opens `confirm-order-modal` whose `confirm-order-total` matches the summary; confirming places the order; cancelling (via `cancel-order`) stays on `/checkout` with the cart unchanged.

## Assumptions & Notes

- **Zero-JS constraint:** No client script exists, so the checkbox-hack and `:target` are the interaction layer. The `href="#"` close links work via same-document fragment navigation in all supported engines (verified on Firefox, the default project browser).
- **Checkbox reset on navigation:** The menu cannot be "stuck open" across pages — every full navigation renders a fresh unchecked checkbox.
- **Strict mode:** Modal-scoped testids (`modal-close` etc.) appear once per page only inside their own modal, but specs scope through the container locator anyway to stay robust if more modals are added.
- **Viewport:** The 720px breakpoint means 420px is comfortably in mobile mode and 1280px in desktop mode; tests never rely on values between them.
- **Assertions:** Web-first only; no `page.waitForTimeout()`, no raw CSS/XPath without justification, no `page.evaluate()` for assertions (see `AGENTS.md`).

### Success / Failure Criteria

- **Navbar (1.1–1.4):** PASS when desktop shows inline links with no hamburger, and mobile hides links until the toggle is pressed, shows them while checked, hides them again, and starts closed after a navigation. FAIL on any visible/hidden inversion or a menu that stays open after navigation.
- **Product modals (2.1–2.4):** PASS when each card's Details link opens only its own modal with correct name/description/price, the close link dismisses it without navigating, and adding from the modal produces the flash, bumps the badge, and closes the modal. FAIL on cross-modal leakage, missing content, or a modal surviving the PRG redirect.
- **Confirmations (3):** PASS when neither destructive action fires before confirmation, and cancelling always leaves state and URL unchanged.
