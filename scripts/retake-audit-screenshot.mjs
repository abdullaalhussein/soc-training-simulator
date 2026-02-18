import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'docs', 'screenshots');
// Set BASE_URL via environment variable, e.g.: BASE_URL=http://localhost:3000 node scripts/retake-audit-screenshot.mjs
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
  await page.waitForTimeout(2000);

  // Navigate to Audit Log
  await page.goto(`${BASE_URL}/audit`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Redact user names in the audit log table
  await page.evaluate(() => {
    const rows = document.querySelectorAll('tbody tr');
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      // User column is the 2nd cell (index 1)
      if (cells.length >= 2) {
        cells[1].textContent = '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588';
        cells[1].style.color = '#94a3b8';
      }
    });

    // Hide the bottom-left logged-in user info
    const allElements = document.querySelectorAll('p, span, div');
    allElements.forEach((el) => {
      if (el.children.length === 0) {
        const text = el.textContent || '';
        if (text.includes('@soc.local') || text.includes('@') && text.includes('.local')) {
          el.textContent = '\u2588\u2588\u2588\u2588@\u2588\u2588\u2588\u2588.\u2588\u2588\u2588';
          el.style.color = '#94a3b8';
        } else if (text === 'System Administrator' || text === 'Lead Trainer' || text === 'SOC Analyst Trainee') {
          // Only redact if it's in the sidebar (small element, not in table)
          const rect = el.getBoundingClientRect();
          if (rect.left < 250 && rect.top > 700) {
            el.textContent = '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588';
            el.style.color = '#94a3b8';
          }
        }
      }
    });
  });

  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, '04-admin-audit.png'),
    fullPage: false,
  });
  console.log('Captured: 04-admin-audit.png (names redacted)');

  await browser.close();
})();
