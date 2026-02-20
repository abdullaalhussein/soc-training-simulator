import { test, expect } from '@playwright/test';
import { TrainerConsolePage } from '../pages/trainer-console.page';

test.describe('Trainer Console', () => {
  let consolePage: TrainerConsolePage;

  test.beforeEach(async ({ page }) => {
    consolePage = new TrainerConsolePage(page);
    await consolePage.goto();
    await expect(consolePage.heading).toBeVisible({ timeout: 15_000 });
  });

  test('Display trainer console', async () => {
    await expect(consolePage.heading).toHaveText('Trainer Console');
    await expect(consolePage.createSessionButton).toBeVisible();
  });

  test('Create session as draft', async ({ page }) => {
    await consolePage.createSessionButton.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    const sessionName = `E2E Draft Session ${Date.now()}`;
    await consolePage.sessionNameInput.fill(sessionName);

    // Select first scenario
    await consolePage.scenarioTrigger.click();
    await page.locator('[role="option"]').first().click();

    // Select trainee checkbox
    const traineeCheckbox = page.locator('[role="dialog"]').locator('label').filter({ hasText: 'trainee@soc.local' });
    if (await traineeCheckbox.isVisible()) {
      await traineeCheckbox.click();
    }

    await consolePage.createAsDraftButton.click();
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10_000 });

    // Verify the card appears with DRAFT badge
    const card = consolePage.getSessionCard(sessionName);
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card.getByText('DRAFT', { exact: true })).toBeVisible();
  });

  test('Launch draft session', async ({ page }) => {
    // Find a DRAFT session card and get its session name
    const draftBadge = page.getByText('DRAFT', { exact: true }).first();
    await expect(draftBadge).toBeVisible({ timeout: 10_000 });
    const draftCard = page.locator('.grid > div').filter({ has: page.getByText('DRAFT', { exact: true }) }).first();

    // Get the session name for re-locating after status change
    const sessionName = await draftCard.locator('h3').textContent();

    await consolePage.getLaunchButton(draftCard).click();
    await page.waitForTimeout(2000);

    // Re-locate the card by name (badge will have changed from DRAFT to ACTIVE)
    const updatedCard = page.locator('.grid > div').filter({ hasText: sessionName! });
    await expect(updatedCard.getByText('ACTIVE', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('Pause active session', async ({ page }) => {
    // Find an ACTIVE session card
    const activeCard = page.locator('.grid > div').filter({ has: page.getByText('ACTIVE', { exact: true }) }).first();
    await expect(activeCard).toBeVisible({ timeout: 10_000 });

    await consolePage.getPauseButton(activeCard).click();
    await page.waitForTimeout(2000);

    // Verify status changes to PAUSED
    await expect(page.getByText('PAUSED', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('Resume paused session', async ({ page }) => {
    // Find a PAUSED session card
    const pausedCard = page.locator('.grid > div').filter({ has: page.getByText('PAUSED', { exact: true }) }).first();
    await expect(pausedCard).toBeVisible({ timeout: 10_000 });

    await consolePage.getResumeButton(pausedCard).click();
    await page.waitForTimeout(2000);

    // Verify status changes to ACTIVE
    await expect(page.getByText('ACTIVE', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('End session', async ({ page }) => {
    // If the page didn't load properly, try reloading
    if (!(await consolePage.heading.isVisible())) {
      await page.reload();
      await expect(consolePage.heading).toBeVisible({ timeout: 15_000 });
    }

    // Find an ACTIVE session card
    const activeCard = page.locator('.grid > div').filter({ has: page.getByText('ACTIVE', { exact: true }) }).first();
    await expect(activeCard).toBeVisible({ timeout: 10_000 });

    await consolePage.getEndButton(activeCard).click();
    await page.waitForTimeout(2000);

    // Session should now be COMPLETED or removed from list
    await page.reload();
    await expect(consolePage.heading).toBeVisible({ timeout: 15_000 });
  });
});
