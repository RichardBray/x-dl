import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import type { BrowserContext, Page } from 'playwright';

const DEFAULT_PROFILE_DIR = path.join(os.homedir(), '.x-dl-chrome-profile');

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

export interface PrivateConnection {
  context: BrowserContext;
  page: Page;
  cleanup: () => Promise<void>;
}

export function getProfileDir(): string {
  return DEFAULT_PROFILE_DIR;
}

export async function launchPrivateBrowser(options?: {
  headed?: boolean;
}): Promise<PrivateConnection> {
  const { chromium } = await import('playwright');

  const context = await chromium.launchPersistentContext(DEFAULT_PROFILE_DIR, {
    channel: 'chrome',
    headless: !(options?.headed),
  });

  const page = await context.newPage();

  return {
    context,
    page,
    cleanup: async () => {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    },
  };
}

export async function handlePrivateLogin(
  connection: PrivateConnection
): Promise<PrivateConnection> {
  // Close Playwright so it releases the profile directory lock
  await connection.cleanup();

  const chromePath = findChromePath();
  if (!chromePath) {
    throw new Error(
      'Google Chrome not found.\n' +
      'CDP mode requires Google Chrome installed on your system.'
    );
  }

  console.log('🔐 Not logged into X/Twitter. Opening Chrome for login...');
  console.log('⚠️  Log in to X/Twitter, then close Chrome to continue.\n');

  // Launch real Chrome (not Playwright-controlled) so Twitter doesn't detect automation
  const chromeProcess = Bun.spawn([
    chromePath,
    `--user-data-dir=${DEFAULT_PROFILE_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    'https://x.com/i/flow/login',
  ], {
    stdout: 'ignore',
    stderr: 'ignore',
  });

  // Wait for the user to close Chrome
  await chromeProcess.exited;

  console.log('✅ Chrome closed. Checking login status...');

  // Relaunch via Playwright headless — cookies are persisted in the profile dir
  const newConnection = await launchPrivateBrowser();

  // Verify login succeeded by checking cookies
  const cookies = await newConnection.context.cookies('https://x.com');
  if (!cookies.some(c => c.name === 'auth_token')) {
    await newConnection.cleanup();
    throw new Error('Login not detected. Please try again.');
  }

  console.log('✅ Login detected! Continuing download...\n');
  return newConnection;
}
