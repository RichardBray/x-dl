import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import type { Browser, BrowserContext, Page } from 'playwright';

const CHROME_PATHS_MACOS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const CHROME_PATHS_LINUX = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/snap/bin/chromium',
];

export function findChromePath(): string | null {
  const platform = os.platform();
  const candidates = platform === 'darwin' ? CHROME_PATHS_MACOS : CHROME_PATHS_LINUX;

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function findChromeProfileDir(): string {
  const platform = os.platform();
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome');
  }
  return path.join(os.homedir(), '.config', 'google-chrome');
}

export interface CdpConnection {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  launchedByUs: boolean;
  cleanup: () => Promise<void>;
}

function isChromeRunning(): boolean {
  try {
    const result = Bun.spawnSync(['pgrep', '-f', 'Google Chrome'], {
      stdout: 'pipe',
      stderr: 'ignore',
    });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

async function tryConnectPlaywright(
  chromium: typeof import('playwright').chromium,
  port: number,
  timeoutMs: number = 5000,
): Promise<Browser | null> {
  try {
    return await chromium.connectOverCDP(`http://localhost:${port}`, { timeout: timeoutMs });
  } catch {
    return null;
  }
}

export async function connectOverCdp(port: number = 9222): Promise<CdpConnection> {
  const { chromium } = await import('playwright');

  // Try connecting to Chrome launched with --remote-debugging-port
  const existing = await tryConnectPlaywright(chromium, port);
  if (existing) {
    const context = existing.contexts()[0] || await existing.newContext();
    const page = await context.newPage();

    return {
      browser: existing,
      context,
      page,
      launchedByUs: false,
      cleanup: async () => {
        await page.close().catch(() => {});
      },
    };
  }

  // Check if Chrome is running without --remote-debugging-port
  const chromeRunning = isChromeRunning();

  const chromePath = findChromePath();
  if (!chromePath) {
    throw new Error(
      'Google Chrome not found.\n' +
      'CDP mode requires Google Chrome installed on your system.'
    );
  }

  if (chromeRunning) {
    // Chrome is running but not with remote debugging on this port.
    // We can't reuse the profile (it's locked), so ask the user to restart Chrome.
    throw new Error(
      'Chrome is running but not with remote debugging enabled.\n\n' +
      'Please close Chrome and let x-dl launch it, or restart Chrome with:\n' +
      `  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=${port}\n\n` +
      'Then run: x-dl cdp <url>'
    );
  }

  // Chrome is not running — launch it headlessly with the user's profile
  const profileDir = findChromeProfileDir();

  const chromeProcess = Bun.spawn([
    chromePath,
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
  ], {
    stdout: 'ignore',
    stderr: 'ignore',
  });

  // Wait for Chrome to be ready
  let browser: Browser | null = null;
  for (let i = 0; i < 20; i++) {
    browser = await tryConnectPlaywright(chromium, port);
    if (browser) break;
    await new Promise(r => setTimeout(r, 500));
  }

  if (!browser) {
    chromeProcess.kill();
    throw new Error(
      `Could not launch Chrome with remote debugging on port ${port}.\n\n` +
      'Try launching Chrome manually:\n' +
      `  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=${port}\n\n` +
      'Then run: x-dl cdp <url>'
    );
  }

  const context = browser.contexts()[0] || await browser.newContext();
  const page = await context.newPage();

  return {
    browser,
    context,
    page,
    launchedByUs: true,
    cleanup: async () => {
      await page.close().catch(() => {});
      await browser!.close().catch(() => {});
      chromeProcess.kill();
    },
  };
}

export async function handleCdpLogin(
  connection: CdpConnection,
  port: number
): Promise<CdpConnection> {
  const { chromium } = await import('playwright');

  if (connection.launchedByUs) {
    // Kill headless instance, relaunch headed
    await connection.cleanup();

    const chromePath = findChromePath()!;
    const profileDir = findChromeProfileDir();

    console.log('🔐 Not logged into X/Twitter. Opening Chrome for login...');
    console.log('⚠️  Don\'t close the Chrome window — log in, and x-dl will continue automatically.');

    const chromeProcess = Bun.spawn([
      chromePath,
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
    ], {
      stdout: 'ignore',
      stderr: 'ignore',
    });

    // Wait for Chrome to be ready
    let browser: Browser | null = null;
    for (let i = 0; i < 20; i++) {
      browser = await tryConnectPlaywright(chromium, port);
      if (browser) break;
      await new Promise(r => setTimeout(r, 500));
    }

    if (!browser) {
      chromeProcess.kill();
      throw new Error('Failed to relaunch Chrome for login.');
    }

    const context = browser.contexts()[0] || await browser.newContext();
    const page = await context.newPage();
    await page.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Poll for auth_token cookie
    await waitForAuthCookie(context);

    console.log('✅ Login detected! Continuing download...');

    // Close headed, relaunch headless, return new connection
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
    chromeProcess.kill();

    return connectOverCdp(port);
  } else {
    // Chrome was already running — open a login tab
    console.log('🔐 Not logged into X/Twitter. A login tab has been opened in Chrome.');

    const loginPage = await connection.context.newPage();
    await loginPage.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Poll for auth_token cookie
    await waitForAuthCookie(connection.context);

    console.log('✅ Login detected! Continuing download...');

    await loginPage.close().catch(() => {});

    // Return a fresh page in the same connection
    const page = await connection.context.newPage();
    return {
      ...connection,
      page,
    };
  }
}

async function waitForAuthCookie(context: BrowserContext, timeoutMs: number = 300000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const cookies = await context.cookies('https://x.com');
    if (cookies.some(c => c.name === 'auth_token')) return;
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Login timed out (5 minutes). Please try again.');
}
