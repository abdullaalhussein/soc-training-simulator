import { test, expect } from '@playwright/test';
import {
  loginAs,
  injectAuth,
  cleanAllSessions,
  getScenarios,
  getTrainee,
} from './helpers';

/**
 * Demo V3 — Act 2: Trainer session creation + monitor + scenario guide (~17s).
 *
 * Story: A trainer opens the console, creates a YARA session with a trainee,
 * launches it, views the live monitor, then browses the scenario guide.
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

test('Act 2 — Trainer session + monitor + guide', async ({ page }) => {
  test.setTimeout(300_000);
  await injectAuth(page, trainerUser, trainerToken);

  // =========================================================================
  // SCENE 1 — Trainer Console overview
  // =========================================================================
  await page.goto('/console');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1').filter({ hasText: /trainer.*console/i })).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(1000);

  // =========================================================================
  // SCENE 2 — Session Creation dialog
  // =========================================================================
  await page.getByRole('button', { name: 'Create Session' }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await page.waitForTimeout(600);

  // Type session name
  const sessionNameInput = page
    .locator('[role="dialog"]')
    .getByPlaceholder('e.g., Cohort 5 - Week 3');
  await sessionNameInput.scrollIntoViewIfNeeded();
  await sessionNameInput.pressSequentially('YARA Malware Hunt — Lab 1', { delay: 70 });
  await page.waitForTimeout(600);

  // Select a YARA scenario from dropdown
  const scenarioTrigger = page
    .locator('[role="dialog"]')
    .locator('button')
    .filter({ hasText: 'Select scenario' });
  if (await scenarioTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
    await scenarioTrigger.scrollIntoViewIfNeeded();
    await scenarioTrigger.click();
    await page.waitForTimeout(600);
    // Try to pick a YARA-related scenario, else first
    const yaraOption = page.locator('[role="option"]').filter({ hasText: /yara/i }).first();
    if (await yaraOption.isVisible({ timeout: 1500 }).catch(() => false)) {
      await yaraOption.click();
    } else {
      await page.locator('[role="option"]').first().click();
    }
    await page.waitForTimeout(600);
  }

  // Set time limit
  const timeLimitInput = page
    .locator('[role="dialog"]')
    .locator('input[type="number"]')
    .first();
  if (await timeLimitInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await timeLimitInput.scrollIntoViewIfNeeded();
    await timeLimitInput.fill('45');
    await page.waitForTimeout(400);
  }

  // Check trainee checkbox
  const traineeCheckbox = page
    .locator('[role="dialog"]')
    .locator('label')
    .filter({ has: page.locator('input[type="checkbox"]') })
    .first();
  await traineeCheckbox.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await traineeCheckbox.click();
  await page.waitForTimeout(600);

  // Click "Create & Launch" — capture session ID from API response
  let createdSessionId: string | null = null;
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/sessions') && resp.request().method() === 'POST',
    { timeout: 15_000 }
  ).catch(() => null);

  const createLaunchBtn = page
    .locator('[role="dialog"]')
    .getByRole('button', { name: /Create & Launch/i });
  await createLaunchBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await createLaunchBtn.click();

  const response = await responsePromise;
  if (response) {
    try {
      const body = await response.json();
      createdSessionId = body.id;
    } catch { /* ignore */ }
  }

  await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10_000 });
  await page.waitForTimeout(1200);

  // =========================================================================
  // SCENE 3 — Live Monitor
  // =========================================================================
  if (createdSessionId) {
    await page.goto(`/sessions/${createdSessionId}`);
  } else {
    // Fallback: click the first session link on the console
    const sessionLink = page.locator('a[href*="/sessions/"]').first();
    if (await sessionLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sessionLink.click();
    }
  }
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // =========================================================================
  // SCENE 4 — Scenario Guide
  // =========================================================================
  await page.goto('/scenario-guide');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Click first scenario card
  const firstCard = page.locator('a[href*="scenario-guide"], [class*="card"]').first();
  if (await firstCard.isVisible({ timeout: 3000 }).catch(() => false)) {
    await firstCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Scroll down to show stages
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await page.waitForTimeout(1000);
  }

  // Final pause
  await page.waitForTimeout(500);
});
