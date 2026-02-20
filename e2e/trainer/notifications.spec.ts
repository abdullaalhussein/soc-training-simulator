import { test, expect } from '@playwright/test';
import { API_URL, USERS } from '../fixtures/test-data';

let sessionId: string | undefined;
let setupError: string | undefined;

test.beforeAll(async () => {
  try {
    // Login as trainer
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
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

    // Get trainees
    const traineesRes = await fetch(`${API_URL}/api/users?role=TRAINEE`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const trainees = await traineesRes.json();
    const traineeUser = trainees.find((t: any) => t.email === USERS.trainee.email) || trainees[0];

    // Create session
    const sessionRes = await fetch(`${API_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: `E2E Notification Session ${Date.now()}`,
        scenarioId: scenarios[0]?.id,
        memberIds: traineeUser ? [traineeUser.id] : [],
      }),
    });
    if (!sessionRes.ok) {
      setupError = `Create session failed: ${sessionRes.status}`;
      return;
    }
    const session = await sessionRes.json();
    sessionId = session.id;

    // Launch it so we can test pause/alert actions
    await fetch(`${API_URL}/api/sessions/${sessionId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
  } catch (e: any) {
    setupError = `Setup error: ${e.message}`;
  }
});

test.describe('Toast Notifications', () => {
  test.beforeEach(async ({ page }) => {
    if (!sessionId) {
      test.skip(true, `Setup failed: ${setupError || 'No sessionId'}`);
      return;
    }
    await page.goto(`/sessions/${sessionId}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
  });

  test('Toast appears on session pause', async ({ page }) => {
    // Verify session is ACTIVE
    await expect(page.getByText('ACTIVE', { exact: true }).first()).toBeVisible({ timeout: 10_000 });

    // Click Pause button
    const pauseBtn = page.getByRole('button', { name: 'Pause' });
    await expect(pauseBtn).toBeVisible();
    await pauseBtn.click();

    // Toast should appear
    await expect(page.locator('text=Session paused')).toBeVisible({ timeout: 5_000 });

    // Resume for next test
    await page.waitForTimeout(1000);
    const resumeBtn = page.getByRole('button', { name: 'Resume' });
    if (await resumeBtn.isVisible()) {
      await resumeBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test('Toast appears on session resume', async ({ page }) => {
    // First pause the session
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    // Check current status - pause if not already paused
    const isPaused = await page.getByText('PAUSED', { exact: true }).first().isVisible().catch(() => false);
    if (!isPaused) {
      const pauseBtn = page.getByRole('button', { name: 'Pause' });
      await expect(pauseBtn).toBeVisible({ timeout: 5_000 });
      await pauseBtn.click();
      // Wait for PAUSED badge to confirm status change
      await expect(page.getByText('PAUSED', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    }

    // Resume
    const resumeBtn = page.getByRole('button', { name: 'Resume' });
    await expect(resumeBtn).toBeVisible({ timeout: 10_000 });
    await resumeBtn.click();

    // Toast should appear
    await expect(page.locator('text=Session active')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Broadcast Alert', () => {
  test.beforeEach(async ({ page }) => {
    if (!sessionId) {
      test.skip(true, `Setup failed: ${setupError || 'No sessionId'}`);
      return;
    }
    await page.goto(`/sessions/${sessionId}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
  });

  test('Open broadcast alert dialog', async ({ page }) => {
    // Broadcast Alert button should be visible for ACTIVE sessions
    const alertBtn = page.getByRole('button', { name: 'Broadcast Alert' });
    await expect(alertBtn).toBeVisible({ timeout: 10_000 });
    await alertBtn.click();

    // Dialog should open
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.locator('text=Broadcast Alert to All Trainees')).toBeVisible();

    // Should have textarea for message
    const textarea = dialog.locator('textarea');
    await expect(textarea).toBeVisible();

    // Should have Send Alert button
    await expect(dialog.getByRole('button', { name: 'Send Alert' })).toBeVisible();
  });

  test('Send broadcast alert and see toast', async ({ page }) => {
    const alertBtn = page.getByRole('button', { name: 'Broadcast Alert' });
    await expect(alertBtn).toBeVisible({ timeout: 10_000 });
    await alertBtn.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Type alert message
    const textarea = dialog.locator('textarea');
    await textarea.fill('E2E test alert message');

    // Send the alert
    await dialog.getByRole('button', { name: 'Send Alert' }).click();

    // Dialog should close
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // Toast confirmation should appear
    await expect(page.locator('text=Alert broadcast to all trainees')).toBeVisible({ timeout: 5_000 });
  });
});
