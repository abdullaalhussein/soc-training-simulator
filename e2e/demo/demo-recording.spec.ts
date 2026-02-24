import { test, expect } from '@playwright/test';
import { API_URL, BASE_URL, USERS } from '../fixtures/test-data';

/**
 * Demo Recording Script — walkthrough of the SOC Training Simulator.
 *
 * Run with:
 *   npx playwright test e2e/demo/demo-recording.spec.ts --project=demo --headed
 *
 * The resulting .webm video is saved to test-results/.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch with retry on 429 rate limiting. */
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
// Shared state set up in beforeAll
// ---------------------------------------------------------------------------

let sessionId: string;
let attemptId: string;
let traineeToken: string;
let trainerToken: string;
let trainerUser: any;
let traineeUser: any;

test.beforeAll(async ({ }, testInfo) => {
  testInfo.setTimeout(120_000); // 2 minutes for setup
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

  // 3. Delete all existing sessions so the console is clean
  const existingSessionsRes = await fetch(`${API_URL}/api/sessions`, {
    headers: { Authorization: `Bearer ${trainerToken}` },
  });
  const existingSessions = await existingSessionsRes.json();
  for (const s of existingSessions) {
    // End active sessions first, then delete
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

  // 4. Get trainee user id
  const traineesRes = await fetch(`${API_URL}/api/users?role=TRAINEE`, {
    headers: { Authorization: `Bearer ${trainerToken}` },
  });
  const trainees = await traineesRes.json();
  const trainee = trainees.find((t: any) => t.email === USERS.trainee.email) || trainees[0];

  // 5. Create TWO sessions so the console shows a realistic list
  // Session 1 — the one we'll use for the demo investigation
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
  sessionId = session1.id;

  // Session 2 — a second session for visual variety
  const scenario2 = scenarios.length > 1 ? scenarios[1] : scenarios[0];
  await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trainerToken}` },
    body: JSON.stringify({
      name: 'Advanced Threat Hunting',
      scenarioId: scenario2.id,
      memberIds: [trainee.id],
    }),
  });

  // 6. Launch session 1
  await fetch(`${API_URL}/api/sessions/${sessionId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trainerToken}` },
    body: JSON.stringify({ status: 'ACTIVE' }),
  });

  // 7. Login as trainee and start attempt
  const traineeLoginRes = await fetchWithRetry(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USERS.trainee.email, password: USERS.trainee.password }),
  });
  if (!traineeLoginRes.ok) throw new Error(`Trainee login failed: ${traineeLoginRes.status}`);
  const traineeData = await traineeLoginRes.json();
  traineeToken = traineeData.token;
  traineeUser = traineeData.user;

  const attemptRes = await fetch(`${API_URL}/api/attempts/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${traineeToken}` },
    body: JSON.stringify({ sessionId }),
  });
  const attempt = await attemptRes.json();
  attemptId = attempt.id;
});

// ---------------------------------------------------------------------------
// Single continuous test — one video file
// ---------------------------------------------------------------------------

test('Demo walkthrough', async ({ page }) => {
  test.setTimeout(300_000); // 5 minutes max

  // =========================================================================
  // SCENE 1 — Login Page (Trainer login with visible typing)
  // =========================================================================
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'SOC Training Simulator' })).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(3000);

  // Type trainer credentials visibly
  await page.locator('#email').pressSequentially(USERS.trainer.email, { delay: 80 });
  await page.waitForTimeout(500);
  await page.locator('#password').pressSequentially(USERS.trainer.password, { delay: 80 });
  await page.waitForTimeout(1000);

  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/console', { timeout: 15_000 });
  await page.waitForLoadState('networkidle');

  // =========================================================================
  // SCENE 2 — Trainer Console (clean — only 2 sessions)
  // =========================================================================
  await expect(page.locator('h1').filter({ hasText: 'Trainer Console' })).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(3000);

  // Open the Create Session dialog
  await page.getByRole('button', { name: 'Create Session' }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await page.waitForTimeout(1500);

  // Fill session name
  const sessionNameInput = page.locator('[role="dialog"]').getByPlaceholder('e.g., Cohort 5 - Week 3');
  await sessionNameInput.pressSequentially('Incident Response — Lab 3', { delay: 60 });
  await page.waitForTimeout(800);

  // Open scenario dropdown and select first option
  const scenarioTrigger = page.locator('[role="dialog"]').locator('button').filter({ hasText: 'Select scenario' });
  if (await scenarioTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
    await scenarioTrigger.click();
    await page.waitForTimeout(800);
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(1000);
  }

  await page.waitForTimeout(2000);

  // Close dialog (just showcasing the form)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2000);

  // =========================================================================
  // SCENE 3 — Trainer Session Monitor (Activity + Discussion)
  // =========================================================================

  // Navigate to the session monitor for the demo session
  await page.goto(`/sessions/${sessionId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Click on the trainee in the list to select them
  const traineeBtn = page.locator('button').filter({ hasText: /SOC Analyst|trainee/i }).first();
  if (await traineeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await traineeBtn.click();
    await page.waitForTimeout(2000);
  }

  // Show Activity tab (should be default)
  const activityTab = page.getByRole('tab', { name: 'Activity' });
  if (await activityTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await activityTab.click();
    await page.waitForTimeout(3000);
  }

  // Switch to Discussion tab — trainer communicates with trainee
  const discussionTab = page.getByRole('tab', { name: 'Discussion' });
  if (await discussionTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await discussionTab.click();
    await page.waitForTimeout(1500);

    // Type a message to the trainee
    const msgInput = page.getByPlaceholder('Type a message...');
    if (await msgInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await msgInput.pressSequentially('Focus on the email headers — check the sender domain carefully.', { delay: 50 });
      await page.waitForTimeout(1500);

      // Click send button (sibling in the flex container)
      const sendBtn = msgInput.locator('..').locator('button').first();
      if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sendBtn.click();
        await page.waitForTimeout(2500);
      }
    }
  }

  // Show the Send Hint dialog
  const sendHintBtn = page.getByRole('button', { name: 'Send Hint' });
  if (await sendHintBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await sendHintBtn.click();
    await page.waitForTimeout(2000);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }

  // Show the Broadcast Alert dialog
  const broadcastBtn = page.getByRole('button', { name: 'Broadcast Alert' });
  if (await broadcastBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await broadcastBtn.click();
    await page.waitForTimeout(2000);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }

  // =========================================================================
  // SCENE 4 — Trainee Dashboard (re-login as trainee)
  // =========================================================================

  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  await page.locator('#email').fill('');
  await page.locator('#password').fill('');

  await page.locator('#email').pressSequentially(USERS.trainee.email, { delay: 80 });
  await page.waitForTimeout(500);
  await page.locator('#password').pressSequentially(USERS.trainee.password, { delay: 80 });
  await page.waitForTimeout(1000);

  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
  await page.waitForLoadState('networkidle');

  await expect(page.locator('h1').filter({ hasText: 'Welcome back' })).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(3000);

  // Scroll down to show session cards
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
  await page.waitForTimeout(2000);

  // =========================================================================
  // SCENE 5 — Investigation Workspace + Evidence Collection
  // =========================================================================

  await page.goto(`/scenario/${attemptId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Skip lesson/briefing page if shown
  const lessonBtn = page
    .locator('text=Continue to Investigation')
    .or(page.locator('text=Begin Investigation'));
  if (await lessonBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await lessonBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  }

  // Showcase the 3-panel workspace
  await page.waitForTimeout(4000);

  // Click first log row to expand detail view
  const firstRow = page.locator('tbody tr').first();
  if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
    await firstRow.click();
    await page.waitForTimeout(3000);

    // Add to Evidence from the detail modal
    const addEvidenceModalBtn = page.locator('[role="dialog"]').getByRole('button', { name: /Add to Evidence/i });
    if (await addEvidenceModalBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addEvidenceModalBtn.click();
      await page.waitForTimeout(2000);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  }

  // Add more evidence using the inline Plus buttons in the log table
  const addEvidenceBtns = page.locator('button[title="Add to Evidence"]');
  const btnCount = await addEvidenceBtns.count();
  for (let i = 0; i < Math.min(2, btnCount); i++) {
    const btn = addEvidenceBtns.nth(i);
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1500);
    }
  }

  // Switch to Evidence tab to show collected evidence
  const evidenceTab = page.getByRole('tab', { name: /evidence/i });
  if (await evidenceTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await evidenceTab.click();
    await page.waitForTimeout(3000);
  }

  // Switch back to logs
  const logsTab = page.getByRole('tab', { name: /logs/i }).or(page.getByRole('tab', { name: /feed/i }));
  if (await logsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logsTab.click();
    await page.waitForTimeout(1000);
  }

  // Type in search bar to filter logs
  const searchInput = page.getByPlaceholder(/search/i).first();
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.pressSequentially('suspicious', { delay: 80 });
    await page.waitForTimeout(2500);
    await searchInput.fill('');
    await page.waitForTimeout(1000);
  }

  // =========================================================================
  // SCENE 6 — Checkpoints
  // =========================================================================

  const checkpointBtn = page
    .getByRole('button', { name: /checkpoint/i })
    .first()
    .or(page.locator('button').filter({ has: page.locator('svg.lucide-check-circle') }).first());

  if (await checkpointBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await checkpointBtn.click();
    await page.waitForTimeout(1500);

    const modal = page.locator('[role="dialog"]');
    if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
      const option = modal
        .locator('button, [role="radio"], label')
        .filter({ hasText: /.+/ })
        .first();
      if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
        await option.click();
        await page.waitForTimeout(1000);
      }

      const submitBtn = modal.getByRole('button', { name: /submit/i });
      if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(3000);
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }
  } else {
    await page.waitForTimeout(2000);
  }

  // =========================================================================
  // SCENE 7 — SOC Mentor (AI Assistant)
  // =========================================================================

  const aiHelpBtn = page.getByRole('button', { name: /AI Help/i }).first();
  if (await aiHelpBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await aiHelpBtn.click();
    await page.waitForTimeout(2000);

    const aiInput = page.getByPlaceholder(/ask for guidance/i).first();
    if (await aiInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await aiInput.pressSequentially('What should I investigate next?', { delay: 60 });
      await page.waitForTimeout(3000);
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  } else {
    const aiTab = page.getByRole('tab', { name: /ai/i });
    if (await aiTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await aiTab.click();
      await page.waitForTimeout(3000);
    }
  }

  // =========================================================================
  // SCENE 8 — Results / Dashboard overview
  // =========================================================================

  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1').filter({ hasText: 'Welcome back' })).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(3000);

  await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
  await page.waitForTimeout(2000);
});
