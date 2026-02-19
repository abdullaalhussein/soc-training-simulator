import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'docs', 'screenshots');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  await page.waitForTimeout(2000);
}

async function switchToDark(page) {
  // Click the theme toggle button (Sun/Moon icon)
  const toggle = page.locator('button:has(svg.lucide-moon), button:has(svg.lucide-sun)').first();
  if (await toggle.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Check if we're in light mode (moon icon means "click to go dark")
    const hasMoon = await page.locator('svg.lucide-moon').isVisible().catch(() => false);
    if (hasMoon) {
      await toggle.click();
      await page.waitForTimeout(500);
    }
  }
}

async function redactUserInfo(page) {
  await page.evaluate(() => {
    const allEls = document.querySelectorAll('p, span, div, td, a');
    allEls.forEach((el) => {
      if (el.children.length === 0 || el.childNodes.length === 1) {
        const text = (el.textContent || '').trim();
        if (/@.*\./.test(text) && text.includes('@')) {
          el.textContent = '\u2588\u2588\u2588\u2588@\u2588\u2588\u2588\u2588.\u2588\u2588\u2588';
          el.style.color = '#64748b';
        }
        if (['System Administrator', 'Lead Trainer', 'SOC Analyst Trainee'].includes(text)) {
          const rect = el.getBoundingClientRect();
          if (rect.left < 250) {
            el.textContent = '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588';
            el.style.color = '#64748b';
          }
        }
      }
    });
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

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`Captured: ${name}.png`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    // Admin - Scenarios (dark)
    console.log('\n--- Admin Scenarios (dark) ---');
    const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adminPage = await adminCtx.newPage();
    await login(adminPage, 'admin@soc.local', 'Password123!');
    await switchToDark(adminPage);
    await adminPage.goto(`${BASE_URL}/scenarios`, { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(2000);
    await redactUserInfo(adminPage);
    await screenshot(adminPage, '03-admin-scenarios-dark');
    await adminCtx.close();

    // Trainee Dashboard (dark)
    console.log('\n--- Trainee Dashboard (dark) ---');
    const traineeCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const traineePage = await traineeCtx.newPage();
    await login(traineePage, 'trainee@soc.local', 'Password123!');
    await switchToDark(traineePage);
    await traineePage.waitForTimeout(1000);
    await redactUserInfo(traineePage);
    await screenshot(traineePage, '07-trainee-dashboard-dark');

    // Trainee Investigation (dark)
    console.log('\n--- Trainee Investigation (dark) ---');
    const startBtn = traineePage.locator('button:has-text("Start Investigation"), button:has-text("Continue Investigation")').first();
    if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startBtn.click();
      await traineePage.waitForTimeout(5000);

      const continueBtn = traineePage.locator('button:has-text("Continue to Investigation"), button:has-text("Begin Investigation")').first();
      if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await continueBtn.click();
        await traineePage.waitForTimeout(3000);
      }

      await redactUserInfo(traineePage);
      await screenshot(traineePage, '09-trainee-investigation-dark');
    } else {
      console.log('No active scenario found for trainee');
    }
    await traineeCtx.close();

    console.log('\nDark mode screenshots saved.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
