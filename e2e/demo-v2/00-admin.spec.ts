import { test, expect } from '@playwright/test';
import { loginAs, injectAuth } from './helpers';

/**
 * Demo V2 — Act 1: Admin quick overview (~35s).
 *
 * Story: An admin navigates through scenario management, AI generation,
 * import options, audit logs, and user management.
 *
 * Run with:
 *   npx playwright test --project=demo-v2 e2e/demo-v2/00-admin.spec.ts --headed
 */

let adminToken: string;
let adminUser: any;

test.beforeAll(async ({}, testInfo) => {
  testInfo.setTimeout(120_000);
  const auth = await loginAs('admin');
  adminToken = auth.token;
  adminUser = auth.user;
});

test('Act 1 — Admin overview', async ({ page }) => {
  test.setTimeout(300_000);
  await injectAuth(page, adminUser, adminToken);

  // =========================================================================
  // SCENE 1 — Scenario Management
  // =========================================================================
  await page.goto('/scenarios');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1').filter({ hasText: /scenario/i })).toBeVisible({
    timeout: 15_000,
  });
  // Pause — show the 13 scenario cards
  await page.waitForTimeout(1500);

  // Click "Generate with AI" if available
  const generateAiBtn = page.getByRole('button', { name: /generate.*ai/i }).first();
  if (await generateAiBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await generateAiBtn.click();
    await page.waitForTimeout(1500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // Click "Import Scenario" if available
  const importBtn = page.getByRole('button', { name: /import.*scenario/i }).first();
  if (await importBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await importBtn.click();
    await page.waitForTimeout(1000);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // Show "Download Template" briefly if visible
  const downloadBtn = page.getByRole('button', { name: /download.*template/i }).first();
  if (await downloadBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await downloadBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
  }

  // =========================================================================
  // SCENE 2 — Audit Log
  // =========================================================================
  await page.goto('/audit');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // =========================================================================
  // SCENE 3 — User Management
  // =========================================================================
  await page.goto('/users');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Click "Add User" dialog
  const addUserBtn = page.getByRole('button', { name: /add.*user/i }).first();
  if (await addUserBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addUserBtn.click();
    await page.waitForTimeout(1500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // Final pause
  await page.waitForTimeout(1000);
});
