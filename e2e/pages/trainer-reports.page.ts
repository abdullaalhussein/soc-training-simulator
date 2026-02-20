import { type Page, type Locator } from '@playwright/test';

export class TrainerReportsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly sessionSelector: Locator;
  readonly statCards: Locator;
  readonly leaderboardHeading: Locator;
  readonly leaderboardTable: Locator;
  readonly exportCsvButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Reports & Analytics' });
    this.sessionSelector = page.locator('.max-w-sm button').filter({ hasText: /Select a session/ });
    this.statCards = page.locator('.grid-cols-1.md\\:grid-cols-4 > div');
    this.leaderboardHeading = page.getByRole('heading', { name: 'Leaderboard' });
    this.leaderboardTable = page.locator('table');
    this.exportCsvButton = page.getByRole('button', { name: 'Export CSV' });
  }

  async goto() {
    await this.page.goto('/reports');
  }
}
