import { type Page, type Locator } from '@playwright/test';

export class TraineePlayerPage {
  readonly page: Page;
  readonly briefingPanel: Locator;
  readonly logFeedViewer: Locator;
  readonly investigationWorkspace: Locator;
  readonly searchBar: Locator;
  readonly logTable: Locator;
  readonly logRows: Locator;
  readonly evidenceTab: Locator;
  readonly checkpointButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.briefingPanel = page.locator('[class*="briefing"], [data-testid="briefing"]').first();
    this.logFeedViewer = page.locator('table').first();
    this.investigationWorkspace = page.locator('[role="tablist"]').first();
    this.searchBar = page.getByPlaceholder(/search/i).first();
    this.logTable = page.locator('table').first();
    this.logRows = page.locator('tbody tr');
    this.evidenceTab = page.getByRole('tab', { name: /evidence/i });
    this.checkpointButton = page.getByRole('button', { name: /checkpoint/i });
  }

  async goto(attemptId: string) {
    await this.page.goto(`/scenario/${attemptId}`);
  }
}
