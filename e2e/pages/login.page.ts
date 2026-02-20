import { type Page, type Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly title: Locator;
  readonly errorMessage: Locator;
  readonly privacyLink: Locator;
  readonly termsLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.submitButton = page.locator('button[type="submit"]');
    this.title = page.getByText('SOC Training Simulator');
    this.errorMessage = page.locator('div.rounded-md.text-destructive');
    this.privacyLink = page.getByRole('link', { name: 'Privacy Policy' });
    this.termsLink = page.getByRole('link', { name: 'Terms of Service' });
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
