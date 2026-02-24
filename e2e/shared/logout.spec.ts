import { test, expect } from '@playwright/test';
import { BASE_URL } from '../fixtures/test-data';

test.describe('Logout', () => {
  test('Logout admin', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Open avatar dropdown
    const avatarButton = page.locator('header button.rounded-full');
    await expect(avatarButton).toBeVisible({ timeout: 10_000 });
    await avatarButton.click();

    // Click Log out
    await page.getByRole('menuitem', { name: 'Log out' }).click();

    // Should redirect to /login — wait for login page to fully render
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10_000 });

    // Cannot access /users anymore — use evaluate to avoid Firefox NS_BINDING_ABORTED
    await page.evaluate((url) => { window.location.href = url; }, '/users');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('Logout trainer', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: BASE_URL,
      storageState: 'e2e/.auth/trainer.json',
    });
    const page = await context.newPage();

    await page.goto('/console');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const avatarButton = page.locator('header button.rounded-full');
    await expect(avatarButton).toBeVisible({ timeout: 10_000 });
    await avatarButton.click();

    await page.getByRole('menuitem', { name: 'Log out' }).click();

    // The app uses window.location.href for logout redirect, wait for it
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10_000 });

    await page.evaluate((url) => { window.location.href = url; }, '/console');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

    await context.close();
  });

  test('Logout trainee', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: BASE_URL,
      storageState: 'e2e/.auth/trainee.json',
    });
    const page = await context.newPage();

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const avatarButton = page.locator('header button.rounded-full');
    await expect(avatarButton).toBeVisible({ timeout: 10_000 });
    await avatarButton.click();

    await page.getByRole('menuitem', { name: 'Log out' }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10_000 });

    await page.evaluate((url) => { window.location.href = url; }, '/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

    await context.close();
  });
});
