import { test, expect } from '@playwright/test';
import { API_URL, BASE_URL, USERS } from '../fixtures/test-data';

/**
 * Demo Recording Script — 7-scene walkthrough of the SOC Training Simulator.
 *
 * Run with:
 *   npx playwright test e2e/demo/demo-recording.spec.ts --project=demo --headed
 *
 * The resulting .webm video is saved to test-results/.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Login via API and inject auth into the browser's localStorage. */
async function loginViaUI(
  page: import('@playwright/test').Page,
  user: (typeof USERS)[keyof typeof USERS],
) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Type credentials visibly (character by character looks natural on video)
  await page.locator('#email').pressSequentially(user.email, { delay: 60 });
  await page.waitForTimeout(400);
  await page.locator('#password').pressSequentially(user.password, { delay: 60 });
  await page.waitForTimeout(800);

  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`**${user.defaultRoute}`, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
}

/** Login via API and set localStorage directly (fast, no UI). */
async function loginViaAPI(page: import('@playwright/test').Page, role: keyof typeof USERS) {
  const user = USERS[role];
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${role}: ${res.status}`);
  const data = await res.json();

  const origin = new URL(BASE_URL).origin;
  await page.goto('/login'); // need a page loaded before we can set storage
  await page.evaluate(
    ({ token, userData, origin: _origin }) => {
      localStorage.setItem('token', token);
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: { user: userData, token, isAuthenticated: true },
          version: 0,
        }),
      );
    },
    { token: data.token, userData: data.user, origin },
  );
  return data;
}

// ---------------------------------------------------------------------------
// Shared state set up in beforeAll
// ---------------------------------------------------------------------------

let sessionId: string;
let attemptId: string;
let traineeToken: string;

test.beforeAll(async () => {
  // 1. Login as trainer
  const trainerRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USERS.trainer.email, password: USERS.trainer.password }),
  });
  const trainerData = await trainerRes.json();
  const trainerToken = trainerData.token;

  // 2. Get scenarios
  const scenariosRes = await fetch(`${API_URL}/api/scenarios`, {
    headers: { Authorization: `Bearer ${trainerToken}` },
  });
  const scenarios = await scenariosRes.json();
  if (!scenarios?.length) throw new Error('No scenarios seeded — run npm run db:seed first');

  // 3. Get trainee user id
  const traineesRes = await fetch(`${API_URL}/api/users?role=TRAINEE`, {
    headers: { Authorization: `Bearer ${trainerToken}` },
  });
  const trainees = await traineesRes.json();
  const traineeUser = trainees.find((t: any) => t.email === USERS.trainee.email) || trainees[0];

  // 4. Create session with trainee assigned
  const sessionRes = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trainerToken}` },
    body: JSON.stringify({
      name: `Demo Session ${Date.now()}`,
      scenarioId: scenarios[0].id,
      memberIds: [traineeUser.id],
    }),
  });
  const session = await sessionRes.json();
  sessionId = session.id;

  // 5. Launch session
  await fetch(`${API_URL}/api/sessions/${sessionId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trainerToken}` },
    body: JSON.stringify({ status: 'ACTIVE' }),
  });

  // 6. Login as trainee and start attempt
  const traineeRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USERS.trainee.email, password: USERS.trainee.password }),
  });
  const traineeData = await traineeRes.json();
  traineeToken = traineeData.token;

  const attemptRes = await fetch(`${API_URL}/api/attempts/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${traineeToken}` },
    body: JSON.stringify({ sessionId }),
  });
  const attempt = await attemptRes.json();
  attemptId = attempt.id;
});

// ---------------------------------------------------------------------------
// Single continuous test — one video file with all 7 scenes
// ---------------------------------------------------------------------------

test('Demo walkthrough — 7 scenes', async ({ page }) => {
  test.setTimeout(180_000); // 3 minutes max

  // =========================================================================
  // SCENE 1 — Login Page (Trainer login with visible typing)
  // =========================================================================
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'SOC Training Simulator' })).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(3000); // showcase login UI

  // Type trainer credentials visibly
  await page.locator('#email').pressSequentially(USERS.trainer.email, { delay: 80 });
  await page.waitForTimeout(500);
  await page.locator('#password').pressSequentially(USERS.trainer.password, { delay: 80 });
  await page.waitForTimeout(1000);

  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/console', { timeout: 15_000 });
  await page.waitForLoadState('networkidle');

  // =========================================================================
  // SCENE 2 — Trainer Console
  // =========================================================================
  await expect(page.locator('h1').filter({ hasText: 'Trainer Console' })).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(3000); // showcase console

  // Open the Create Session dialog
  await page.getByRole('button', { name: 'Create Session' }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await page.waitForTimeout(1500);

  // Fill session name
  const sessionNameInput = page.locator('[role="dialog"]').getByPlaceholder('e.g., Cohort 5 - Week 3');
  await sessionNameInput.pressSequentially('Onboarding — Week 1', { delay: 60 });
  await page.waitForTimeout(800);

  // Open scenario dropdown and select first option
  const scenarioTrigger = page.locator('[role="dialog"]').locator('button').filter({ hasText: 'Select scenario' });
  if (await scenarioTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
    await scenarioTrigger.click();
    await page.waitForTimeout(800);
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(1000);
  }

  await page.waitForTimeout(2000); // pause on the filled form

  // Close dialog without creating (just showcasing the form)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2000); // final pause on console

  // =========================================================================
  // SCENE 3 — Trainee Dashboard (re-login as trainee)
  // =========================================================================

  // Clear auth and login as trainee via UI
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Clear previous input values
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
  await page.waitForTimeout(3000); // showcase dashboard stats

  // Scroll down to show session cards
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
  await page.waitForTimeout(2000);

  // =========================================================================
  // SCENE 4 — Investigation Workspace
  // =========================================================================

  // Navigate directly to the attempt (created in beforeAll)
  await loginViaAPI(page, 'trainee');
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

  // Click a log row to open detail view
  const firstRow = page.locator('tbody tr').first();
  if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
    await firstRow.click();
    await page.waitForTimeout(2500);

    // Close detail dialog/panel (press Escape)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }

  // Type in search bar to filter logs
  const searchInput = page.getByPlaceholder(/search/i).first();
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.pressSequentially('suspicious', { delay: 80 });
    await page.waitForTimeout(2500);

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(1000);
  }

  // =========================================================================
  // SCENE 5 — Checkpoints
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
      // Select an answer option
      const option = modal
        .locator('button, [role="radio"], label')
        .filter({ hasText: /.+/ })
        .first();
      if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
        await option.click();
        await page.waitForTimeout(1000);
      }

      // Submit answer
      const submitBtn = modal.getByRole('button', { name: /submit/i });
      if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(3000); // pause on result (Correct/Incorrect + Explanation)
      }

      // Close checkpoint modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }
  } else {
    // No checkpoint button visible — pause briefly and move on
    await page.waitForTimeout(2000);
  }

  // =========================================================================
  // SCENE 6 — SOC Mentor (AI Assistant)
  // =========================================================================

  // Open the AI Help sheet (floating button on desktop)
  const aiHelpBtn = page.getByRole('button', { name: /AI Help/i }).first();
  if (await aiHelpBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await aiHelpBtn.click();
    await page.waitForTimeout(2000);

    // Type a question
    const aiInput = page.getByPlaceholder(/ask for guidance/i).first();
    if (await aiInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await aiInput.pressSequentially('What should I investigate next?', { delay: 60 });
      await page.waitForTimeout(3000); // showcase the SOC Mentor UI
    }

    // Close the sheet
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  } else {
    // Fallback: try clicking an AI-related tab (mobile layout)
    const aiTab = page.getByRole('tab', { name: /ai/i });
    if (await aiTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await aiTab.click();
      await page.waitForTimeout(3000);
    }
  }

  // =========================================================================
  // SCENE 7 — Results / Dashboard overview
  // =========================================================================

  // Navigate back to the trainee dashboard to show overall progress
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1').filter({ hasText: 'Welcome back' })).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(3000); // final showcase

  // Scroll to show session cards one more time
  await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
  await page.waitForTimeout(2000);
});
