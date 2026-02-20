import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test('Display system info', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 15_000 });

    await expect(page.locator('text=1.0.0')).toBeVisible();
    await expect(page.locator('text=Development')).toBeVisible();
    await expect(page.locator('text=PostgreSQL 16')).toBeVisible();
    await expect(page.locator('text=Password123!')).toBeVisible();
  });
});
