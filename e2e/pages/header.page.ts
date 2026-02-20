import { type Page, type Locator } from '@playwright/test';

export class HeaderPage {
  readonly page: Page;
  readonly themeToggle: Locator;
  readonly avatarButton: Locator;
  readonly logoutButton: Locator;
  readonly userName: Locator;
  readonly userEmail: Locator;

  constructor(page: Page) {
    this.page = page;
    this.themeToggle = page.getByRole('button', { name: 'Toggle theme' });
    this.avatarButton = page.locator('header button.rounded-full');
    this.logoutButton = page.getByRole('menuitem', { name: 'Log out' });
    this.userName = page.locator('[role="menuitem"]').first();
    this.userEmail = page.locator('[role="menuitem"]').first();
  }

  async toggleTheme() {
    await this.themeToggle.click();
  }

  async logout() {
    await this.avatarButton.click();
    await this.logoutButton.click();
  }
}
