export async function ensurePlaywrightReady(): Promise<boolean> {
  console.log('\ud83d\udd0d Checking for Playwright (Chromium)...');

  const ready = await isPlaywrightChromiumReady();

  if (ready) {
    console.log('\u2705 Playwright Chromium is ready');
    return true;
  }

  console.error('\u274c Playwright Chromium is not ready');
  return false;
}

function which(cmd: string): string | null {
  if (typeof (Bun as any)?.which === 'function') {
    return (Bun as any).which(cmd) || null;
  }

  const { spawnSync } = require('node:child_process');
  try {
    const result = spawnSync('command', ['-v', cmd], { stdio: 'pipe' });
    return result.status === 0 ? result.stdout.toString().trim() : null;
  } catch {
    return null;
  }
}

async function run(cmd: string[], opts?: { sudo?: boolean }): Promise<{ code: number }> {
  const fullCmd = opts?.sudo ? ['sudo', ...cmd] : cmd;
  const proc = Bun.spawn(fullCmd, { stdio: 'inherit' });
  const code = await proc.exited;
  return { code };
}

function getPlatform(): 'macos' | 'linux' | 'other' {
  const p = process.platform;
  if (p === 'darwin') return 'macos';
  if (p === 'linux') return 'linux';
  return 'other';
}

async function isPlaywrightChromiumReady(): Promise<boolean> {
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

async function installPlaywrightChromium(): Promise<void> {
  console.log('\ud83d\udd0d Installing Playwright Chromium...');

  try {
    const mod = await import('playwright/lib/install');
    if (typeof mod.installBrowsersForNpmInstall === 'function') {
      await mod.installBrowsersForNpmInstall(['chromium']);
    } else if (typeof (mod as any).install === 'function') {
      await (mod as any).install(['chromium']);
    } else {
      throw new Error('Programmatic install not available');
    }
  } catch {
    const bunxPath = which('bunx');
    const npxPath = which('npx');

    if (bunxPath) {
      await run([bunxPath, 'playwright', 'install', 'chromium']);
    } else if (npxPath) {
      await run([npxPath, 'playwright', 'install', 'chromium']);
    } else {
      throw new Error(
        'Could not install Playwright Chromium automatically. Please install manually:\n' +
        '  bunx playwright install chromium'
      );
    }
  }

  const ready = await isPlaywrightChromiumReady();
  if (!ready) {
    throw new Error('Playwright Chromium installation failed or browser is not launchable.');
  }

  console.log('\u2705 Playwright Chromium installed successfully');
}

function isFfmpegAvailable(): boolean {
  return Boolean(which('ffmpeg'));
}

async function installFfmpeg(): Promise<void> {
  if (isFfmpegAvailable()) {
    console.log('\u2705 ffmpeg is already installed');
    return;
  }

  const platform = getPlatform();

  if (platform === 'macos') {
    const brewPath = which('brew');
    if (brewPath) {
      console.log('\ud83d\udd0d Installing ffmpeg via Homebrew...');
      const { code } = await run([brewPath, 'install', 'ffmpeg']);
      if (code !== 0) {
        throw new Error('Failed to install ffmpeg via Homebrew');
      }
      console.log('\u2705 ffmpeg installed successfully');
    } else {
      throw new Error(
        'ffmpeg not found. Please install it manually:\n' +
        '  brew install ffmpeg\n' +
        'Or install via your package manager.'
      );
    }
  } else if (platform === 'linux') {
    const aptGetPath = which('apt-get');
    if (aptGetPath) {
      console.log('\ud83d\udd0d Installing ffmpeg via apt-get...');
      await run([aptGetPath, 'update'], { sudo: true });
      const { code } = await run([aptGetPath, 'install', '-y', 'ffmpeg'], { sudo: true });
      if (code !== 0) {
        throw new Error('Failed to install ffmpeg via apt-get');
      }
      console.log('\u2705 ffmpeg installed successfully');
    } else {
      throw new Error(
        'ffmpeg not found. Please install it manually via your package manager.'
      );
    }
  } else {
    throw new Error(
      'ffmpeg not found. Please install it manually for your platform.'
    );
  }
}

async function installLinuxPlaywrightSystemDeps(): Promise<void> {
  const platform = getPlatform();
  if (platform !== 'linux') return;

  const aptGetPath = which('apt-get');
  if (!aptGetPath) {
    console.log('\u26a0\ufe0f apt-get not found. Skipping system dependencies.');
    console.log('   For Linux, install the required libraries manually:');
    console.log('   See: https://playwright.dev/docs/browsers#install-system-dependencies');
    return;
  }

  console.log('\ud83d\udd0d Installing Playwright system dependencies (Linux)...');
  try {
    await run([aptGetPath, 'update'], { sudo: true });
    await run([aptGetPath, 'install', '-y',
      'ca-certificates',
      'fonts-liberation',
      'libasound2t64',
      'libatk-bridge2.0-0',
      'libatk1.0-0',
      'libatspi2.0-0',
      'libgtk-3-0',
      'libnss3',
    ], { sudo: true });
    console.log('\u2705 System dependencies installed successfully');
  } catch (error) {
    console.log('\u26a0\ufe0f Failed to install some system dependencies (continuing anyway)');
    console.log('   You may need to install them manually:');
    console.log('   See: https://playwright.dev/docs/browsers#install-system-dependencies');
  }
}

export interface InstallOptions {
  withDeps?: boolean;
}

export async function runInstall(options: InstallOptions = {}): Promise<void> {
  if (options.withDeps) {
    const platform = getPlatform();
    if (platform === 'linux') {
      await installLinuxPlaywrightSystemDeps();
    }
    await installFfmpeg();
  }

  const ready = await isPlaywrightChromiumReady();
  if (ready) {
    console.log('\u2705 Playwright Chromium is already installed');
    return;
  }

  await installPlaywrightChromium();
}
