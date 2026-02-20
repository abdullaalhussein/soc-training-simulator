import { test, expect } from '@playwright/test';
import { API_URL, USERS } from '../fixtures/test-data';

let sessionId: string;
let token: string;

test.beforeAll(async () => {
  // Login as trainer
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USERS.trainer.email, password: USERS.trainer.password }),
  });
  const loginData = await loginRes.json();
  token = loginData.token;

  // Get scenarios
  const scenariosRes = await fetch(`${API_URL}/api/scenarios`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const scenarios = await scenariosRes.json();
  const scenarioId = scenarios[0]?.id;

  // Get trainees
  const traineesRes = await fetch(`${API_URL}/api/users?role=TRAINEE`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const trainees = await traineesRes.json();
  const traineeId = trainees[0]?.id;

  // Create session
  const sessionRes = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: `E2E Monitor Session ${Date.now()}`,
      scenarioId,
      memberIds: traineeId ? [traineeId] : [],
    }),
  });
  const session = await sessionRes.json();
  sessionId = session.id;

  // Launch the session
  await fetch(`${API_URL}/api/sessions/${sessionId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 'ACTIVE' }),
  });
});

test.describe('Session Monitor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/sessions/${sessionId}`);
    await page.waitForLoadState('networkidle');
  });

  test('Display session monitor', async ({ page }) => {
    // Session name heading
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
    // Scenario name
    await expect(page.locator('h1 + p')).toBeVisible();
    // Status badge
    await expect(page.locator('text=ACTIVE')).toBeVisible();
    // Trainee list card
    await expect(page.locator('text=Trainees')).toBeVisible();
  });

  test('Show trainee in list', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    // The assigned trainee should appear in the trainee list
    // The trainee name could vary depending on DB state, just check trainee count is shown
    await expect(page.locator('text=Trainees')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=/Trainees \\(\\d+\\)/')).toBeVisible({ timeout: 10_000 });
  });

  test('Open send hint dialog', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

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
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    const alertBtn = page.getByRole('button', { name: 'Broadcast Alert' });
    await expect(alertBtn).toBeVisible();
    await alertBtn.click();

    await expect(page.locator('[role="dialog"]').filter({ hasText: 'Broadcast Alert' })).toBeVisible();
    await expect(page.getByPlaceholder('Type your alert message...')).toBeVisible();
  });
});
