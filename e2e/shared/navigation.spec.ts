import { test, expect } from '@playwright/test';
import { BASE_URL } from '../fixtures/test-data';

test.describe('Navigation', () => {
  test('Admin nav items', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('link', { name: 'Users' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Scenarios' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Console' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Reports' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Audit Log' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Settings' })).toBeVisible();

    await sidebar.getByRole('link', { name: 'Console' }).click();
    await page.waitForURL('**/console', { timeout: 10_000 });

    await sidebar.getByRole('link', { name: 'Reports' }).click();
    await page.waitForURL('**/reports', { timeout: 10_000 });

    await sidebar.getByRole('link', { name: 'Audit Log' }).click();
    await page.waitForURL('**/audit', { timeout: 10_000 });

    await sidebar.getByRole('link', { name: 'Settings' }).click();
    await page.waitForURL('**/settings', { timeout: 10_000 });
  });

  test('Trainer nav items', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: BASE_URL,
      storageState: 'e2e/.auth/trainer.json',
    });
    const page = await context.newPage();

    await page.goto('/console');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('link', { name: 'Console' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Scenarios' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Reports' })).toBeVisible();

    await sidebar.getByRole('link', { name: 'Scenarios' }).click();
    await page.waitForURL('**/scenario-guide', { timeout: 10_000 });

    await sidebar.getByRole('link', { name: 'Reports' }).click();
    await page.waitForURL('**/reports', { timeout: 10_000 });

    await context.close();
  });

  test('Trainee nav items', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: BASE_URL,
      storageState: 'e2e/.auth/trainee.json',
    });
    const page = await context.newPage();

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('link', { name: 'Dashboard' })).toBeVisible();

    await sidebar.getByRole('link', { name: 'Dashboard' }).click();
    await page.waitForURL('**/dashboard', { timeout: 10_000 });

    await context.close();
  });
});
