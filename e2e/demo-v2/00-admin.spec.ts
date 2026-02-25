import { test, expect } from '@playwright/test';
import { loginAs, injectAuth, hideNonDemoUsers } from './helpers';

/**
 * Demo V3 — Act 1: Admin scenario creation + AI gen + audit + users (~15s).
 *
 * Story: An admin creates a scenario with AI generation, views import/template
 * options, checks audit logs, and manages users (non-default users hidden).
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

test('Act 1 — Admin scenario creation', async ({ page }) => {
  test.setTimeout(300_000);
  await injectAuth(page, adminUser, adminToken);

  // =========================================================================
  // SCENE 1 — Navigate to scenarios, show list briefly
  // =========================================================================
  await page.goto('/scenarios');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1').filter({ hasText: /scenario/i })).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(1000);

  // Click "Create Scenario" / "New Scenario" / "Generate with AI" button → dialog opens
  const createBtn = page
    .getByRole('button', { name: /create.*scenario|new.*scenario|generate.*ai/i })
    .first();
  if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await createBtn.click();
    await page.waitForTimeout(800);

    // =========================================================================
    // SCENE 2 — AI Generation: type description, trigger AI
    // =========================================================================
    // Find the description textarea/input in the dialog
    const descriptionInput = page
      .locator('[role="dialog"]')
      .locator('textarea, input[type="text"]')
      .first();
    if (await descriptionInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await descriptionInput.pressSequentially(
        'Detect lateral movement via Kerberoasting in Active Directory environment',
        { delay: 60 }
      );
      await page.waitForTimeout(800);

      // Click Generate/Preview if available
      const generateBtn = page
        .locator('[role="dialog"]')
        .getByRole('button', { name: /generate|preview|create/i })
        .first();
      if (await generateBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await generateBtn.click();
        await page.waitForTimeout(1500);
      }
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // Click "Import Scenario" button → show import dialog briefly
  const importBtn = page.getByRole('button', { name: /import.*scenario/i }).first();
  if (await importBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await importBtn.click();
    await page.waitForTimeout(800);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // =========================================================================
  // SCENE 3 — Audit Log (hide non-demo user entries)
  // =========================================================================
  await page.goto('/audit');
  await page.waitForLoadState('networkidle');
  await hideNonDemoUsers(page);
  await page.waitForTimeout(1500);

  // =========================================================================
  // SCENE 4 — User Management (hide non-demo users)
  // =========================================================================
  await page.goto('/users');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  await hideNonDemoUsers(page);
  await page.waitForTimeout(800);

  // Click "Add User" dialog briefly
  const addUserBtn = page.getByRole('button', { name: /add.*user/i }).first();
  if (await addUserBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await addUserBtn.click();
    await page.waitForTimeout(1000);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // Final pause
  await page.waitForTimeout(500);
});
