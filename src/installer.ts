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
