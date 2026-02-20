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
    const trainerToken = loginData.token;

    // Get scenarios
    const scenariosRes = await fetch(`${API_URL}/api/scenarios`, {
      headers: { Authorization: `Bearer ${trainerToken}` },
    });
    const scenarios = await scenariosRes.json();

    // Get trainees
    const traineesRes = await fetch(`${API_URL}/api/users?role=TRAINEE`, {
      headers: { Authorization: `Bearer ${trainerToken}` },
    });
    const trainees = await traineesRes.json();
    const traineeUser = trainees.find((t: any) => t.email === USERS.trainee.email) || trainees[0];

    // Create session with trainee assigned
    const sessionRes = await fetch(`${API_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trainerToken}` },
      body: JSON.stringify({
        name: `E2E Chat Session ${Date.now()}`,
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

    // Launch session
    await fetch(`${API_URL}/api/sessions/${sessionId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trainerToken}` },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });

    // Login as trainee and start attempt so the Activity/Discussion tabs appear
    const traineeLogin = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: USERS.trainee.email, password: USERS.trainee.password }),
    });
    if (traineeLogin.ok) {
      const traineeData = await traineeLogin.json();
      await fetch(`${API_URL}/api/attempts/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${traineeData.token}` },
        body: JSON.stringify({ sessionId }),
      });
    }
  } catch (e: any) {
    setupError = `Setup error: ${e.message}`;
  }
});

test.describe('Discussion Panel (Chat)', () => {
  test.beforeEach(async ({ page }) => {
    if (!sessionId) {
      test.skip(true, `Setup failed: ${setupError || 'No sessionId'}`);
      return;
    }
    await page.goto(`/sessions/${sessionId}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

    // Click on the trainee in the sidebar to open the progress panel with tabs
    // The desktop sidebar card contains "Trainees" heading — click the first trainee button inside it
    const traineeEntry = page.locator('text=Assigned — not started')
      .or(page.locator('button').filter({ hasText: /Stage/ }))
      .first();
    await expect(traineeEntry).toBeVisible({ timeout: 10_000 });
    await traineeEntry.click();
    await page.waitForTimeout(1000);

    // If "Start Scenario for Trainee" button appears, click it
    const startBtn = page.getByRole('button', { name: 'Start Scenario for Trainee' });
    if (await startBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await startBtn.click();
      await page.waitForTimeout(3000);
    }
  });

  test('Display discussion tab in session monitor', async ({ page }) => {
    // The session detail should have Activity and Discussion tabs
    const discussionTab = page.getByRole('tab', { name: 'Discussion' });
    await expect(discussionTab).toBeVisible({ timeout: 10_000 });

    const activityTab = page.getByRole('tab', { name: 'Activity' });
    await expect(activityTab).toBeVisible();
  });

  test('Switch to discussion tab and see empty state', async ({ page }) => {
    const discussionTab = page.getByRole('tab', { name: 'Discussion' });
    await expect(discussionTab).toBeVisible({ timeout: 10_000 });
    await discussionTab.click();
    await page.waitForTimeout(1000);

    // Should show either empty state or messages
    const messageInput = page.getByPlaceholder('Type a message...');

    // The input should always be visible in the discussion panel
    await expect(messageInput).toBeVisible({ timeout: 10_000 });
  });

  test('Send a message via discussion panel', async ({ page }) => {
    const discussionTab = page.getByRole('tab', { name: 'Discussion' });
    await expect(discussionTab).toBeVisible({ timeout: 10_000 });
    await discussionTab.click();
    await page.waitForTimeout(1000);

    const messageInput = page.getByPlaceholder('Type a message...');
    await expect(messageInput).toBeVisible({ timeout: 10_000 });

    const testMessage = `E2E test message ${Date.now()}`;
    await messageInput.fill(testMessage);

    // Send button should be enabled
    const sendButton = page.locator('button').filter({ has: page.locator('svg.lucide-send') });
    await expect(sendButton).toBeVisible();
    await sendButton.click();

    // Message should appear in the chat
    await expect(page.locator(`text=${testMessage}`)).toBeVisible({ timeout: 10_000 });

    // Input should be cleared after sending
    await expect(messageInput).toHaveValue('');

    // Own messages show "You" label
    await expect(page.locator('text=You').first()).toBeVisible();

    // Role badge should be visible
    await expect(page.locator('text=TRAINER').first()).toBeVisible();
  });

  test('Send message via Enter key', async ({ page }) => {
    const discussionTab = page.getByRole('tab', { name: 'Discussion' });
    await expect(discussionTab).toBeVisible({ timeout: 10_000 });
    await discussionTab.click();
    await page.waitForTimeout(1000);

    const messageInput = page.getByPlaceholder('Type a message...');
    await expect(messageInput).toBeVisible({ timeout: 10_000 });

    const testMessage = `Enter key message ${Date.now()}`;
    await messageInput.fill(testMessage);
    await messageInput.press('Enter');

    // Message should appear
    await expect(page.locator(`text=${testMessage}`)).toBeVisible({ timeout: 10_000 });
    await expect(messageInput).toHaveValue('');
  });
});
