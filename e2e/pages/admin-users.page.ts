import { type Page, type Locator } from '@playwright/test';

export class AdminUsersPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly addUserButton: Locator;
  readonly searchInput: Locator;
  readonly roleFilterTrigger: Locator;
  readonly table: Locator;
  readonly tableRows: Locator;

  // Dialog elements
  readonly dialogTitle: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly createButton: Locator;
  readonly updateButton: Locator;
  readonly cancelButton: Locator;

  // Password dialog
  readonly newPasswordInput: Locator;
  readonly changePasswordButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'User Management' });
    this.addUserButton = page.getByRole('button', { name: 'Add User' });
    this.searchInput = page.getByPlaceholder('Search by name or email...');
    this.roleFilterTrigger = page.locator('[role="combobox"]');
    this.table = page.locator('table');
    this.tableRows = page.locator('tbody tr');

    this.dialogTitle = page.locator('[role="dialog"] h2');
    this.nameInput = page.locator('[role="dialog"]').getByPlaceholder('Full name');
    this.emailInput = page.locator('[role="dialog"]').getByPlaceholder('user@soc.local');
    this.passwordInput = page.locator('[role="dialog"]').getByPlaceholder('Min 8 characters');
    this.createButton = page.locator('[role="dialog"]').getByRole('button', { name: 'Create' });
    this.updateButton = page.locator('[role="dialog"]').getByRole('button', { name: 'Update' });
    this.cancelButton = page.locator('[role="dialog"]').getByRole('button', { name: 'Cancel' });

    this.newPasswordInput = page.locator('[role="dialog"]').getByPlaceholder('Min 8 characters');
    this.changePasswordButton = page.locator('[role="dialog"]').getByRole('button', { name: 'Change Password' });
  }

  async goto() {
    await this.page.goto('/users');
  }

  getEditButton(row: Locator) {
    return row.locator('button').filter({ has: this.page.locator('svg.lucide-pencil') });
  }

  getResetPasswordButton(row: Locator) {
    return row.locator('button').filter({ has: this.page.locator('svg.lucide-key-round') });
  }

  getDeactivateButton(row: Locator) {
    return row.locator('button').filter({ has: this.page.locator('svg.lucide-user-x') });
  }

  getRowByEmail(email: string) {
    return this.tableRows.filter({ hasText: email });
  }

  getRowByName(name: string) {
    return this.tableRows.filter({ hasText: name });
  }
}
