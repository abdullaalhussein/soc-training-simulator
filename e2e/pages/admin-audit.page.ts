import { type Page, type Locator } from '@playwright/test';

export class AdminAuditPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly filterInput: Locator;
  readonly table: Locator;
  readonly tableRows: Locator;
  readonly paginationText: Locator;
  readonly prevButton: Locator;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Audit Log' });
    this.filterInput = page.getByPlaceholder('Filter by action...');
    this.table = page.locator('table');
    this.tableRows = page.locator('tbody tr');
    this.paginationText = page.locator('text=/Page \\d+ of \\d+/');
    this.prevButton = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-left') }).last();
    this.nextButton = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-right') }).last();
  }

  async goto() {
    await this.page.goto('/audit');
  }
}
