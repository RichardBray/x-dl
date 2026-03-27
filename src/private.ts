import path from 'node:path';
import os from 'node:os';
import type { BrowserContext, Page } from 'playwright';

const DEFAULT_PROFILE_DIR = path.join(os.homedir(), '.x-dl-chrome-profile');

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
  // Close headless, relaunch headed for login
  await connection.cleanup();

  console.log('🔐 Not logged into X/Twitter. Opening Chrome for login...');
  console.log('⚠️  Log in, and x-dl will continue automatically.');

  const headed = await launchPrivateBrowser({ headed: true });

  await headed.page.goto('https://x.com/i/flow/login', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  // Poll for auth_token cookie
  const start = Date.now();
  const timeoutMs = 300000; // 5 minutes
  while (Date.now() - start < timeoutMs) {
    const cookies = await headed.context.cookies('https://x.com');
    if (cookies.some(c => c.name === 'auth_token')) break;
    await new Promise(r => setTimeout(r, 2000));
  }

  const cookies = await headed.context.cookies('https://x.com');
  if (!cookies.some(c => c.name === 'auth_token')) {
    await headed.cleanup();
    throw new Error('Login timed out (5 minutes). Please try again.');
  }

  console.log('✅ Login detected! Continuing download...');

  // Close headed, relaunch headless — cookies are persisted in the profile dir
  await headed.cleanup();
  return launchPrivateBrowser();
}
