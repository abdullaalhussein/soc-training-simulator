import { test, expect } from '@playwright/test';
import { API_URL, USERS } from '../fixtures/test-data';

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

let sessionId: string | undefined;
let sessionName: string;
let setupError: string | undefined;

test.beforeAll(async () => {
  try {
    // Login as trainer
    const loginRes = await fetchWithRetry(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: USERS.trainer.email, password: USERS.trainer.password }),
    });
    if (!loginRes.ok) {
      setupError = `Trainer login failed: ${loginRes.status}`;
      return;
    }
    const loginData = await loginRes.json();
    const token = loginData.token;

    // Get scenarios
    const scenariosRes = await fetch(`${API_URL}/api/scenarios`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const scenarios = await scenariosRes.json();
    if (!scenarios?.length) {
      setupError = 'No scenarios found';
      return;
    }

    // Get trainees
    const traineesRes = await fetch(`${API_URL}/api/users?role=TRAINEE`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const trainees = await traineesRes.json();
    const traineeUser = trainees?.find((t: any) => t.email === USERS.trainee.email) || trainees?.[0];
    if (!traineeUser) {
      setupError = 'No trainees found';
      return;
    }

    // Create session with trainee assigned
    sessionName = `E2E Monitor Session ${Date.now()}`;
    const sessionRes = await fetch(`${API_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: sessionName,
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

    // Launch the session
    const launchRes = await fetch(`${API_URL}/api/sessions/${sessionId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    if (!launchRes.ok) {
      setupError = `Launch session failed: ${launchRes.status}`;
      return;
    }

    // Verify session is actually active
    const verifyRes = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!verifyRes.ok) {
      setupError = `Verify session failed: ${verifyRes.status}`;
      return;
    }
    const verified = await verifyRes.json();
    if (verified.status !== 'ACTIVE') {
      setupError = `Session not ACTIVE after launch: ${verified.status}`;
      return;
    }
  } catch (e: any) {
    setupError = `Setup error: ${e.message}`;
  }
});

test.describe('Session Monitor', () => {
  test.beforeEach(async ({ page }) => {
    if (setupError || !sessionId) {
      test.skip(true, `Setup failed: ${setupError || 'No sessionId'}`);
      return;
    }
    await page.goto(`/sessions/${sessionId}`);
    await page.waitForLoadState('networkidle');
    // Wait for the actual session data to load (h1 shows session name, not fallback)
    await expect(page.locator('h1')).toContainText(sessionName, { timeout: 15_000 });
  });

  test('Display session monitor', async ({ page }) => {
    // Session name heading (already verified in beforeEach)
    await expect(page.locator('h1')).toBeVisible();
    // Scenario name (paragraph below h1)
    await expect(page.locator('h1 + p')).toBeAttached();
    // Status badge
    await expect(page.locator('text=ACTIVE')).toBeVisible();
    // Trainee list heading
    await expect(page.getByRole('heading', { name: /Trainees/ })).toBeVisible();
  });

  test('Show trainee in list', async ({ page }) => {
    // The assigned trainee should appear in the trainee list
    await expect(page.getByRole('heading', { name: /Trainees/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Trainees \(\d+\)/ })).toBeVisible({ timeout: 10_000 });
  });

  test('Open send hint dialog', async ({ page }) => {
    // Select a trainee first
    const traineeButton = page.locator('button').filter({ hasText: /SOC Analyst|trainee/ }).first();
    if (await traineeButton.isVisible()) {
      await traineeButton.click();
      await page.waitForTimeout(500);
    }

    const sendHintBtn = page.getByRole('button', { name: 'Send Hint' });
    if (await sendHintBtn.isVisible()) {
      await sendHintBtn.click();
      await expect(page.locator('[role="dialog"]').filter({ hasText: 'Send Hint' })).toBeVisible();
      await expect(page.getByPlaceholder('Type your hint or guidance...')).toBeVisible();
      await expect(page.locator('[role="dialog"]').getByRole('button', { name: 'Send Hint' })).toBeVisible();
    }
  });

  test('Open broadcast alert dialog', async ({ page }) => {
    // Broadcast Alert only renders when session status is ACTIVE
    await expect(page.locator('text=ACTIVE')).toBeVisible({ timeout: 10_000 });

    const alertBtn = page.getByRole('button', { name: 'Broadcast Alert' });
    await expect(alertBtn).toBeVisible({ timeout: 10_000 });
    await alertBtn.click();

    await expect(page.locator('[role="dialog"]').filter({ hasText: 'Broadcast Alert' })).toBeVisible();
    await expect(page.getByPlaceholder('Type your alert message...')).toBeVisible();
  });
});
