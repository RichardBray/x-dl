// Test Playwright Performance API extraction
import { chromium } from 'playwright';

(async () => {
  const url = process.argv[2] || 'https://x.com/WesRoth/status/2013693268190437410';

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();

  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    const urls = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return entries
        .map((r) => String(r.name))
        .filter((u) => u.includes('twimg.com') && (u.includes('.mp4') || u.includes('.m3u8') || u.includes('.m4s')));
    });

    console.log('Found URLs:', urls);
  } finally {
    await context.close();
    await browser.close();
  }
})();
