import { test, expect } from '@playwright/test';
import {
  loginAs,
  injectAuth,
  cleanAllSessions,
  getScenarios,
  getTrainee,
} from './helpers';

/**
 * Demo V2 — Act 2: Trainer session creation + scenario guide (~40s).
 *
 * Story: A trainer opens their console, creates a new training session,
 * launches it, then browses the scenario guide.
 *
 * Run with:
 *   npx playwright test --project=demo-v2 e2e/demo-v2/01-trainer.spec.ts --headed
 */

let trainerToken: string;
let trainerUser: any;

test.beforeAll(async ({}, testInfo) => {
  testInfo.setTimeout(120_000);
  const auth = await loginAs('trainer');
  trainerToken = auth.token;
  trainerUser = auth.user;

  // Clean slate
  await cleanAllSessions(trainerToken);
});

test('Act 2 — Trainer session creation', async ({ page }) => {
  test.setTimeout(300_000);
  await injectAuth(page, trainerUser, trainerToken);

  // =========================================================================
  // SCENE 1 — Trainer Console
  // =========================================================================
  await page.goto('/console');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1').filter({ hasText: /trainer.*console/i })).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(1500);

  // Open Create Session dialog
  await page.getByRole('button', { name: 'Create Session' }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await page.waitForTimeout(1000);

  // Type session name
  const sessionNameInput = page
    .locator('[role="dialog"]')
    .getByPlaceholder('e.g., Cohort 5 - Week 3');
  await sessionNameInput.scrollIntoViewIfNeeded();
  await sessionNameInput.pressSequentially('Malware Analysis — Lab 2', { delay: 70 });
  await page.waitForTimeout(1000);

  // Select a scenario (pick one with YARA if possible)
  const scenarioTrigger = page
    .locator('[role="dialog"]')
    .locator('button')
    .filter({ hasText: 'Select scenario' });
  if (await scenarioTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
    await scenarioTrigger.scrollIntoViewIfNeeded();
    await scenarioTrigger.click();
    await page.waitForTimeout(800);
    // Try to pick a YARA-related scenario, else first
    const yaraOption = page.locator('[role="option"]').filter({ hasText: /yara/i }).first();
    if (await yaraOption.isVisible({ timeout: 1500 }).catch(() => false)) {
      await yaraOption.click();
    } else {
      await page.locator('[role="option"]').first().click();
    }
    await page.waitForTimeout(1000);
  }

  // Set time limit if field exists
  const timeLimitInput = page
    .locator('[role="dialog"]')
    .locator('input[type="number"]')
    .first();
  if (await timeLimitInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await timeLimitInput.scrollIntoViewIfNeeded();
    await timeLimitInput.fill('60');
    await page.waitForTimeout(500);
  }

  // Check a trainee
  const traineeCheckbox = page
    .locator('[role="dialog"]')
    .locator('label')
    .filter({ has: page.locator('input[type="checkbox"]') })
    .first();
  await traineeCheckbox.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await traineeCheckbox.click();
  await page.waitForTimeout(1000);

  // Click "Create & Launch"
  const createLaunchBtn = page
    .locator('[role="dialog"]')
    .getByRole('button', { name: /Create & Launch/i });
  await createLaunchBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await createLaunchBtn.click();
  await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10_000 });
  await page.waitForTimeout(1500);

  // =========================================================================
  // SCENE 2 — Scenario Guide
  // =========================================================================
  await page.goto('/scenario-guide');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Click first scenario card
  const firstCard = page.locator('a[href*="scenario-guide"], [class*="card"]').first();
  if (await firstCard.isVisible({ timeout: 3000 }).catch(() => false)) {
    await firstCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Scroll down to show stages/checkpoints/answers
    await page.evaluate(() => window.scrollBy({ top: 500, behavior: 'smooth' }));
    await page.waitForTimeout(2000);
  }

  // Final pause
  await page.waitForTimeout(1000);
});
