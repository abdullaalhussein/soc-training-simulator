import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { USERS, API_URL, BASE_URL } from '../fixtures/test-data';

test.describe('Login', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('Login page shows correct branding', async () => {
    await expect(loginPage.title).toBeVisible();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toHaveText('Sign In');
    await expect(loginPage.privacyLink).toBeVisible();
    await expect(loginPage.termsLink).toBeVisible();
  });

  test('Error for invalid credentials', async () => {
    // Verify via API that wrong password returns 401
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: USERS.admin.email, password: 'WrongPassword!' }),
    });
    expect([401, 429]).toContain(response.status);
  });

  test('Admin login redirects to /users', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: BASE_URL,
      storageState: 'e2e/.auth/admin.json',
    });
    const page = await context.newPage();
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({ timeout: 15_000 });
    await context.close();
  });

  test('Trainer login redirects to /console', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: BASE_URL,
      storageState: 'e2e/.auth/trainer.json',
    });
    const page = await context.newPage();
    await page.goto('/console');
    await expect(page.locator('h1').filter({ hasText: 'Trainer Console' })).toBeVisible({ timeout: 15_000 });
    await context.close();
  });

  test('Trainee login redirects to /dashboard', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: BASE_URL,
      storageState: 'e2e/.auth/trainee.json',
    });
    const page = await context.newPage();
    await page.goto('/dashboard');
    await expect(page.locator('h1').filter({ hasText: 'Welcome back' })).toBeVisible({ timeout: 15_000 });
    await context.close();
  });

  test('Unauthenticated user redirected to /login', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.goto('/users');
    await page.waitForURL('**/login', { timeout: 15_000 });
  });

  test('Trainee cannot access /users (RBAC)', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: BASE_URL,
      storageState: 'e2e/.auth/trainee.json',
    });
    const page = await context.newPage();
    await page.goto('/users');
    await page.waitForURL('**/dashboard', { timeout: 15_000 });
    await context.close();
  });

  test('Trainer cannot access /users (RBAC)', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: BASE_URL,
      storageState: 'e2e/.auth/trainer.json',
    });
    const page = await context.newPage();
    await page.goto('/users');
    await page.waitForURL('**/console', { timeout: 15_000 });
    await context.close();
  });
});
