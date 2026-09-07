import { test, expect } from '@playwright/test';

// Prerequisites (see root README):
//  - FargateAuthStack deployed (real Cognito User Pool)
//  - A demo user created via admin-create-user / admin-set-user-password
//  - docker-compose Postgres + Spring Boot backend + `ng serve` all running
//  - DEMO_USER_EMAIL / DEMO_USER_PASSWORD set to that demo user's credentials
//
// This drives the REAL stack end-to-end: no mocked fetch/HttpClient, no fake
// JwtDecoder. It's slower and needs everything up, unlike a unit test.

const EMAIL = process.env['DEMO_USER_EMAIL'];
const PASSWORD = process.env['DEMO_USER_PASSWORD'];

test.beforeAll(() => {
  if (!EMAIL || !PASSWORD) {
    throw new Error('Set DEMO_USER_EMAIL and DEMO_USER_PASSWORD (see e2e/.env.example) before running these tests.');
  }
});

test.beforeEach(async ({ page }) => {
  // Each test already gets a fresh, storage-isolated browser context from
  // Playwright, so there's no leftover sessionStorage to clear. An
  // addInitScript here would re-clear it on every navigation within the
  // test too -- including when Cognito redirects back to /callback -- which
  // wipes the PKCE verifier the app just stored before leaving for Cognito.
  await page.context().clearCookies();
});

test('unauthenticated visitor is redirected from /items to /login', async ({ page }) => {
  await page.goto('/items');
  await expect(page).toHaveURL(/\/login$/);
});

test('logs in via the default custom form and sees the seeded items', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email').fill(EMAIL!);
  await page.getByLabel('Password').fill(PASSWORD!);
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page).toHaveURL(/\/items$/);
  await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible();
  await expect(page.getByText('Wireless Mouse', { exact: true })).toBeVisible();
});

test('logging out returns to the login page and re-guards /items', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL!);
  await page.getByLabel('Password').fill(PASSWORD!);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/items$/);

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/items');
  await expect(page).toHaveURL(/\/login$/);
});

test('logs in via the Cognito Hosted UI and converges on the same items list', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in with Hosted UI' }).click();

  // Now on Cognito's own hosted domain (classic Hosted UI field IDs).
  await expect(page).toHaveURL(/amazoncognito\.com/);
  // Cognito's hosted page renders both a desktop and mobile form (same IDs
  // on both, one hidden via CSS), so scope to the visible one rather than
  // assume a single match.
  await page.locator('#signInFormUsername:visible').fill(EMAIL!);
  await page.locator('#signInFormPassword:visible').fill(PASSWORD!);
  await page.locator('input[name="signInSubmitButton"]:visible').click();

  // Cognito redirects back to /callback, which exchanges the code and
  // forwards to /items -- same page, same data, as the default login path.
  await expect(page).toHaveURL(/\/items$/, { timeout: 15000 });
  await expect(page.getByText('Wireless Mouse', { exact: true })).toBeVisible();
});
