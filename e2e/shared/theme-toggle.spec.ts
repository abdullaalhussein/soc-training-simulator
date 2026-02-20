import { test, expect } from '@playwright/test';
import { BASE_URL } from '../fixtures/test-data';

test.describe('Theme Toggle', () => {
  test('Toggle dark mode for admin', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const themeButton = page.getByRole('button', { name: 'Toggle theme' });
    await expect(themeButton).toBeVisible({ timeout: 10_000 });

    const initialDark = await page.locator('html').evaluate(el => el.classList.contains('dark'));

    await themeButton.click();
    await page.waitForTimeout(500);

    const afterToggle = await page.locator('html').evaluate(el => el.classList.contains('dark'));
    expect(afterToggle).not.toBe(initialDark);

    await themeButton.click();
    await page.waitForTimeout(500);

    const afterRevert = await page.locator('html').evaluate(el => el.classList.contains('dark'));
    expect(afterRevert).toBe(initialDark);
  });

  test('Toggle dark mode for trainer', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: BASE_URL,
      storageState: 'e2e/.auth/trainer.json',
    });
    const page = await context.newPage();

    await page.goto('/console');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const themeButton = page.getByRole('button', { name: 'Toggle theme' });
    await expect(themeButton).toBeVisible({ timeout: 10_000 });

    const initialDark = await page.locator('html').evaluate(el => el.classList.contains('dark'));
    await themeButton.click();
    await page.waitForTimeout(500);

    const afterToggle = await page.locator('html').evaluate(el => el.classList.contains('dark'));
    expect(afterToggle).not.toBe(initialDark);

    await context.close();
  });

  test('Toggle dark mode for trainee', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: BASE_URL,
      storageState: 'e2e/.auth/trainee.json',
    });
    const page = await context.newPage();

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const themeButton = page.getByRole('button', { name: 'Toggle theme' });
    await expect(themeButton).toBeVisible({ timeout: 10_000 });

    const initialDark = await page.locator('html').evaluate(el => el.classList.contains('dark'));
    await themeButton.click();
    await page.waitForTimeout(500);

    const afterToggle = await page.locator('html').evaluate(el => el.classList.contains('dark'));
    expect(afterToggle).not.toBe(initialDark);

    await context.close();
  });
});
