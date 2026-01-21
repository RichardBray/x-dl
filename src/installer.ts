export async function ensurePlaywrightReady(): Promise<boolean> {
  console.log('\ud83d\udd0d Checking for Playwright (Chromium)...');

  try {
    const { chromium } = await import('playwright');

    const browser = await chromium.launch({ headless: true });
    await browser.close();

    console.log('\u2705 Playwright Chromium is ready');
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error('\u274c Playwright Chromium is not ready');

    if (
      message.includes('Executable doesn\'t exist') ||
      message.includes('playwright install') ||
      message.includes('browserType.launch')
    ) {
      console.error('Install Chromium with: bunx playwright install chromium');
    } else {
      console.error(message);
    }

    return false;
  }
}
