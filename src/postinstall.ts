import { spawn } from 'node:child_process';

console.log('\ud83d\udce6 Running postinstall setup...\n');

async function runCommand(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { stdio: 'inherit' });
    proc.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

async function main(): Promise<void> {
  console.log('\ud83d\udd0d Installing Playwright Chromium...');
  const playwrightOk = await runCommand('bunx', ['playwright', 'install', 'chromium']);

  if (!playwrightOk) {
    console.error('\u274c Failed to install Playwright Chromium');
    process.exit(1);
  }

  console.log('\u2705 Playwright Chromium installed');

  console.log('\ud83d\udd0d Checking ffmpeg...');
  const { ensureFfmpegReady } = await import('./installer.ts');
  const ffmpegOk = await ensureFfmpegReady();

  if (!ffmpegOk) {
    console.warn('\u26a0\ufe0f ffmpeg is not available. HLS (m3u8) downloads will not work.');
    console.warn('Please install ffmpeg:');
    console.warn('  macOS:   brew install ffmpeg');
    console.warn('  Linux:   sudo apt-get install ffmpeg  # or dnf/yum/pacman equivalent');
    console.warn('  Windows: winget install ffmpeg');
  } else {
    console.log('\u2705 ffmpeg is ready');
  }

  console.log('\n\u2705 Postinstall setup complete!\n');
}

main().catch((error) => {
  console.error('\u274c Postinstall failed:', error);
  process.exit(1);
});
