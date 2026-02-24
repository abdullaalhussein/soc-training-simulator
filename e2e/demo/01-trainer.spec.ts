import { test, expect } from '@playwright/test';
import { API_URL, USERS } from '../fixtures/test-data';

/**
 * Demo Recording — Trainer role.
 *
 * Story: A trainer opens their console, creates a new training session for
 * their team, launches it, then monitors a trainee who is already working
 * on an active investigation.
 *
 * Run with:
 *   npx playwright test e2e/demo/01-trainer.spec.ts --project=demo --headed
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchWithRetry(url: string, options: RequestInit, retries = 5): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);
    if (response.status === 429) {
      const wait = Math.min(30_000, 5_000 * (i + 1));
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    return response;
  }
  return fetch(url, options);
}

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

let monitorSessionId: string;
let trainerToken: string;
let trainerUser: any;

test.beforeAll(async ({}, testInfo) => {
  testInfo.setTimeout(120_000);

  // 1. Login as trainer
  const trainerRes = await fetchWithRetry(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USERS.trainer.email, password: USERS.trainer.password }),
  });
  if (!trainerRes.ok) throw new Error(`Trainer login failed: ${trainerRes.status}`);
  const trainerData = await trainerRes.json();
  trainerToken = trainerData.token;
  trainerUser = trainerData.user;

  // 2. Get scenarios
  const scenariosRes = await fetch(`${API_URL}/api/scenarios`, {
    headers: { Authorization: `Bearer ${trainerToken}` },
  });
  const scenarios = await scenariosRes.json();
  if (!scenarios?.length) throw new Error('No scenarios seeded — run npm run db:seed first');

  // 3. Delete all existing sessions for a clean console
  const existingSessionsRes = await fetch(`${API_URL}/api/sessions`, {
    headers: { Authorization: `Bearer ${trainerToken}` },
  });
  const existingSessions = await existingSessionsRes.json();
  for (const s of existingSessions) {
    if (s.status === 'ACTIVE' || s.status === 'PAUSED') {
      await fetchWithRetry(`${API_URL}/api/sessions/${s.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trainerToken}` },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
    }
    await fetchWithRetry(`${API_URL}/api/sessions/${s.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${trainerToken}` },
    });
  }

  // 4. Get trainee user
  const traineesRes = await fetch(`${API_URL}/api/users?role=TRAINEE`, {
    headers: { Authorization: `Bearer ${trainerToken}` },
  });
  const trainees = await traineesRes.json();
  const trainee = trainees.find((t: any) => t.email === USERS.trainee.email) || trainees[0];

  // 5. Create ONE session that already has a trainee working — for the monitor scene
  const session1Res = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trainerToken}` },
    body: JSON.stringify({
      name: 'Onboarding — Week 1',
      scenarioId: scenarios[0].id,
      memberIds: [trainee.id],
    }),
  });
  const session1 = await session1Res.json();
  monitorSessionId = session1.id;

  // Launch it and start a trainee attempt so the monitor has data
  await fetch(`${API_URL}/api/sessions/${monitorSessionId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trainerToken}` },
    body: JSON.stringify({ status: 'ACTIVE' }),
  });

  const traineeLoginRes = await fetchWithRetry(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USERS.trainee.email, password: USERS.trainee.password }),
  });
  if (!traineeLoginRes.ok) throw new Error(`Trainee login failed: ${traineeLoginRes.status}`);
  const traineeData = await traineeLoginRes.json();

  await fetch(`${API_URL}/api/attempts/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${traineeData.token}` },
    body: JSON.stringify({ sessionId: monitorSessionId }),
  });
});

// ---------------------------------------------------------------------------
// Trainer demo
// ---------------------------------------------------------------------------

test('Trainer demo', async ({ page }) => {
  test.setTimeout(300_000);

  // Inject trainer auth via localStorage (use addInitScript so it's set before any page loads)
  await page.addInitScript(
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

  // =========================================================================
  // SCENE 1 — Trainer Console: view sessions, then create & launch a new one
  // =========================================================================
  // Navigate directly — no login page flash
  await page.goto('/console');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1').filter({ hasText: 'Trainer Console' })).toBeVisible({
    timeout: 15_000,
  });
  // Pause — let viewer see the console with the existing active session
  await page.waitForTimeout(4000);

  // Open the Create Session dialog
  await page.getByRole('button', { name: 'Create Session' }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await page.waitForTimeout(1500);

  // Fill session name (scroll into view so the viewer sees the typed text)
  const sessionNameInput = page.locator('[role="dialog"]').getByPlaceholder('e.g., Cohort 5 - Week 3');
  await sessionNameInput.scrollIntoViewIfNeeded();
  await sessionNameInput.pressSequentially('Incident Response — Lab 3', { delay: 80 });
  await page.waitForTimeout(1500);

  // Select a scenario
  const scenarioTrigger = page
    .locator('[role="dialog"]')
    .locator('button')
    .filter({ hasText: 'Select scenario' });
  if (await scenarioTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
    await scenarioTrigger.scrollIntoViewIfNeeded();
    await scenarioTrigger.click();
    await page.waitForTimeout(1000);
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(1500);
  }

  // Assign a trainee — target labels that contain a checkbox (not the section label)
  const traineeCheckbox = page
    .locator('[role="dialog"]')
    .locator('label')
    .filter({ has: page.locator('input[type="checkbox"]') })
    .first();
  await traineeCheckbox.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await traineeCheckbox.click();
  await page.waitForTimeout(2000);

  // Scroll to and click "Create & Launch"
  const createLaunchBtn = page
    .locator('[role="dialog"]')
    .getByRole('button', { name: /Create & Launch/i });
  await createLaunchBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  await createLaunchBtn.click();
  // Wait for dialog to close and console to refresh with the new session
  await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10_000 });
  await page.waitForTimeout(3000);

  // =========================================================================
  // SCENE 2 — Session Monitor: observe a trainee in the active session
  // =========================================================================
  // Navigate to the session that has trainee activity
  await page.goto(`/sessions/${monitorSessionId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Select the trainee in the participant list
  const traineeBtn = page
    .locator('button')
    .filter({ hasText: /SOC Analyst|trainee/i })
    .first();
  if (await traineeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await traineeBtn.click();
    await page.waitForTimeout(2000);
  }

  // Show Activity tab (default) — trainee's actions
  const activityTab = page.getByRole('tab', { name: 'Activity' });
  if (await activityTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await activityTab.click();
    await page.waitForTimeout(3000);
  }

  // Switch to Discussion tab — trainer sends guidance to trainee
  const discussionTab = page.getByRole('tab', { name: 'Discussion' });
  if (await discussionTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await discussionTab.click();
    await page.waitForTimeout(2000);

    // Scroll the message input into view so the viewer sees the typing
    const msgInput = page.getByPlaceholder('Type a message...');
    if (await msgInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await msgInput.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await msgInput.pressSequentially(
        'Focus on the email headers — check the sender domain carefully.',
        { delay: 60 }
      );
      // Pause — let viewer read the typed message before sending
      await page.waitForTimeout(3000);

      const sendBtn = msgInput.locator('..').locator('button').first();
      if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sendBtn.click();
        // Pause — let viewer see the sent message appear in the chat
        await page.waitForTimeout(3000);
      }
    }
  }

  // Show Send Hint dialog
  const sendHintBtn = page.getByRole('button', { name: 'Send Hint' });
  if (await sendHintBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await sendHintBtn.click();
    await page.waitForTimeout(2000);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }

  // Show Broadcast Alert dialog
  const broadcastBtn = page.getByRole('button', { name: 'Broadcast Alert' });
  if (await broadcastBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await broadcastBtn.click();
    await page.waitForTimeout(2000);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }
});
