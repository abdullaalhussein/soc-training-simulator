import { test, expect } from '@playwright/test';
import { AdminScenariosPage } from '../pages/admin-scenarios.page';

test.describe('Scenario Management', () => {
  let scenariosPage: AdminScenariosPage;

  test.beforeEach(async ({ page }) => {
    scenariosPage = new AdminScenariosPage(page);
    await scenariosPage.goto();
    await expect(scenariosPage.heading).toBeVisible({ timeout: 15_000 });
  });

  test('Display seeded scenario cards', async ({ page }) => {
    // Wait for cards to load
    await expect(page.locator('.grid > div').first()).toBeVisible({ timeout: 10_000 });

    const cards = page.locator('.grid > div');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Check that the phishing scenario exists
    await expect(scenariosPage.getCardByName('Phishing to PowerShell Execution')).toBeVisible();

    // Check for difficulty badges
    await expect(page.locator('text=BEGINNER').first()).toBeVisible();

    // Check for stage/checkpoint info
    await expect(page.locator('text=/\\d+ stages/').first()).toBeVisible();
    await expect(page.locator('text=/\\d+ checkpoints/').first()).toBeVisible();
  });

  test('View scenario details', async ({ page }) => {
    await expect(page.locator('.grid > div').first()).toBeVisible({ timeout: 10_000 });

    const card = scenariosPage.getCardByName('Phishing to PowerShell Execution');
    await card.locator('h3, [class*="CardTitle"]').click();

    await page.waitForURL('**/scenarios/**', { timeout: 10_000 });
    await expect(page.locator('text=Phishing to PowerShell Execution')).toBeVisible();
  });

  test('Scenario dropdown actions', async ({ page }) => {
    await expect(page.locator('.grid > div').first()).toBeVisible({ timeout: 10_000 });

    const card = scenariosPage.getCardByName('Phishing to PowerShell Execution');
    const trigger = scenariosPage.getDropdownTrigger(card);
    await trigger.click();

    await expect(page.getByRole('menuitem', { name: 'View Details' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Export' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
  });

  test('Export a scenario', async ({ page }) => {
    await expect(page.locator('.grid > div').first()).toBeVisible({ timeout: 10_000 });

    const card = scenariosPage.getCardByName('Phishing to PowerShell Execution');
    const trigger = scenariosPage.getDropdownTrigger(card);
    await trigger.click();

    await page.getByRole('menuitem', { name: 'Export' }).click();
    await page.waitForTimeout(2000);
    // Verify no error toast appeared - export should succeed silently or show success toast
    const errorToast = page.locator('[data-type="error"]');
    await expect(errorToast).toHaveCount(0);
  });

  test('Open create scenario wizard', async ({ page }) => {
    await scenariosPage.createButton.click();
    await expect(scenariosPage.wizardDialog).toBeVisible();
    await expect(page.getByText('Create New Scenario')).toBeVisible();
  });
});
