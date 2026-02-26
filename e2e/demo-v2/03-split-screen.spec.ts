import { test, expect } from '@playwright/test';
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
 * Demo V3 — Act 4: Split-screen bi-directional real-time (~29s).
 *
 * Story: Two browser contexts run simultaneously — trainee chats to trainer,
 * trainer replies, trainer broadcasts, trainee uses hints & SOC Mentor while
 * trainer watches the live activity feed.
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
    'Demo — Real-Time Monitoring',
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
  // SCENE 1 — Real-Time Monitoring: both navigate simultaneously (~6s)
  // =========================================================================
  await Promise.all([
    trainerPage.goto(`/sessions/${sessionId}`),
    traineePage.goto(`/scenario/${attemptId}`),
  ]);

  await Promise.all([
    trainerPage.waitForLoadState('networkidle'),
    traineePage.waitForLoadState('networkidle'),
  ]);

  // Trainee: handle briefing page — must click "Continue to Investigation"
  const continueBtn = traineePage
    .locator('text=Continue to Investigation')
    .or(traineePage.locator('text=Begin Investigation'));
  if (await continueBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    await traineePage.waitForTimeout(1000);
    await continueBtn.first().click();
    await traineePage.waitForLoadState('networkidle');
    await traineePage.waitForTimeout(1500);
  }

  // Trainee: handle onboarding popup
  for (let i = 0; i < 4; i++) {
    const nextBtn = traineePage.getByRole('button', { name: /next/i }).first();
    if (await nextBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await nextBtn.click();
      await traineePage.waitForTimeout(400);
    }
  }
  const closeOnboarding = traineePage.getByRole('button', { name: /close|done|got it|skip/i }).first();
  if (await closeOnboarding.isVisible({ timeout: 1500 }).catch(() => false)) {
    await closeOnboarding.click();
    await traineePage.waitForTimeout(500);
  }

  // Trainer: click the trainee name in the participants sidebar.
  // Must target the <button> element directly — getByText returns the inner <span>
  // which doesn't reliably bubble the click to the button's onClick handler.
  await trainerPage.waitForTimeout(2000);

  // Trainee list buttons uniquely contain "Stage X/Y" text
  const traineeBtn = trainerPage
    .locator('button')
    .filter({ hasText: /Stage \d+\/\d+/ })
    .first();

  if (await traineeBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await traineeBtn.click({ force: true });
    await trainerPage.waitForTimeout(2000);
  } else {
    // JS fallback: click any button containing stage progress text
    await trainerPage.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (/Stage \d+\/\d+/.test(btn.textContent || '')) {
          btn.click();
          break;
        }
      }
    });
    await trainerPage.waitForTimeout(2000);
  }

  // Trainer: click Activity tab
  const activityTab = trainerPage.getByRole('tab', { name: 'Activity' });
  if (await activityTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await activityTab.click();
    await trainerPage.waitForTimeout(1500);
  }

  // =========================================================================
  // SCENE 2 — Trainee Chat → Trainer (~6s)
  // =========================================================================
  // Trainee opens chat panel
  const traineeChatBtn = traineePage.getByRole('button', { name: /chat|discussion/i }).first();
  if (await traineeChatBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await traineeChatBtn.click();
    await traineePage.waitForTimeout(1000);

    // Trainee types and sends a message
    const traineeMsgInput = traineePage.getByPlaceholder('Type a message...');
    if (await traineeMsgInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await traineeMsgInput.scrollIntoViewIfNeeded();
      await traineeMsgInput.pressSequentially(
        'Found suspicious DNS query to 185.220.101.1',
        { delay: 50 }
      );
      await traineePage.waitForTimeout(800);

      // Send the message
      const traineeSendBtn = traineeMsgInput.locator('..').locator('button').first();
      if (await traineeSendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await traineeSendBtn.click();
        await traineePage.waitForTimeout(1000);
      }
    }
  }

  // Trainer switches to Discussion tab to see the message
  // Use JS click — Radix tabs re-render from socket events, causing Playwright
  // actionability checks to hang indefinitely.
  await trainerPage.waitForTimeout(1000);
  await trainerPage.evaluate(() => {
    const tabs = document.querySelectorAll('[role="tab"]');
    for (const tab of tabs) {
      if (tab.textContent?.trim() === 'Discussion') {
        (tab as HTMLElement).click();
        break;
      }
    }
  });
  await trainerPage.waitForTimeout(2000);

  // =========================================================================
  // SCENE 3 — Trainer Reply → Trainee (~6s)
  // =========================================================================
  const trainerMsgInput = trainerPage.getByPlaceholder('Type a message...');
  if (await trainerMsgInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await trainerMsgInput.scrollIntoViewIfNeeded();
    await trainerMsgInput.pressSequentially(
      'Good catch! Note the beacon interval timing.',
      { delay: 50 }
    );
    await trainerPage.waitForTimeout(800);

    const trainerSendBtn = trainerMsgInput.locator('..').locator('button').first();
    if (await trainerSendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await trainerSendBtn.click({ force: true });
      await trainerPage.waitForTimeout(1500);
    }
  }

  // Trainee sees reply in chat
  await traineePage.waitForTimeout(2000);

  // =========================================================================
  // SCENE 4 — Broadcast Alert (~5s)
  // =========================================================================
  const broadcastBtn = trainerPage.getByRole('button', { name: /Broadcast Alert/i });
  if (await broadcastBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await broadcastBtn.click({ force: true });
    await trainerPage.waitForTimeout(800);

    // Type alert message
    const alertInput = trainerPage.locator('[role="dialog"]').locator('textarea, input[type="text"]').first();
    if (await alertInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await alertInput.pressSequentially('PRIORITY: Investigate C2 callback in DNS logs', {
        delay: 50,
      });
      await trainerPage.waitForTimeout(800);

      // Send
      const sendBtn = trainerPage
        .locator('[role="dialog"]')
        .getByRole('button', { name: /send|broadcast/i });
      if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sendBtn.click({ force: true });
        await trainerPage.waitForTimeout(1000);
      } else {
        await trainerPage.keyboard.press('Escape');
      }
    } else {
      await trainerPage.keyboard.press('Escape');
    }

    // Trainee sees broadcast overlay → dismisses
    await traineePage.waitForTimeout(2000);
    const dismissBtn = traineePage.getByRole('button', { name: /dismiss|close|ok/i }).first();
    if (await dismissBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dismissBtn.click({ force: true });
      await traineePage.waitForTimeout(500);
    }
  }

  // =========================================================================
  // SCENE 5 — Live Activity Log (~6s)
  // =========================================================================
  // Trainer switches to Activity tab — use JS click to avoid Radix tab stability issues
  await trainerPage.evaluate(() => {
    const tabs = document.querySelectorAll('[role="tab"]');
    for (const tab of tabs) {
      if (tab.textContent?.trim() === 'Activity') {
        (tab as HTMLElement).click();
        break;
      }
    }
  });
  await trainerPage.waitForTimeout(1000);

  // Trainee reveals hint → trainer sees event in feed
  const revealHintBtn = traineePage.getByRole('button', { name: /reveal hint/i }).first();
  if (await revealHintBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await revealHintBtn.scrollIntoViewIfNeeded();
    await revealHintBtn.click({ force: true });
    await trainerPage.waitForTimeout(1500);
  }

  // Trainee opens SOC Mentor → trainer sees event in feed
  const aiHelpBtn = traineePage.getByRole('button', { name: /AI Help/i }).first();
  if (await aiHelpBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await aiHelpBtn.click({ force: true });
    await trainerPage.waitForTimeout(1500);
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
