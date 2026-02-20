import { test, expect } from '@playwright/test';
import { AdminUsersPage } from '../pages/admin-users.page';

test.describe('User Management', () => {
  let usersPage: AdminUsersPage;

  test.beforeEach(async ({ page }) => {
    usersPage = new AdminUsersPage(page);
    await usersPage.goto();
    await expect(usersPage.heading).toBeVisible({ timeout: 15_000 });
    // Wait for table data to load (not just "Loading...")
    await expect(usersPage.getRowByEmail('admin@soc.local')).toBeVisible({ timeout: 15_000 });
  });

  test('Display user table with seeded users', async () => {
    await expect(usersPage.table).toBeVisible();
    const rowCount = await usersPage.tableRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(3);

    // Check seeded users exist
    await expect(usersPage.getRowByEmail('admin@soc.local')).toBeVisible();
    await expect(usersPage.getRowByEmail('trainer@soc.local')).toBeVisible();
    await expect(usersPage.getRowByEmail('trainee@soc.local')).toBeVisible();
  });

  test('Search users by name', async ({ page }) => {
    await usersPage.searchInput.fill('Lead');
    await page.waitForTimeout(500); // debounce
    await expect(usersPage.tableRows).toHaveCount(1);
    await expect(usersPage.getRowByEmail('trainer@soc.local')).toBeVisible();

    // Clear search, all users return
    await usersPage.searchInput.clear();
    await page.waitForTimeout(500);
    await expect(usersPage.tableRows.first()).toBeVisible();
    const count = await usersPage.tableRows.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('Filter users by role', async ({ page }) => {
    await usersPage.roleFilterTrigger.click();
    await page.locator('[role="option"]').filter({ hasText: 'Trainer' }).click();
    await page.waitForTimeout(500);

    const rows = usersPage.tableRows;
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < count; i++) {
      // Check the Role column cell specifically (3rd column, index 2)
      const roleCell = rows.nth(i).locator('td').nth(2);
      await expect(roleCell).toContainText('TRAINER');
    }
  });

  test('Create a new user', async ({ page }) => {
    // Use unique email to avoid conflicts with previous runs
    const uniqueEmail = `e2e-test-${Date.now()}@soc.local`;

    await usersPage.addUserButton.click();
    await expect(usersPage.dialogTitle).toHaveText('Create User');

    await usersPage.emailInput.fill(uniqueEmail);
    await usersPage.nameInput.fill('E2E Test User');
    await usersPage.passwordInput.fill('Password123!');
    await usersPage.createButton.click();

    // Wait for dialog to close and verify user appears
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10_000 });
    await expect(usersPage.getRowByEmail(uniqueEmail)).toBeVisible({ timeout: 10_000 });
  });

  test('Edit a user', async ({ page }) => {
    const targetRow = usersPage.getRowByEmail('trainee@soc.local');
    await expect(targetRow).toBeVisible({ timeout: 10_000 });

    await usersPage.getEditButton(targetRow).click();
    await expect(usersPage.dialogTitle).toHaveText('Edit User');

    const newName = 'Updated Trainee User';
    await usersPage.nameInput.clear();
    await usersPage.nameInput.fill(newName);
    await usersPage.updateButton.click();

    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10_000 });
    await expect(page.locator('td').filter({ hasText: newName })).toBeVisible({ timeout: 10_000 });
  });

  test('Reset user password', async ({ page }) => {
    const targetRow = usersPage.getRowByEmail('trainee@soc.local');
    await expect(targetRow).toBeVisible({ timeout: 10_000 });

    await usersPage.getResetPasswordButton(targetRow).click();
    await expect(page.getByRole('heading', { name: 'Change Password' })).toBeVisible();

    await usersPage.newPasswordInput.fill('Password123!');
    await usersPage.changePasswordButton.click();
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10_000 });
  });

  test('Deactivate a user', async ({ page }) => {
    // Find any e2e test user created by previous Create test
    const rows = usersPage.tableRows;
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });

    // Look for an e2e test user row
    const e2eRows = page.locator('tbody tr').filter({ hasText: 'e2e-test' });
    if ((await e2eRows.count()) > 0) {
      const targetRow = e2eRows.first();
      await usersPage.getDeactivateButton(targetRow).click();
      await page.waitForTimeout(1000);
      // Verify status changed
      const statusCell = targetRow.locator('td').nth(3);
      await expect(statusCell).toContainText('Inactive', { timeout: 10_000 });
    } else {
      test.skip();
    }
  });
});
