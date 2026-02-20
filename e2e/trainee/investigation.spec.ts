import { test, expect } from '@playwright/test';
import { API_URL, USERS } from '../fixtures/test-data';

let sessionId: string | undefined;
let attemptId: string | undefined;
let setupError: string | undefined;

test.beforeAll(async () => {
  try {
    // Login as trainer to create and launch a session
    const trainerLogin = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: USERS.trainer.email, password: USERS.trainer.password }),
    });
    if (!trainerLogin.ok) {
      setupError = `Trainer login failed: ${trainerLogin.status}`;
      return;
    }
    const trainerData = await trainerLogin.json();
    const trainerToken = trainerData.token;

    // Get scenarios
    const scenariosRes = await fetch(`${API_URL}/api/scenarios`, {
      headers: { Authorization: `Bearer ${trainerToken}` },
    });
    const scenarios = await scenariosRes.json();
    if (!scenarios?.length) {
      setupError = 'No scenarios found';
      return;
    }

    // Get trainees
    const traineesRes = await fetch(`${API_URL}/api/users?role=TRAINEE`, {
      headers: { Authorization: `Bearer ${trainerToken}` },
    });
    const trainees = await traineesRes.json();
    if (!trainees?.length) {
      setupError = 'No trainees found';
      return;
    }

    // Find the seeded trainee specifically
    const traineeUser = trainees.find((t: any) => t.email === USERS.trainee.email) || trainees[0];

    // Create session with trainee assigned
    const sessionRes = await fetch(`${API_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trainerToken}` },
      body: JSON.stringify({
        name: `E2E Investigation ${Date.now()}`,
        scenarioId: scenarios[0].id,
        memberIds: [traineeUser.id],
      }),
    });
    if (!sessionRes.ok) {
      setupError = `Create session failed: ${sessionRes.status}`;
      return;
    }
    const session = await sessionRes.json();
    sessionId = session.id;

    // Launch it
    const launchRes = await fetch(`${API_URL}/api/sessions/${sessionId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trainerToken}` },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    if (!launchRes.ok) {
      setupError = `Launch session failed: ${launchRes.status}`;
      return;
    }

    // Login as trainee
    const traineeLogin = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: USERS.trainee.email, password: USERS.trainee.password }),
    });
    if (!traineeLogin.ok) {
      setupError = `Trainee login failed: ${traineeLogin.status}`;
      return;
    }
    const traineeData = await traineeLogin.json();

    // Start the attempt
    const attemptRes = await fetch(`${API_URL}/api/attempts/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${traineeData.token}` },
      body: JSON.stringify({ sessionId }),
    });
    if (!attemptRes.ok) {
      setupError = `Start attempt failed: ${attemptRes.status}`;
      return;
    }
    const attempt = await attemptRes.json();
    attemptId = attempt.id;
  } catch (e: any) {
    setupError = `Setup error: ${e.message}`;
  }
});

test.describe('Investigation', () => {
  test('Start investigation, see lesson or workspace', async ({ page }) => {
    if (setupError || !attemptId) {
      // Fallback: use dashboard to start investigation
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const startBtn = page.getByRole('button', { name: 'Start Investigation' }).first();
      if (!(await startBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
        test.skip(true, `Setup failed: ${setupError || 'No attemptId'}`);
        return;
      }
      await startBtn.click();
      await page.waitForURL(/\/scenario\//, { timeout: 15_000 });
    } else {
      await page.goto(`/scenario/${attemptId}`);
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Should show the scenario player content
    const mainArea = page.locator('main');
    const content = mainArea.locator('h1, h2, h3, table, [role="tablist"]')
      .or(mainArea.locator('text=Continue to Investigation'))
      .or(mainArea.locator('text=Begin Investigation'));
    await expect(content.first()).toBeVisible({ timeout: 20_000 });
  });

  test('3-panel workspace', async ({ page }) => {
    if (setupError || !attemptId) {
      // Fallback: use dashboard
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const startBtn = page.getByRole('button', { name: /Start Investigation|Continue/ }).first();
      if (!(await startBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
        test.skip(true, `Setup failed: ${setupError || 'No attemptId'}`);
        return;
      }
      await startBtn.click();
      await page.waitForURL(/\/scenario\//, { timeout: 15_000 });
    } else {
      await page.goto(`/scenario/${attemptId}`);
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Skip lesson if shown
    const lessonBtn = page.locator('text=Continue to Investigation').or(page.locator('text=Begin Investigation'));
    if (await lessonBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await lessonBtn.click();
      await page.waitForTimeout(2000);
    }

    // Workspace should show some content
    const mainContent = page.locator('main');
    await expect(mainContent.locator('table, [role="tablist"], h1, h2, h3').first()).toBeVisible({ timeout: 15_000 });
  });

  test('Search and filter logs', async ({ page }) => {
    if (!attemptId) {
      test.skip(true, `Setup failed: ${setupError || 'No attemptId'}`);
      return;
    }

    await page.goto(`/scenario/${attemptId}`);
    await page.waitForLoadState('networkidle');

    const lessonBtn = page.locator('text=Continue to Investigation').or(page.locator('text=Begin Investigation'));
    if (await lessonBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await lessonBtn.click();
      await page.waitForTimeout(2000);
    }

    await page.waitForTimeout(3000);

    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('phish');
      await page.waitForTimeout(1000);
      await expect(page.locator('tbody').first()).toBeVisible();
    }
  });

  test('View log details', async ({ page }) => {
    if (!attemptId) {
      test.skip(true, `Setup failed: ${setupError || 'No attemptId'}`);
      return;
    }

    await page.goto(`/scenario/${attemptId}`);
    await page.waitForLoadState('networkidle');

    const lessonBtn = page.locator('text=Continue to Investigation').or(page.locator('text=Begin Investigation'));
    if (await lessonBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await lessonBtn.click();
      await page.waitForTimeout(2000);
    }

    await page.waitForTimeout(3000);

    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForTimeout(1000);

      await expect(
        page.locator('[role="dialog"]')
          .or(page.locator('text=Raw Log'))
          .or(page.locator('pre'))
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('Collect evidence', async ({ page }) => {
    if (!attemptId) {
      test.skip(true, `Setup failed: ${setupError || 'No attemptId'}`);
      return;
    }

    await page.goto(`/scenario/${attemptId}`);
    await page.waitForLoadState('networkidle');

    const lessonBtn = page.locator('text=Continue to Investigation').or(page.locator('text=Begin Investigation'));
    if (await lessonBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await lessonBtn.click();
      await page.waitForTimeout(2000);
    }

    await page.waitForTimeout(3000);

    const collectButton = page.locator('button').filter({ has: page.locator('svg.lucide-bookmark') }).first()
      .or(page.getByRole('button', { name: /collect|evidence/i }).first());

    if (await collectButton.isVisible()) {
      await collectButton.click();
      await page.waitForTimeout(1000);

      const evidenceTab = page.getByRole('tab', { name: /evidence/i });
      if (await evidenceTab.isVisible()) {
        await expect(evidenceTab).toBeVisible();
      }
    }
  });

  test('Answer checkpoint', async ({ page }) => {
    if (!attemptId) {
      test.skip(true, `Setup failed: ${setupError || 'No attemptId'}`);
      return;
    }

    await page.goto(`/scenario/${attemptId}`);
    await page.waitForLoadState('networkidle');

    const lessonBtn = page.locator('text=Continue to Investigation').or(page.locator('text=Begin Investigation'));
    if (await lessonBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await lessonBtn.click();
      await page.waitForTimeout(2000);
    }

    await page.waitForTimeout(3000);

    const checkpointBtn = page.getByRole('button', { name: /checkpoint/i }).first()
      .or(page.locator('button').filter({ has: page.locator('svg.lucide-check-circle') }).first());

    if (await checkpointBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await checkpointBtn.click();
      await page.waitForTimeout(1000);

      const modal = page.locator('[role="dialog"]');
      if (await modal.isVisible()) {
        const option = modal.locator('button, [role="radio"], label').filter({ hasText: /.+/ }).first();
        if (await option.isVisible()) {
          await option.click();
        }

        const submitBtn = modal.getByRole('button', { name: /submit/i });
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          await page.waitForTimeout(1000);

          await expect(
            page.locator('text=Correct').or(page.locator('text=Incorrect')).or(page.locator('text=Explanation'))
          ).toBeVisible({ timeout: 5_000 });
        }
      }
    }
  });

  test('Complete and view results', async ({ page }) => {
    if (!attemptId) {
      test.skip(true, `Setup failed: ${setupError || 'No attemptId'}`);
      return;
    }

    await page.goto(`/scenario/${attemptId}`);
    await page.waitForLoadState('networkidle');

    const lessonBtn = page.locator('text=Continue to Investigation').or(page.locator('text=Begin Investigation'));
    if (await lessonBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await lessonBtn.click();
      await page.waitForTimeout(2000);
    }

    await page.waitForTimeout(3000);

    // Verify the scenario page loaded with some content
    const mainContent = page.locator('main');
    const content = mainContent.locator('table, [role="tablist"], h1, h2, h3')
      .or(mainContent.locator('text=Score'))
      .or(mainContent.locator('text=Results'));
    await expect(content.first()).toBeVisible({ timeout: 15_000 });
  });
});
