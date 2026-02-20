import { type Page, type Locator } from '@playwright/test';

export class TrainerMonitorPage {
  readonly page: Page;
  readonly sessionHeading: Locator;
  readonly scenarioName: Locator;
  readonly statusBadge: Locator;
  readonly traineeList: Locator;
  readonly sendHintButton: Locator;
  readonly broadcastAlertButton: Locator;
  readonly hintDialog: Locator;
  readonly hintTextarea: Locator;
  readonly sendHintSubmit: Locator;
  readonly alertDialog: Locator;
  readonly alertTextarea: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sessionHeading = page.locator('h1');
    this.scenarioName = page.locator('h1 + p');
    this.statusBadge = page.locator('.flex.gap-2 [class*="Badge"]').last();
    this.traineeList = page.locator('.w-72');
    this.sendHintButton = page.getByRole('button', { name: 'Send Hint' });
    this.broadcastAlertButton = page.getByRole('button', { name: 'Broadcast Alert' });

    this.hintDialog = page.locator('[role="dialog"]').filter({ hasText: 'Send Hint' });
    this.hintTextarea = page.locator('[role="dialog"]').getByPlaceholder('Type your hint or guidance...');
    this.sendHintSubmit = page.locator('[role="dialog"]').getByRole('button', { name: 'Send Hint' });

    this.alertDialog = page.locator('[role="dialog"]').filter({ hasText: 'Broadcast Alert' });
    this.alertTextarea = page.locator('[role="dialog"]').getByPlaceholder('Type your alert message...');
  }

  async goto(sessionId: string) {
    await this.page.goto(`/sessions/${sessionId}`);
  }
}
