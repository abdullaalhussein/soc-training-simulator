import { test, expect } from '@playwright/test';
import {
  loginAs,
  injectAuth,
  cleanAllSessions,
  getScenarios,
  getTrainee,
  createAndLaunchSession,
} from './helpers';

/**
 * Demo V2 — Act 3: Full trainee investigation walkthrough (~80s).
 *
 * Story: A trainee opens their dashboard, starts an investigation, examines
 * logs, collects evidence, builds a timeline, answers a checkpoint, uses the
 * SOC Mentor, and reviews hints.
 *
 * Run with:
 *   npx playwright test --project=demo-v2 e2e/demo-v2/02-trainee.spec.ts --headed
 */

let traineeToken: string;
let traineeUser: any;

test.beforeAll(async ({}, testInfo) => {
  testInfo.setTimeout(120_000);

  // Setup: trainer creates a session for the trainee
  const trainer = await loginAs('trainer');
  await cleanAllSessions(trainer.token);

  const scenarios = await getScenarios(trainer.token);
  const trainee = await getTrainee(trainer.token);

  await createAndLaunchSession(
    trainer.token,
    'Onboarding — Week 1',
    scenarios[0].id,
    [trainee.id]
  );

  // Login as trainee (don't start attempt — trainee clicks "Start Investigation")
  const traineeAuth = await loginAs('trainee');
  traineeToken = traineeAuth.token;
  traineeUser = traineeAuth.user;
});

test('Act 3 — Trainee investigation', async ({ page }) => {
  test.setTimeout(300_000);
  await injectAuth(page, traineeUser, traineeToken);

  // =========================================================================
  // SCENE 1 — Dashboard
  // =========================================================================
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1').filter({ hasText: 'Welcome back' })).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(1500);

  // Scroll to session card
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
  await page.waitForTimeout(1500);

  // Click "Start Investigation"
  const startBtn = page.getByRole('button', { name: /Start Investigation/i }).first();
  await expect(startBtn).toBeVisible({ timeout: 5000 });
  await startBtn.click();
  await page.waitForURL('**/scenario/**', { timeout: 15_000 });
  await page.waitForLoadState('networkidle');

  // =========================================================================
  // SCENE 2 — Briefing page
  // =========================================================================
  await page.waitForTimeout(2000);

  const continueBtn = page
    .locator('text=Continue to Investigation')
    .or(page.locator('text=Begin Investigation'));
  if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await continueBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  }

  // =========================================================================
  // SCENE 3 — Investigation workspace
  // =========================================================================
  await page.waitForTimeout(2000);

  // Handle onboarding popup if it appears
  const nextBtn = page.getByRole('button', { name: /next/i }).first();
  for (let i = 0; i < 2; i++) {
    if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(500);
    }
  }
  const closeOnboarding = page.getByRole('button', { name: /close|done|got it|skip/i }).first();
  if (await closeOnboarding.isVisible({ timeout: 1500 }).catch(() => false)) {
    await closeOnboarding.click();
    await page.waitForTimeout(500);
  }

  // =========================================================================
  // SCENE 4 — Log detail + evidence collection
  // =========================================================================
  // Click first log row → LogDetailModal
  const firstRow = page.locator('tbody tr').first();
  if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
    await firstRow.click();
    await page.waitForTimeout(1500);

    // Add to Evidence from modal
    const addEvidenceModalBtn = page
      .locator('[role="dialog"]')
      .getByRole('button', { name: /Add to Evidence/i });
    if (await addEvidenceModalBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addEvidenceModalBtn.click();
      await page.waitForTimeout(1000);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  }

  // Add evidence via inline Plus buttons
  const addEvidenceBtns = page.locator('button[title="Add to Evidence"]');
  const btnCount = await addEvidenceBtns.count();
  for (let i = 0; i < Math.min(2, btnCount); i++) {
    const btn = addEvidenceBtns.nth(i);
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1000);
    }
  }

  // =========================================================================
  // SCENE 5 — Timeline entry
  // =========================================================================
  // Click clock icon on a log row for timeline
  const timelineBtn = page.locator('button[title*="imeline"]').first();
  if (await timelineBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await timelineBtn.click();
    await page.waitForTimeout(1000);
  }

  // =========================================================================
  // SCENE 6 — Evidence tab
  // =========================================================================
  const evidenceTab = page.getByRole('tab', { name: /evidence/i });
  if (await evidenceTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await evidenceTab.click();
    await page.waitForTimeout(1500);
  }

  // =========================================================================
  // SCENE 7 — Timeline tab
  // =========================================================================
  const timelineTab = page.getByRole('tab', { name: /timeline/i });
  if (await timelineTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await timelineTab.click();
    await page.waitForTimeout(1500);
  }

  // Switch back to logs
  const logsTab = page.getByRole('tab', { name: /logs/i }).or(page.getByRole('tab', { name: /feed/i }));
  if (await logsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logsTab.click();
    await page.waitForTimeout(500);
  }

  // =========================================================================
  // SCENE 8 — Checkpoint
  // =========================================================================
  const checkpointBtn = page
    .getByRole('button', { name: /checkpoint/i })
    .first()
    .or(page.locator('button').filter({ has: page.locator('svg.lucide-check-circle') }).first());

  if (await checkpointBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await checkpointBtn.scrollIntoViewIfNeeded();
    await checkpointBtn.click();
    await page.waitForTimeout(1500);

    const modal = page.locator('[role="dialog"]');
    if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Select an answer
      const option = modal
        .locator('button, [role="radio"], label')
        .filter({ hasText: /.+/ })
        .first();
      if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
        await option.scrollIntoViewIfNeeded();
        await option.click();
        await page.waitForTimeout(1000);
      }

      const submitBtn = modal.getByRole('button', { name: /submit/i });
      if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitBtn.scrollIntoViewIfNeeded();
        await submitBtn.click();
        await page.waitForTimeout(1500);
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  }

  // =========================================================================
  // SCENE 9 — Discussion panel
  // =========================================================================
  const chatBtn = page.getByRole('button', { name: /chat|discussion/i }).first();
  if (await chatBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await chatBtn.click();
    await page.waitForTimeout(1500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // =========================================================================
  // SCENE 10 — Reveal Hint
  // =========================================================================
  const revealHintBtn = page.getByRole('button', { name: /reveal hint/i }).first();
  if (await revealHintBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await revealHintBtn.scrollIntoViewIfNeeded();
    await revealHintBtn.click();
    await page.waitForTimeout(1500);
  }

  // =========================================================================
  // SCENE 11 — SOC Mentor
  // =========================================================================
  const aiHelpBtn = page.getByRole('button', { name: /AI Help/i }).first();
  if (await aiHelpBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await aiHelpBtn.click();
    await page.waitForTimeout(2000);

    const aiInput = page.getByPlaceholder(/ask for guidance/i).first();
    if (await aiInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await aiInput.scrollIntoViewIfNeeded();
      await aiInput.pressSequentially(
        'What patterns should I look for in the email headers?',
        { delay: 60 }
      );
      await page.waitForTimeout(2000);
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } else {
    const aiTab = page.getByRole('tab', { name: /ai/i });
    if (await aiTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await aiTab.click();
      await page.waitForTimeout(2000);
    }
  }

  // Final pause
  await page.waitForTimeout(1000);
});
