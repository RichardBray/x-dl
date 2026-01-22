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

export async function ensureFfmpegReady(): Promise<boolean> {
  console.log('\ud83d\udd0d Checking for ffmpeg...');

  try {
    const { checkFfmpegCapabilities, hasRequiredFfmpegCapabilities } = await import('./ffmpeg.ts');
    const { commandExists } = await import('./utils.ts');

    const exists = await commandExists('ffmpeg');
    if (!exists) {
      console.warn('\u26a0\ufe0f ffmpeg not found in PATH');
      const installed = await attemptFfmpegInstall();
      if (!installed) {
        return false;
      }
    }

    const capabilities = await checkFfmpegCapabilities();

    if (!capabilities.available || capabilities.error) {
      console.error('\u274c ffmpeg is not available');
      if (capabilities.error) {
        console.error(capabilities.error);
      }
      return false;
    }

    const required = hasRequiredFfmpegCapabilities(capabilities);

    if (!required.has) {
      console.error('\u274c ffmpeg is missing required capabilities:');
      for (const missing of required.missing) {
        console.error(`  - ${missing}`);
      }
      return false;
    }

    console.log('\u2705 ffmpeg is ready');
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('\u274c Failed to verify ffmpeg:', message);
    return false;
  }
}

async function attemptFfmpegInstall(): Promise<boolean> {
  const platform = process.platform;

  console.log('\u26a0\ufe0f Attempting to auto-install ffmpeg...');

  if (platform === 'darwin') {
    const { commandExists } = await import('./utils.ts');
    const hasBrew = await commandExists('brew');

    if (hasBrew) {
      try {
        console.log('Running: brew install ffmpeg');
        const { spawn } = await import('node:child_process');
        await new Promise<void>((resolve, reject) => {
          const proc = spawn('brew', ['install', 'ffmpeg'], {
            stdio: 'inherit',
          });
          proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`brew install ffmpeg failed with code ${code}`));
          });
        });
        console.log('\u2705 ffmpeg installed via Homebrew');
        return true;
      } catch (error) {
        console.error('\u274c Failed to install ffmpeg via Homebrew');
        return false;
      }
    } else {
      console.error('Homebrew not found. Please install Homebrew first: https://brew.sh');
    }
  } else if (platform === 'linux') {
    const packageManagers = [
      { cmd: 'apt-get', install: ['install', '-y', 'ffmpeg'] },
      { cmd: 'dnf', install: ['install', '-y', 'ffmpeg'] },
      { cmd: 'yum', install: ['install', '-y', 'ffmpeg'] },
      { cmd: 'pacman', install: ['-S', '--noconfirm', 'ffmpeg'] },
      { cmd: 'apk', install: ['add', 'ffmpeg'] },
    ];

    const { commandExists } = await import('./utils.ts');

    for (const pm of packageManagers) {
      const exists = await commandExists(pm.cmd);
      if (exists) {
        try {
          console.log(`Running: ${pm.cmd} ${pm.install.join(' ')}`);
          const { spawn } = await import('node:child_process');
          await new Promise<void>((resolve, reject) => {
            const proc = spawn(pm.cmd, pm.install, {
              stdio: 'inherit',
            });
            proc.on('close', (code) => {
              if (code === 0) resolve();
              else reject(new Error(`${pm.cmd} install failed with code ${code}`));
            });
          });
          console.log(`\u2705 ffmpeg installed via ${pm.cmd}`);
          return true;
        } catch (error) {
          console.error(`\u274c Failed to install ffmpeg via ${pm.cmd}`);
          continue;
        }
      }
    }
  } else if (platform === 'win32') {
    const { commandExists } = await import('./utils.ts');
    const hasWinget = await commandExists('winget');

    if (hasWinget) {
      try {
        console.log('Running: winget install ffmpeg');
        const { spawn } = await import('node:child_process');
        await new Promise<void>((resolve, reject) => {
          const proc = spawn('winget', ['install', '--accept-source-agreements', '--accept-package-agreements', 'Gyan.FFmpeg'], {
            stdio: 'inherit',
          });
          proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`winget install ffmpeg failed with code ${code}`));
          });
        });
        console.log('\u2705 ffmpeg installed via winget');
        return true;
      } catch (error) {
        console.error('\u274c Failed to install ffmpeg via winget');
        return false;
      }
    }
  }

  console.error('\n\u274c Could not auto-install ffmpeg. Please install it manually:');
  console.error('  macOS:   brew install ffmpeg');
  console.error('  Linux:   sudo apt-get install ffmpeg  # or dnf/yum/pacman equivalent');
  console.error('  Windows: winget install ffmpeg');
  return false;
}
