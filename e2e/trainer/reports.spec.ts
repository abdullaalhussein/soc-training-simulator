import { test, expect } from '@playwright/test';
import { TrainerReportsPage } from '../pages/trainer-reports.page';

test.describe('Reports', () => {
  let reportsPage: TrainerReportsPage;

  test.beforeEach(async ({ page }) => {
    reportsPage = new TrainerReportsPage(page);
    await reportsPage.goto();
    // If page didn't load (blank/redirect), retry once
    const isVisible = await reportsPage.heading.isVisible().catch(() => false);
    if (!isVisible) {
      await page.waitForTimeout(2000);
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
    }
    await expect(reportsPage.heading).toBeVisible({ timeout: 15_000 });
  });

  test('Display reports page', async ({ page }) => {
    await expect(reportsPage.heading).toHaveText('Reports & Analytics');
    // Session selector should be visible
    await expect(page.locator('text=Select a session').first()).toBeVisible();
  });

  test('Select session and show stats', async ({ page }) => {
    // Open session selector
    await page.locator('button').filter({ hasText: 'Select a session' }).click();

    const options = page.locator('[role="option"]');
    const optionCount = await options.count();
    if (optionCount === 0) {
      test.skip();
      return;
    }

    await options.first().click();
    await page.waitForTimeout(2000);

    // Stat cards should appear
    await expect(page.locator('text=Avg Score')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Highest')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();
    await expect(page.locator('text=Lowest')).toBeVisible();
  });

  test('Show leaderboard', async ({ page }) => {
    // Open session selector
    await page.locator('button').filter({ hasText: 'Select a session' }).click();

    const options = page.locator('[role="option"]');
    const optionCount = await options.count();
    if (optionCount === 0) {
      test.skip();
      return;
    }

    await options.first().click();
    await page.waitForTimeout(2000);

    // Leaderboard heading
    await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible({ timeout: 10_000 });

    // Table with expected columns
    const table = page.locator('table').last();
    await expect(table).toBeVisible();
    await expect(table.locator('th').filter({ hasText: 'Rank' })).toBeVisible();
    await expect(table.locator('th').filter({ hasText: 'Trainee' })).toBeVisible();
    await expect(table.locator('th').filter({ hasText: 'Total' })).toBeVisible();
  });
});
