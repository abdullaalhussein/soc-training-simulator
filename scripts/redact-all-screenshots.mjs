import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'docs', 'screenshots');
// Set BASE_URL via environment variable, e.g.: BASE_URL=http://localhost:3000 node scripts/redact-all-screenshots.mjs
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Redact any visible names and emails on the page
async function redactUserInfo(page) {
  await page.evaluate(() => {
    const allEls = document.querySelectorAll('p, span, div, td, a');
    allEls.forEach((el) => {
      if (el.children.length === 0 || el.childNodes.length === 1) {
        const text = (el.textContent || '').trim();
        // Redact emails
        if (/@.*\./.test(text) && text.includes('@')) {
          el.textContent = '\u2588\u2588\u2588\u2588@\u2588\u2588\u2588\u2588.\u2588\u2588\u2588';
          el.style.color = '#94a3b8';
        }
        // Redact known role display names in sidebar
        if (['System Administrator', 'Lead Trainer', 'SOC Analyst Trainee'].includes(text)) {
          const rect = el.getBoundingClientRect();
          // Only redact in sidebar (left side, near bottom)
          if (rect.left < 250) {
            el.textContent = '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588';
            el.style.color = '#94a3b8';
          }
        }
      }
    });

    // Redact "Welcome back, NAME" pattern
    const headings = document.querySelectorAll('h1, h2, h3');
    headings.forEach((h) => {
      const text = h.textContent || '';
      if (text.startsWith('Welcome back,')) {
        h.textContent = 'Welcome back';
      }
    });
  });
  await page.waitForTimeout(300);
}

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  await page.waitForTimeout(2000);
}

async function screenshot(page, name) {
  await redactUserInfo(page);
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`Captured: ${name}.png`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    // ===== Admin =====
    const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adminPage = await adminCtx.newPage();
    await login(adminPage, 'admin@soc.local', 'Password123!');

    // Admin - Users (also redact table names)
    await adminPage.evaluate(() => {
      const rows = document.querySelectorAll('tbody tr');
      rows.forEach((row) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          cells[0].textContent = '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588';
          cells[0].style.color = '#94a3b8';
          cells[1].textContent = '\u2588\u2588\u2588\u2588@\u2588\u2588\u2588\u2588.\u2588\u2588\u2588';
          cells[1].style.color = '#94a3b8';
        }
      });
    });
    await screenshot(adminPage, '02-admin-users');

    // Admin - Scenarios
    await adminPage.goto(`${BASE_URL}/scenarios`, { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(2000);
    await screenshot(adminPage, '03-admin-scenarios');

    // Admin - Audit Log (also redact User column)
    await adminPage.goto(`${BASE_URL}/audit`, { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(2000);
    await adminPage.evaluate(() => {
      const rows = document.querySelectorAll('tbody tr');
      rows.forEach((row) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          cells[1].textContent = '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588';
          cells[1].style.color = '#94a3b8';
        }
      });
    });
    await screenshot(adminPage, '04-admin-audit');
    await adminCtx.close();

    // ===== Trainer =====
    const trainerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const trainerPage = await trainerCtx.newPage();
    await login(trainerPage, 'trainer@soc.local', 'Password123!');
    await screenshot(trainerPage, '05-trainer-console');

    await trainerPage.goto(`${BASE_URL}/reports`, { waitUntil: 'networkidle' });
    await trainerPage.waitForTimeout(2000);
    await screenshot(trainerPage, '06-trainer-reports');
    await trainerCtx.close();

    // ===== Trainee =====
    const traineeCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const traineePage = await traineeCtx.newPage();
    await login(traineePage, 'trainee@soc.local', 'Password123!');
    await screenshot(traineePage, '07-trainee-dashboard');

    // Start scenario
    const startBtn = traineePage.locator('button:has-text("Start Scenario"), button:has-text("Continue")').first();
    if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startBtn.click();
      await traineePage.waitForTimeout(5000);

      const continueBtn = traineePage.locator('button:has-text("Continue to Investigation"), button:has-text("Begin Investigation")').first();
      if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await screenshot(traineePage, '08-trainee-lesson');
        await continueBtn.click();
        await traineePage.waitForTimeout(3000);
      }
      await screenshot(traineePage, '09-trainee-investigation');
    }
    await traineeCtx.close();

    console.log('\nAll screenshots retaken with names/emails redacted.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
