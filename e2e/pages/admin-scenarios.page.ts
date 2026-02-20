import { type Page, type Locator } from '@playwright/test';

export class AdminScenariosPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly createButton: Locator;
  readonly importButton: Locator;
  readonly templateButton: Locator;
  readonly scenarioCards: Locator;
  readonly wizardDialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Scenario Management' });
    this.createButton = page.getByRole('button', { name: 'Create Scenario' });
    this.importButton = page.getByRole('button', { name: 'Import' });
    this.templateButton = page.getByRole('button', { name: 'Template' });
    this.scenarioCards = page.locator('.grid > div').filter({ has: page.locator('[class*="CardHeader"]') });
    this.wizardDialog = page.locator('[role="dialog"]');
  }

  async goto() {
    await this.page.goto('/scenarios');
  }

  getCardByName(name: string) {
    return this.page.locator('.grid > div').filter({ hasText: name });
  }

  getDropdownTrigger(card: Locator) {
    return card.locator('button').filter({ has: this.page.locator('svg.lucide-ellipsis-vertical') });
  }
}
