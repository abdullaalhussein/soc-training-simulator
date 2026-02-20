import { type Page, type Locator } from '@playwright/test';

export class TraineeDashboardPage {
  readonly page: Page;
  readonly welcomeHeading: Locator;
  readonly assignedSessionsCard: Locator;
  readonly completedCard: Locator;
  readonly avgScoreCard: Locator;
  readonly sessionCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeHeading = page.locator('h1').filter({ hasText: 'Welcome back' });
    this.assignedSessionsCard = page.locator('text=Assigned Sessions').locator('..');
    this.completedCard = page.locator('p').filter({ hasText: 'Completed' }).locator('..');
    this.avgScoreCard = page.locator('text=Avg Score').locator('..');
    this.sessionCards = page.locator('.grid > div').filter({ has: page.getByRole('button') });
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  getStartButton(card: Locator) {
    return card.getByRole('button', { name: /Start Investigation/ });
  }

  getContinueButton(card: Locator) {
    return card.getByRole('button', { name: 'Continue Investigation' });
  }

  getViewResultsButton(card: Locator) {
    return card.getByRole('button', { name: 'View Results' });
  }
}
