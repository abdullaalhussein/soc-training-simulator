import { chromium } from 'playwright';

const BASE_URL = 'https://client-production-4081.up.railway.app';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Get trainer token
  let token = null;
  page.on('response', async (res) => {
    if (res.url().includes('/api/auth/login') && res.status() === 200) {
      try { token = (await res.json()).token; } catch {}
    }
  });

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', 'trainer@soc.local');
  await page.fill('#password', 'Password123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);

  if (!token) { console.log('Login failed'); await browser.close(); return; }

  // Fetch norah's attempt
  const res = await ctx.request.get('https://server-production-35c2.up.railway.app/api/attempts/cmlrtgp490019o2012bab1kwe', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await res.json();

  console.log('savedEvidence:', data.savedEvidence?.length ?? 'FIELD NOT PRESENT');
  console.log('savedTimeline:', data.savedTimeline?.length ?? 'FIELD NOT PRESENT');

  if (data.savedEvidence?.length > 0) {
    console.log('\nEvidence items:');
    data.savedEvidence.forEach(e => console.log(`  - ${e.summary?.substring(0, 80)}...`));
  }
  if (data.savedTimeline?.length > 0) {
    console.log(`\nTimeline entries: ${data.savedTimeline.length}`);
  }

  await browser.close();
})();
