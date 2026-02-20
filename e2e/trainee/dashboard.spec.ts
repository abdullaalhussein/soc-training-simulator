import { test, expect } from '@playwright/test';
import { TraineeDashboardPage } from '../pages/trainee-dashboard.page';

test.describe('Trainee Dashboard', () => {
  let dashboardPage: TraineeDashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new TraineeDashboardPage(page);
    await dashboardPage.goto();
    await expect(dashboardPage.welcomeHeading).toBeVisible({ timeout: 15_000 });
  });

  test('Welcome message', async ({ page }) => {
    // Should contain "Welcome back" with the trainee's first name
    const heading = page.locator('h1');
    await expect(heading).toContainText('Welcome back');
  });

  test('Stats cards', async ({ page }) => {
    // Assigned Sessions card
    await expect(page.locator('text=Assigned Sessions')).toBeVisible();
    // Completed card
    await expect(page.locator('p').filter({ hasText: /^Completed$/ })).toBeVisible();
    // Avg Score card
    await expect(page.locator('text=Avg Score')).toBeVisible();

    // Each should have a numeric value
    const statValues = page.locator('.text-2xl.font-bold');
    const count = await statValues.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('Session cards', async ({ page }) => {
    // Wait for sessions to load
    await page.waitForTimeout(2000);

    const sessionCards = page.locator('.grid > div').filter({ has: page.getByRole('button') });
    const count = await sessionCards.count();

    if (count > 0) {
      const firstCard = sessionCards.first();

      // Check for difficulty badge
      await expect(
        firstCard.locator('text=BEGINNER')
          .or(firstCard.locator('text=INTERMEDIATE'))
          .or(firstCard.locator('text=ADVANCED'))
      ).toBeVisible();

      // Check for scenario name (inside card title)
      await expect(firstCard.locator('h3, [class*="CardTitle"]')).toBeVisible();

      // Check for status badge
      await expect(
        firstCard.locator('text=Ready to Investigate')
          .or(firstCard.locator('text=Investigating'))
          .or(firstCard.locator('text=Completed'))
          .or(firstCard.locator('text=Timed Out'))
      ).toBeVisible();

      // Check for action button
      await expect(
        firstCard.getByRole('button', { name: /Start Investigation|Continue Investigation|View Results/ })
      ).toBeVisible();
    }
  });
});
