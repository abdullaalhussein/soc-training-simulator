import { test, expect, Browser } from '@playwright/test';
import {
  loginAs,
  cleanAllSessions,
  getScenarios,
  getTrainee,
  createAndLaunchSession,
  startAttempt,
  API_URL,
} from './helpers';

/**
 * Demo V2 — Act 4: Split-screen trainer + trainee real-time (~35s).
 *
 * Story: Two browser contexts run simultaneously — trainer monitors the
 * trainee's actions in real-time. Actions on one side produce visible
 * effects on the other.
 *
 * Produces two separate .webm files that Remotion composites side-by-side.
 *
 * Run with:
 *   npx playwright test --project=demo-v2 e2e/demo-v2/03-split-screen.spec.ts --headed
 */

let trainerToken: string;
let trainerUser: any;
let traineeToken: string;
let traineeUser: any;
let sessionId: string;
let attemptId: string;

test.beforeAll(async ({}, testInfo) => {
  testInfo.setTimeout(120_000);

  // Setup: create session with active attempt
  const trainer = await loginAs('trainer');
  trainerToken = trainer.token;
  trainerUser = trainer.user;

  await cleanAllSessions(trainerToken);

  const scenarios = await getScenarios(trainerToken);
  const trainee = await getTrainee(trainerToken);

  const session = await createAndLaunchSession(
    trainerToken,
    'Real-Time Monitoring Demo',
    scenarios[0].id,
    [trainee.id]
  );
  sessionId = session.id;

  // Login as trainee and start attempt
  const traineeAuth = await loginAs('trainee');
  traineeToken = traineeAuth.token;
  traineeUser = traineeAuth.user;

  const attempt = await startAttempt(traineeToken, sessionId);
  attemptId = attempt.id;
});

test('Act 4 — Split-screen real-time', async ({ browser }) => {
  test.setTimeout(300_000);

  // Create two separate browser contexts — each records its own video
  const trainerContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: 'test-results/demo-v2-split-trainer/',
      size: { width: 1920, height: 1080 },
    },
  });

  const traineeContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: 'test-results/demo-v2-split-trainee/',
      size: { width: 1920, height: 1080 },
    },
  });

  const trainerPage = await trainerContext.newPage();
  const traineePage = await traineeContext.newPage();

  // Inject auth for both
  await trainerPage.addInitScript(
    ({ user, token }) => {
      localStorage.setItem('token', token);
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: { user, token, isAuthenticated: true },
          version: 0,
        })
      );
    },
    { user: trainerUser, token: trainerToken }
  );

  await traineePage.addInitScript(
    ({ user, token }) => {
      localStorage.setItem('token', token);
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: { user, token, isAuthenticated: true },
          version: 0,
        })
      );
    },
    { user: traineeUser, token: traineeToken }
  );

  // =========================================================================
  // SCENE 1 — Both navigate simultaneously
  // =========================================================================
  await Promise.all([
    trainerPage.goto(`/sessions/${sessionId}`),
    traineePage.goto(`/scenario/${attemptId}`),
  ]);

  await Promise.all([
    trainerPage.waitForLoadState('networkidle'),
    traineePage.waitForLoadState('networkidle'),
  ]);

  await trainerPage.waitForTimeout(2000);

  // Handle trainee onboarding popup
  const nextBtn = traineePage.getByRole('button', { name: /next/i }).first();
  for (let i = 0; i < 3; i++) {
    if (await nextBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await nextBtn.click();
      await traineePage.waitForTimeout(400);
    }
  }
  const closeOnboarding = traineePage.getByRole('button', { name: /close|done|got it|skip/i }).first();
  if (await closeOnboarding.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeOnboarding.click();
    await traineePage.waitForTimeout(500);
  }

  // Handle trainee briefing
  const continueBtn = traineePage
    .locator('text=Continue to Investigation')
    .or(traineePage.locator('text=Begin Investigation'));
  if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await continueBtn.click();
    await traineePage.waitForLoadState('networkidle');
    await traineePage.waitForTimeout(1500);
  }

  // =========================================================================
  // SCENE 2 — Trainer selects trainee in participant list
  // =========================================================================
  const traineeBtn = trainerPage
    .locator('button')
    .filter({ hasText: /SOC Analyst|trainee/i })
    .first();
  if (await traineeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await traineeBtn.click();
    await trainerPage.waitForTimeout(1500);
  }

  // Show Activity tab
  const activityTab = trainerPage.getByRole('tab', { name: 'Activity' });
  if (await activityTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await activityTab.click();
    await trainerPage.waitForTimeout(1000);
  }

  // =========================================================================
  // SCENE 3 — Trainee adds evidence → trainer sees activity
  // =========================================================================
  const addEvidenceBtn = traineePage.locator('button[title="Add to Evidence"]').first();
  if (await addEvidenceBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await addEvidenceBtn.click();
    // Wait for activity to appear on trainer side
    await trainerPage.waitForTimeout(2000);
  }

  // =========================================================================
  // SCENE 4 — Trainer broadcasts alert
  // =========================================================================
  const broadcastBtn = trainerPage.getByRole('button', { name: /Broadcast Alert/i });
  if (await broadcastBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await broadcastBtn.click();
    await trainerPage.waitForTimeout(800);

    // Type alert message
    const alertInput = trainerPage.locator('[role="dialog"]').locator('textarea, input[type="text"]').first();
    if (await alertInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await alertInput.pressSequentially('Priority: Check the DNS logs for C2 beaconing patterns', {
        delay: 50,
      });
      await trainerPage.waitForTimeout(800);

      // Send
      const sendBtn = trainerPage
        .locator('[role="dialog"]')
        .getByRole('button', { name: /send|broadcast/i });
      if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sendBtn.click();
        await trainerPage.waitForTimeout(1000);
      } else {
        await trainerPage.keyboard.press('Escape');
      }
    } else {
      await trainerPage.keyboard.press('Escape');
    }

    // Trainee sees broadcast overlay
    await traineePage.waitForTimeout(2000);
    // Dismiss if visible
    const dismissBtn = traineePage.getByRole('button', { name: /dismiss|close|ok/i }).first();
    if (await dismissBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dismissBtn.click();
      await traineePage.waitForTimeout(500);
    }
  }

  // =========================================================================
  // SCENE 5 — Trainer sends discussion message
  // =========================================================================
  const discussionTab = trainerPage.getByRole('tab', { name: 'Discussion' });
  if (await discussionTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await discussionTab.click();
    await trainerPage.waitForTimeout(1000);

    const msgInput = trainerPage.getByPlaceholder('Type a message...');
    if (await msgInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await msgInput.scrollIntoViewIfNeeded();
      await msgInput.pressSequentially(
        'Good progress! Focus on the email sender domain.',
        { delay: 50 }
      );
      await trainerPage.waitForTimeout(800);

      const sendBtn = msgInput.locator('..').locator('button').first();
      if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sendBtn.click();
        await trainerPage.waitForTimeout(1500);
      }
    }
  }

  // =========================================================================
  // SCENE 6 — Trainee opens chat panel to see message
  // =========================================================================
  const chatBtn = traineePage.getByRole('button', { name: /chat|discussion/i }).first();
  if (await chatBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await chatBtn.click();
    await traineePage.waitForTimeout(2000);
  }

  // Final synchronized pause
  await Promise.all([
    trainerPage.waitForTimeout(2000),
    traineePage.waitForTimeout(2000),
  ]);

  // Close contexts to finalize video recordings
  await trainerContext.close();
  await traineeContext.close();
});
