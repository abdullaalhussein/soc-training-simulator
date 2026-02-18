import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'docs', 'screenshots');
// Set BASE_URL via environment variable, e.g.: BASE_URL=http://localhost:3000 node scripts/take-screenshots.mjs
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  await page.waitForTimeout(2000); // let page content render
}

async function screenshot(page, name, options = {}) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false, ...options });
  console.log(`Captured: ${name}.png`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    // ==================== 1. Login Page ====================
    console.log('\n--- Login Page ---');
    const loginCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const loginPage = await loginCtx.newPage();
    await loginPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await loginPage.waitForTimeout(1500);
    await screenshot(loginPage, '01-login');
    await loginCtx.close();

    // ==================== 2. Admin Panel (Users) ====================
    console.log('\n--- Admin Panel ---');
    const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adminPage = await adminCtx.newPage();
    await login(adminPage, 'admin@soc.local', 'Password123!');
    await adminPage.waitForTimeout(2000);
    await screenshot(adminPage, '02-admin-users');

    // Admin - Scenarios
    await adminPage.goto(`${BASE_URL}/scenarios`, { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(2000);
    await screenshot(adminPage, '03-admin-scenarios');

    // Admin - Audit Log
    await adminPage.goto(`${BASE_URL}/audit`, { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(2000);
    await screenshot(adminPage, '04-admin-audit');
    await adminCtx.close();

    // ==================== 3. Trainer Console ====================
    console.log('\n--- Trainer Console ---');
    const trainerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const trainerPage = await trainerCtx.newPage();
    await login(trainerPage, 'trainer@soc.local', 'Password123!');
    await trainerPage.waitForTimeout(2000);
    await screenshot(trainerPage, '05-trainer-console');

    // Trainer - Reports
    await trainerPage.goto(`${BASE_URL}/reports`, { waitUntil: 'networkidle' });
    await trainerPage.waitForTimeout(2000);
    await screenshot(trainerPage, '06-trainer-reports');
    await trainerCtx.close();

    // ==================== 4. Trainee Dashboard ====================
    console.log('\n--- Trainee Dashboard ---');
    const traineeCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const traineePage = await traineeCtx.newPage();
    await login(traineePage, 'trainee@soc.local', 'Password123!');
    await traineePage.waitForTimeout(2000);
    await screenshot(traineePage, '07-trainee-dashboard');

    // Try to navigate to a scenario if there's an active session
    // Check for any "Start Scenario" or "Continue" buttons
    const startBtn = traineePage.locator('button:has-text("Start Scenario"), button:has-text("Continue")').first();
    if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Found a scenario button, clicking...');
      await startBtn.click();
      await traineePage.waitForTimeout(5000);

      // Check if we landed on a lesson or scenario page
      const continueBtn = traineePage.locator('button:has-text("Continue to Investigation"), button:has-text("Begin Investigation")').first();
      if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await screenshot(traineePage, '08-trainee-lesson');
        await continueBtn.click();
        await traineePage.waitForTimeout(3000);
      }

      await screenshot(traineePage, '09-trainee-investigation');
    } else {
      console.log('No active scenarios found for trainee');
    }
    await traineeCtx.close();

    console.log('\nAll screenshots saved to docs/screenshots/');
  } catch (err) {
    console.error('Screenshot error:', err);
  } finally {
    await browser.close();
  }
})();
