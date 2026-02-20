import { test, expect } from '@playwright/test';
import { AdminAuditPage } from '../pages/admin-audit.page';

test.describe('Audit Log', () => {
  let auditPage: AdminAuditPage;

  test.beforeEach(async ({ page }) => {
    auditPage = new AdminAuditPage(page);
    await auditPage.goto();
    await expect(auditPage.heading).toBeVisible({ timeout: 15_000 });
  });

  test('Display audit log table', async () => {
    await expect(auditPage.table).toBeVisible();

    // Check column headers
    await expect(auditPage.page.locator('th').filter({ hasText: 'Timestamp' })).toBeVisible();
    await expect(auditPage.page.locator('th').filter({ hasText: 'User' })).toBeVisible();
    await expect(auditPage.page.locator('th').filter({ hasText: 'Action' })).toBeVisible();

    // Should have at least 1 entry (login events from auth setup)
    await expect(auditPage.tableRows.first()).toBeVisible({ timeout: 10_000 });
  });

  test('Filter by action', async ({ page }) => {
    await expect(auditPage.tableRows.first()).toBeVisible({ timeout: 10_000 });

    await auditPage.filterInput.fill('LOGIN');
    await page.waitForTimeout(500);

    // All visible rows should show LOGIN action
    const rows = auditPage.tableRows;
    const count = await rows.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(rows.nth(i).locator('text=LOGIN')).toBeVisible();
      }
    }
  });

  test('Pagination', async ({ page }) => {
    await expect(auditPage.tableRows.first()).toBeVisible({ timeout: 10_000 });

    // Check pagination text exists
    const paginationArea = page.locator('text=/Page \\d+ of \\d+/');
    await expect(paginationArea).toBeVisible({ timeout: 5_000 });

    // Check prev/next buttons exist
    await expect(auditPage.prevButton).toBeVisible();
    await expect(auditPage.nextButton).toBeVisible();
  });
});
