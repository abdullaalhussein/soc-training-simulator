import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'docs', 'screenshots');
// Set BASE_URL via environment variable, e.g.: BASE_URL=http://localhost:3000 node scripts/retake-admin-screenshot.mjs
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Login as admin
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', 'admin@soc.local');
  await page.fill('#password', 'Password123!');
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  await page.waitForTimeout(2500);

  // Hide all name and email cells in the user table
  await page.evaluate(() => {
    // Target table rows — name is first cell, email is second cell in each row
    const rows = document.querySelectorAll('tbody tr');
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        // Redact name (1st column)
        cells[0].textContent = '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588';
        cells[0].style.color = '#94a3b8';
        // Redact email (2nd column)
        cells[1].textContent = '\u2588\u2588\u2588\u2588@\u2588\u2588\u2588\u2588.\u2588\u2588\u2588';
        cells[1].style.color = '#94a3b8';
      }
    });

    // Also hide the bottom-left user info (current logged-in user)
    const bottomInfo = document.querySelectorAll('div');
    bottomInfo.forEach((el) => {
      const text = el.textContent || '';
      if (text.includes('@soc.local') && el.children.length <= 2 && el.offsetHeight < 60) {
        const spans = el.querySelectorAll('p, span, div');
        spans.forEach((s) => {
          if (s.children.length === 0) {
            if (s.textContent.includes('@')) {
              s.textContent = '\u2588\u2588\u2588\u2588@\u2588\u2588\u2588\u2588.\u2588\u2588\u2588';
            } else if (s.textContent.trim().length > 0 && !s.textContent.includes('Admin') && !s.textContent.includes('Panel')) {
              s.textContent = '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588';
            }
          }
        });
      }
    });
  });

  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, '02-admin-users.png'),
    fullPage: false,
  });
  console.log('Captured: 02-admin-users.png (names redacted)');

  await browser.close();
})();
