import { type Page, type Locator } from '@playwright/test';

export class TrainerConsolePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly createSessionButton: Locator;

  // Create session dialog
  readonly sessionNameInput: Locator;
  readonly scenarioTrigger: Locator;
  readonly timeLimitInput: Locator;
  readonly createAsDraftButton: Locator;
  readonly createAndLaunchButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1').filter({ hasText: 'Trainer Console' });
    this.createSessionButton = page.getByRole('button', { name: 'Create Session' });

    this.sessionNameInput = page.locator('[role="dialog"]').getByPlaceholder('e.g., Cohort 5 - Week 3');
    this.scenarioTrigger = page.locator('[role="dialog"]').locator('button').filter({ hasText: 'Select scenario' });
    this.timeLimitInput = page.locator('[role="dialog"]').getByPlaceholder('e.g., 60');
    this.createAsDraftButton = page.locator('[role="dialog"]').getByRole('button', { name: 'Create as Draft' });
    this.createAndLaunchButton = page.locator('[role="dialog"]').getByRole('button', { name: /Create & Launch/ });
  }

  async goto() {
    await this.page.goto('/console');
  }

  getSessionCard(name: string) {
    return this.page.locator('.grid > div').filter({ hasText: name });
  }

  getStatusBadge(card: Locator) {
    return card.locator('[class*="bg-"]').filter({ hasText: /DRAFT|ACTIVE|PAUSED|COMPLETED/ });
  }

  getLaunchButton(card: Locator) {
    return card.getByRole('button', { name: 'Launch' });
  }

  getPauseButton(card: Locator) {
    return card.getByRole('button', { name: 'Pause' });
  }

  getResumeButton(card: Locator) {
    return card.getByRole('button', { name: 'Resume' });
  }

  getEndButton(card: Locator) {
    return card.getByRole('button', { name: 'End' });
  }
}
