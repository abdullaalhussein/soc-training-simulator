import { test, expect } from '@playwright/test';
import { API_URL, USERS } from '../fixtures/test-data';

/**
 * Demo Recording — Trainee role.
 *
 * Story: A trainee opens their dashboard, sees an active session assigned by
 * their trainer, clicks "Start Investigation", reads the scenario briefing,
 * then investigates — examining logs, collecting evidence, answering a
 * checkpoint, and consulting the AI-powered SOC Mentor for guidance.
 *
 * Run with:
 *   npx playwright test e2e/demo/02-trainee.spec.ts --project=demo --headed
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

let traineeToken: string;
let traineeUser: any;

test.beforeAll(async ({}, testInfo) => {
  testInfo.setTimeout(120_000);

  // 1. Login as trainer to set up the session
  const trainerRes = await fetchWithRetry(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USERS.trainer.email, password: USERS.trainer.password }),
  });
  if (!trainerRes.ok) throw new Error(`Trainer login failed: ${trainerRes.status}`);
  const trainerData = await trainerRes.json();
  const trainerToken = trainerData.token;

  // 2. Clean up all existing sessions (leftover from 01-trainer)
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

  // 3. Get scenarios
  const scenariosRes = await fetch(`${API_URL}/api/scenarios`, {
    headers: { Authorization: `Bearer ${trainerToken}` },
  });
  const scenarios = await scenariosRes.json();
  if (!scenarios?.length) throw new Error('No scenarios seeded — run npm run db:seed first');

  // 4. Get trainee user
  const traineesRes = await fetch(`${API_URL}/api/users?role=TRAINEE`, {
    headers: { Authorization: `Bearer ${trainerToken}` },
  });
  const trainees = await traineesRes.json();
  const trainee = trainees.find((t: any) => t.email === USERS.trainee.email) || trainees[0];

  // 5. Create a session and launch it
  const sessionRes = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trainerToken}` },
    body: JSON.stringify({
      name: 'Onboarding — Week 1',
      scenarioId: scenarios[0].id,
      memberIds: [trainee.id],
    }),
  });
  const session = await sessionRes.json();

  await fetch(`${API_URL}/api/sessions/${session.id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trainerToken}` },
    body: JSON.stringify({ status: 'ACTIVE' }),
  });

  // 6. Login as trainee (don't start attempt — trainee will click "Start Investigation")
  const traineeLoginRes = await fetchWithRetry(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USERS.trainee.email, password: USERS.trainee.password }),
  });
  if (!traineeLoginRes.ok) throw new Error(`Trainee login failed: ${traineeLoginRes.status}`);
  const traineeData = await traineeLoginRes.json();
  traineeToken = traineeData.token;
  traineeUser = traineeData.user;
});

// ---------------------------------------------------------------------------
// Trainee demo
// ---------------------------------------------------------------------------

test('Trainee demo', async ({ page }) => {
  test.setTimeout(300_000);

  // Inject trainee auth via localStorage (use addInitScript so it's set before any page loads)
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
    { user: traineeUser, token: traineeToken }
  );

  // =========================================================================
  // SCENE 1 — Trainee Dashboard: see assigned sessions
  // =========================================================================
  // Navigate directly — no login page flash
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1').filter({ hasText: 'Welcome back' })).toBeVisible({
    timeout: 15_000,
  });
  // Pause — let viewer see the dashboard stats
  await page.waitForTimeout(3000);

  // Scroll down to show the active session card
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
  await page.waitForTimeout(2000);

  // Click "Start Investigation" — the natural trainee action
  const startBtn = page.getByRole('button', { name: /Start Investigation/i }).first();
  await expect(startBtn).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(1500);
  await startBtn.click();

  // Wait for navigation to the scenario page
  await page.waitForURL('**/scenario/**', { timeout: 15_000 });
  await page.waitForLoadState('networkidle');

  // =========================================================================
  // SCENE 2 — Scenario Briefing: read what you're investigating
  // =========================================================================
  // Pause on the briefing/lesson page so the viewer sees the scenario context
  await page.waitForTimeout(5000);

  // Click through to the investigation
  const lessonBtn = page
    .locator('text=Continue to Investigation')
    .or(page.locator('text=Begin Investigation'));
  if (await lessonBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await lessonBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  }

  // =========================================================================
  // SCENE 3 — Investigation Workspace: logs, evidence collection
  // =========================================================================
  // Pause — let viewer see the full 3-panel workspace
  await page.waitForTimeout(4000);

  // Click first log row to expand detail view
  const firstRow = page.locator('tbody tr').first();
  if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
    await firstRow.click();
    await page.waitForTimeout(3000);

    // Add to Evidence from the detail modal
    const addEvidenceModalBtn = page
      .locator('[role="dialog"]')
      .getByRole('button', { name: /Add to Evidence/i });
    if (await addEvidenceModalBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addEvidenceModalBtn.click();
      await page.waitForTimeout(2000);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  }

  // Add more evidence using inline Plus buttons
  const addEvidenceBtns = page.locator('button[title="Add to Evidence"]');
  const btnCount = await addEvidenceBtns.count();
  for (let i = 0; i < Math.min(2, btnCount); i++) {
    const btn = addEvidenceBtns.nth(i);
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1500);
    }
  }

  // Switch to Evidence tab to show what was collected
  const evidenceTab = page.getByRole('tab', { name: /evidence/i });
  if (await evidenceTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await evidenceTab.click();
    await page.waitForTimeout(3000);
  }

  // Switch back to logs and search
  const logsTab = page.getByRole('tab', { name: /logs/i }).or(page.getByRole('tab', { name: /feed/i }));
  if (await logsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logsTab.click();
    await page.waitForTimeout(1000);
  }

  // Search logs — scroll into view so the viewer sees the typed query
  const searchInput = page.getByPlaceholder(/search/i).first();
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await searchInput.pressSequentially('suspicious', { delay: 100 });
    // Pause — let viewer see the filtered results
    await page.waitForTimeout(3000);
    await searchInput.fill('');
    await page.waitForTimeout(1000);
  }

  // =========================================================================
  // SCENE 4 — Checkpoint: answer an investigation question
  // =========================================================================
  // The checkpoint button is in the right sidebar or the header
  const checkpointBtn = page
    .getByRole('button', { name: /checkpoint/i })
    .first()
    .or(page.locator('button').filter({ has: page.locator('svg.lucide-check-circle') }).first());

  if (await checkpointBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await checkpointBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await checkpointBtn.click();
    await page.waitForTimeout(2000);

    const modal = page.locator('[role="dialog"]');
    if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Pause — let viewer read the checkpoint question
      await page.waitForTimeout(2000);

      const option = modal
        .locator('button, [role="radio"], label')
        .filter({ hasText: /.+/ })
        .first();
      if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
        await option.scrollIntoViewIfNeeded();
        await option.click();
        await page.waitForTimeout(1500);
      }

      const submitBtn = modal.getByRole('button', { name: /submit/i });
      if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitBtn.scrollIntoViewIfNeeded();
        await submitBtn.click();
        // Pause — let viewer see the result feedback
        await page.waitForTimeout(4000);
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }
  } else {
    await page.waitForTimeout(2000);
  }

  // =========================================================================
  // SCENE 5 — SOC Mentor: ask the AI for guidance
  // =========================================================================
  const aiHelpBtn = page.getByRole('button', { name: /AI Help/i }).first();
  if (await aiHelpBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await aiHelpBtn.click();
    // Pause — let viewer see the SOC Mentor panel open with its description
    await page.waitForTimeout(3000);

    // Scroll the input into view inside the sheet
    const aiInput = page.getByPlaceholder(/ask for guidance/i).first();
    if (await aiInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await aiInput.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await aiInput.pressSequentially('What should I investigate next?', { delay: 80 });
      // Pause — let viewer read the typed question
      await page.waitForTimeout(4000);
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
  // SCENE 6 — Dashboard return: see progress
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
