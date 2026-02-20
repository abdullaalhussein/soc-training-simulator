import { test, expect } from '@playwright/test';

test.describe('Scenario Guide', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/scenario-guide');
    await expect(page.getByRole('heading', { name: 'Scenarios' })).toBeVisible({ timeout: 15_000 });
  });

  test('Display scenario cards', async ({ page }) => {
    // Wait for cards to load
    await expect(page.locator('.grid > div').first()).toBeVisible({ timeout: 10_000 });

    const cards = page.locator('.grid > div');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Check for difficulty badge (use .first() to avoid strict mode violation)
    await expect(
      page.locator('text=BEGINNER')
        .or(page.locator('text=INTERMEDIATE'))
        .or(page.locator('text=ADVANCED'))
        .first()
    ).toBeVisible();

    // Check for stages info
    await expect(page.locator('text=/\\d+ stages/').first()).toBeVisible();

    // Check for time estimate
    await expect(page.locator('text=/\\d+ min estimated/').first()).toBeVisible();
  });

  test('Navigate to scenario detail', async ({ page }) => {
    await expect(page.locator('.grid > div').first()).toBeVisible({ timeout: 10_000 });

    // Click on the first card's title to navigate
    const firstCardTitle = page.locator('.grid > div').first().locator('h3, h2').first();
    await firstCardTitle.click();

    // Wait for URL to change to scenario detail page
    await expect(page).toHaveURL(/\/scenario-guide\//, { timeout: 10_000 });

    // Detail page should load with a "Back to Scenarios" button
    await expect(page.getByRole('button', { name: 'Back to Scenarios' })).toBeVisible({ timeout: 10_000 });
  });
});
