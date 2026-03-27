#!/usr/bin/env bun

import os from 'node:os';
import path from 'node:path';

import { VideoExtractor } from './extractor.ts';
import { downloadVideo } from './downloader.ts';
import { ensurePlaywrightReady, runInstall } from './installer.ts';
import { generateFilename, isValidTwitterUrl, parseTweetUrl, formatBytes, hasLoginWall } from './utils.ts';
import { downloadHlsWithFfmpeg, clipLocalFile, mmssToSeconds } from './ffmpeg.ts';
import { launchPrivateBrowser, handlePrivateLogin } from './private.ts';

interface CliOptions {
  url?: string;
  output?: string;
  urlOnly?: boolean;
  quality?: 'best' | 'worst';
  timeout?: number;
  headed?: boolean;
  browserChannel?: 'chrome' | 'chromium' | 'msedge';
  browserExecutablePath?: string;
  clipFrom?: string;
  clipTo?: string;
}

interface InstallCliOptions {
  withDeps?: boolean;
  help?: boolean;
}

function getDefaultDownloadsDir(): string {
  const platform = os.platform();
  
  if (platform === 'darwin' || platform === 'linux') {
    return path.join(os.homedir(), 'Downloads');
  }
  
  return process.cwd();
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--url':
      case '-u':
        options.url = nextArg;
        i++;
        break;
      case '--output':
      case '-o':
        options.output = nextArg;
        i++;
        break;
      case '--url-only':
        options.urlOnly = true;
        break;
      case '--quality':
        if (nextArg === 'best' || nextArg === 'worst') {
          options.quality = nextArg;
          i++;
        }
        break;
      case '--timeout':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('❌ Error: --timeout requires a numeric value (e.g., --timeout 30)');
          console.error('Usage: x-dl --timeout <seconds> <url>');
          process.exit(1);
        }
        const timeoutSeconds = parseInt(nextArg, 10);
        if (isNaN(timeoutSeconds) || timeoutSeconds <= 0) {
          console.error('❌ Error: --timeout must be a positive number');
          console.error(`Invalid value: ${nextArg}`);
          process.exit(1);
        }
        options.timeout = timeoutSeconds * 1000;
        i++;
        break;
      case '--headed':
        options.headed = true;
        break;
      case '--browser-channel':
        if (nextArg === 'chrome' || nextArg === 'chromium' || nextArg === 'msedge') {
          options.browserChannel = nextArg;
          i++;
        }
        break;
      case '--browser-executable-path':
        if (nextArg) {
          options.browserExecutablePath = nextArg;
          i++;
        }
        break;
      case '--from':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('❌ Error: --from requires a time value (e.g., --from 00:30)');
          process.exit(1);
        }
        if (!/^\d{2}:\d{2}$/.test(nextArg)) {
          console.error(`❌ Error: --from must be in MM:SS format (got: ${nextArg})`);
          process.exit(1);
        }
        options.clipFrom = nextArg;
        i++;
        break;
      case '--to':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('❌ Error: --to requires a time value (e.g., --to 01:30)');
          process.exit(1);
        }
        if (!/^\d{2}:\d{2}$/.test(nextArg)) {
          console.error(`❌ Error: --to must be in MM:SS format (got: ${nextArg})`);
          process.exit(1);
        }
        options.clipTo = nextArg;
        i++;
        break;
      case '--version':
      case '-v':
        showVersion();
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('-') && !options.url) {
          options.url = arg;
        }
        break;
    }
  }

  return options;
}

function getCommandName(): string {
  const scriptPath = process.argv[1];
  const basename = path.basename(scriptPath);
  return basename;
}

function showHelp(): void {
  const commandName = getCommandName();
  console.log(`
${commandName} - Download videos from X/Twitter tweets

USAGE:
  ${commandName} [OPTIONS] <URL>

OPTIONS:
  --url, -u <url>                   Tweet URL to extract from
  --output, -o <path>               Output directory or file path (default: ~/Downloads)
  --url-only                        Only print the video URL, don't download
  --quality <best|worst>            Video quality preference (default: best)
  --timeout <seconds>               Page load timeout in seconds (default: 30)
  --headed                          Show browser window for debugging
  --browser-channel <channel>       Browser channel: chrome, chromium, or msedge (default: chromium)
  --browser-executable-path <path>  Path to browser executable (optional, overrides channel)
  --from <MM:SS>                    Clip start time (e.g., 00:30)
  --to <MM:SS>                      Clip end time (e.g., 01:30)
  --version, -v                     Show version information
  --help, -h                        Show this help message

INSTALL:
  x-dl install               Install Playwright Chromium only
  x-dl install --with-deps   Install Chromium + ffmpeg + Linux deps (may require sudo on Linux)

CDP MODE (Private Tweets):
  ${commandName} cdp <url>                    Use Chrome to download private tweets

  First run will open Chrome for you to log in to X/Twitter.
  Subsequent runs reuse the saved session (~/.x-dl-chrome-profile).

  Requires Google Chrome installed on your system.

BROWSER EXAMPLES:
  # Use Chrome instead of Chromium
  ${commandName} --browser-channel chrome https://x.com/user/status/123

  # Use Microsoft Edge
  ${commandName} --browser-channel msedge https://x.com/user/status/123

  # Use custom browser executable
  ${commandName} --browser-executable-path /path/to/browser https://x.com/user/status/123

CLIP EXAMPLES:
  # Download only 30s–90s of a video
  ${commandName} --from 00:30 --to 01:30 https://x.com/user/status/123

  # Download from 1 minute to end
  ${commandName} --from 01:00 https://x.com/user/status/123
  `);
}

function showInstallHelp(): void {
  const commandName = getCommandName();
  console.log(`
${commandName} install - Install dependencies

USAGE:
  ${commandName} install [OPTIONS]

OPTIONS:
  --with-deps              Install Chromium + ffmpeg + Linux deps (may require sudo on Linux)
  --help, -h               Show this help message

INSTALL DETAILS:
  Playwright Chromium is required for video extraction from X/Twitter.
  
  With --with-deps:
    - Installs Playwright Chromium
    - Installs ffmpeg (required for HLS/m3u8 video downloads)
    - Installs Linux system dependencies (Linux only)
    - On Linux, sudo may be required for system dependencies

  Without --with-deps:
    - Installs only Playwright Chromium

EXAMPLES:
  ${commandName} install
  ${commandName} install --with-deps
`);
}

function showVersion(): void {
  const pkg = require('../package.json');
  console.log(pkg.version);
  process.exit(0);
}

function getOutputPath(tweetUrl: string, options: CliOptions, preferredExtension: string = 'mp4'): string {
  const tweetInfo = parseTweetUrl(tweetUrl);
  if (!tweetInfo) {
    const defaultDir = getDefaultDownloadsDir();
    return path.join(defaultDir, `video.${preferredExtension}`);
  }

  const filename = generateFilename(tweetInfo, preferredExtension);

  if (!options.output) {
    const defaultDir = getDefaultDownloadsDir();
    return path.join(defaultDir, filename);
  }

  if (path.extname(options.output) !== '') {
    return options.output;
  }

  if (options.output.endsWith('/')) {
    return `${options.output}${filename}`;
  }

  return `${options.output}/${filename}`;
}

interface CdpCliOptions {
  url?: string;
  output?: string;
  urlOnly?: boolean;
  quality?: 'best' | 'worst';
  timeout?: number;
  clipFrom?: string;
  clipTo?: string;
}

function parseCdpArgs(args: string[]): CdpCliOptions {
  const options: CdpCliOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--output':
      case '-o':
        options.output = nextArg;
        i++;
        break;
      case '--url-only':
        options.urlOnly = true;
        break;
      case '--quality':
        if (nextArg === 'best' || nextArg === 'worst') {
          options.quality = nextArg;
          i++;
        }
        break;
      case '--timeout':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('❌ Error: --timeout requires a numeric value');
          process.exit(1);
        }
        const timeoutSeconds = parseInt(nextArg, 10);
        if (isNaN(timeoutSeconds) || timeoutSeconds <= 0) {
          console.error('❌ Error: --timeout must be a positive number');
          process.exit(1);
        }
        options.timeout = timeoutSeconds * 1000;
        i++;
        break;
      case '--from':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('❌ Error: --from requires a time value (e.g., --from 00:30)');
          process.exit(1);
        }
        if (!/^\d{2}:\d{2}$/.test(nextArg)) {
          console.error(`❌ Error: --from must be in MM:SS format (got: ${nextArg})`);
          process.exit(1);
        }
        options.clipFrom = nextArg;
        i++;
        break;
      case '--to':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('❌ Error: --to requires a time value (e.g., --to 01:30)');
          process.exit(1);
        }
        if (!/^\d{2}:\d{2}$/.test(nextArg)) {
          console.error(`❌ Error: --to must be in MM:SS format (got: ${nextArg})`);
          process.exit(1);
        }
        options.clipTo = nextArg;
        i++;
        break;
      default:
        if (!arg.startsWith('-') && !options.url) {
          options.url = arg;
        }
        break;
    }
  }

  return options;
}

async function handleCdpMode(argv: string[]): Promise<void> {
  const args = parseCdpArgs(argv);
  const commandName = getCommandName();

  if (!args.url) {
    console.error('❌ Error: No URL provided');
    console.error(`\nUsage: ${commandName} cdp <url> [options]`);
    console.error(`Run: ${commandName} --help for more information\n`);
    process.exit(1);
  }

  if (!isValidTwitterUrl(args.url)) {
    console.error('❌ Error: Invalid X/Twitter URL');
    console.error('Please provide a valid tweet URL like: https://x.com/user/status/123456\n');
    process.exit(1);
  }

  console.log('🎬 x-dl - X/Twitter Video Extractor (private mode)\n');

  const installed = await ensurePlaywrightReady();
  if (!installed) {
    console.error('\n❌ Playwright is required. Try: bunx playwright install chromium\n');
    process.exit(1);
  }

  let connection;
  try {
    connection = await launchPrivateBrowser();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${message}\n`);
    process.exit(1);
  }

  try {
    const extractor = new VideoExtractor({
      timeout: args.timeout,
    });

    let result = await extractor.extract(args.url, connection.page);

    // If login wall detected, trigger login flow and retry
    if (!result.videoUrl && result.errorClassification === 'login_wall') {
      connection = await handlePrivateLogin(connection);
      result = await extractor.extract(args.url, connection.page);
    }

    if (result.error || !result.videoUrl) {
      console.error(`\n❌ ${result.error || 'Failed to extract video'}\n`);
      process.exit(1);
    }

    if (args.urlOnly) {
      console.log(`\n${result.videoUrl.url}\n`);
      process.exit(0);
    }

    let defaultExtension = 'mp4';
    if (result.videoUrl.format === 'm3u8') {
      defaultExtension = 'mp4';
    } else if (result.videoUrl.format !== 'unknown') {
      defaultExtension = result.videoUrl.format;
    }

    const cliOpts: CliOptions = { output: args.output };
    const basePath = getOutputPath(args.url, cliOpts, defaultExtension);
    const isClipping = args.clipFrom || args.clipTo;

    if (args.clipFrom && args.clipTo) {
      const fromSecs = mmssToSeconds(args.clipFrom);
      const toSecs = mmssToSeconds(args.clipTo);
      if (toSecs <= fromSecs) {
        console.error('❌ Error: --to must be after --from');
        process.exit(1);
      }
    }

    const outputPath = isClipping
      ? path.join(path.dirname(basePath), `${path.basename(basePath, path.extname(basePath))}_clip${path.extname(basePath)}`)
      : basePath;

    if (result.videoUrl.format === 'm3u8') {
      const { ensureFfmpegReady } = await import('./installer.ts');
      const ffmpegReady = await ensureFfmpegReady();

      if (!ffmpegReady) {
        console.error('\n❌ ffmpeg is required to download HLS (m3u8) videos.');
        console.error('Please install ffmpeg:');
        console.error('  macOS:   brew install ffmpeg');
        console.error('  Linux:   sudo apt-get install ffmpeg');
        console.error(`\nPlaylist URL:\n${result.videoUrl.url}\n`);
        process.exit(1);
      }

      try {
        const fromSecs = args.clipFrom ? mmssToSeconds(args.clipFrom) : undefined;
        const toSecs = args.clipTo ? mmssToSeconds(args.clipTo) : undefined;
        const durationSecs = toSecs !== undefined ? toSecs - (fromSecs ?? 0) : undefined;

        await downloadHlsWithFfmpeg({
          playlistUrl: result.videoUrl.url,
          outputPath,
          clipFromSecs: fromSecs,
          clipDurationSecs: durationSecs,
        });
        console.log(`\n✅ Video saved to: ${outputPath}\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stdout.write('\r\x1b[K');
        console.error(`❌ HLS download failed: ${message}\n`);
        process.exit(1);
      }
      return;
    }

    if (isClipping) {
      const { ensureFfmpegReady: ensureFfmpegReadyForClip } = await import('./installer.ts');
      const ffmpegReady = await ensureFfmpegReadyForClip();
      if (!ffmpegReady) {
        console.error('\n❌ ffmpeg is required to clip videos.');
        console.error('Please install ffmpeg:');
        console.error('  macOS:   brew install ffmpeg');
        console.error('  Linux:   sudo apt-get install ffmpeg');
        process.exit(1);
      }

      const osModule = await import('node:os');
      const fsModule = await import('node:fs');
      const tmpPath = path.join(osModule.tmpdir(), `x-dl-tmp-${Date.now()}.mp4`);

      try {
        await downloadVideo({
          url: result.videoUrl.url,
          outputPath: tmpPath,
          onProgress: (progress, downloaded, total) => {
            process.stdout.write(
              `\r⏳ Downloading: ${progress.toFixed(1)}% (${formatBytes(downloaded)}/${formatBytes(total)})`
            );
          },
        });
        process.stdout.write('\n');

        await clipLocalFile({
          inputPath: tmpPath,
          outputPath,
          clipFrom: args.clipFrom,
          clipTo: args.clipTo,
        });

        console.log(`\n✅ Video saved to: ${outputPath}\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stdout.write('\r\x1b[K');
        console.error(`❌ Failed: ${message}\n`);
        if (fsModule.existsSync(tmpPath)) fsModule.unlinkSync(tmpPath);
        process.exit(1);
      } finally {
        if (fsModule.existsSync(tmpPath)) fsModule.unlinkSync(tmpPath);
      }
      return;
    }

    try {
      await downloadVideo({
        url: result.videoUrl.url,
        outputPath,
        onProgress: (progress, downloaded, total) => {
          process.stdout.write(
            `\r⏳ Progress: ${progress.toFixed(1)}% (${formatBytes(downloaded)}/${formatBytes(total)})`
          );
        },
      });

      console.log(`\n\n✅ Video saved to: ${outputPath}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write('\r\x1b[K');
      console.error(`❌ Download failed: ${message}\n`);
      process.exit(1);
    }
  } finally {
    await connection.cleanup();
  }
}

async function handleInstallMode(args: string[]): Promise<void> {
  const options: InstallCliOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--with-deps':
        options.withDeps = true;
        break;
      case '--help':
      case '-h':
        showInstallHelp();
        process.exit(0);
        break;
      default:
        console.error(`\u274c Unknown flag for install: ${arg}`);
        console.error('\nRun: x-dl install --help for more information\n');
        process.exit(1);
    }
  }

  console.log('\ud83c\udfac x-dl - X/Twitter Video Extractor\n');

  try {
    await runInstall(options);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n\u274c Install failed: ${message}\n`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv[0] === 'install') {
    await handleInstallMode(argv.slice(1));
    return;
  }

  if (argv[0] === 'cdp') {
    await handleCdpMode(argv.slice(1));
    return;
  }

  const args = parseArgs(argv);

  if (!args.url) {
    const commandName = getCommandName();
    console.error('❌ Error: No URL provided');
    console.error(`\nUsage: ${commandName} <url> [options]`);
    console.error(`Run: ${commandName} --help for more information\n`);
    process.exit(1);
  }

  console.log('🎬 x-dl - X/Twitter Video Extractor\n');

  const installed = await ensurePlaywrightReady();
  if (!installed) {
    console.error('\n❌ Playwright Chromium is required. Try: bunx playwright install chromium\n');
    process.exit(1);
  }

  const { ensureFfmpegReady } = await import('./installer.ts');
  const ffmpegReady = await ensureFfmpegReady();
  if (!ffmpegReady) {
    console.warn('⚠️ ffmpeg is not available. HLS (m3u8) downloads will not work.');
  }

  if (!isValidTwitterUrl(args.url)) {
    console.error('❌ Error: Invalid X/Twitter URL');
    console.error('Please provide a valid tweet URL like: https://x.com/user/status/123456\n');
    process.exit(1);
  }

  const extractor = new VideoExtractor({
    timeout: args.timeout,
    headed: args.headed,
    browserChannel: args.browserChannel,
    browserExecutablePath: args.browserExecutablePath,
  });

  const result = await extractor.extract(args.url);

  if (result.error || !result.videoUrl) {
    console.error(`\n❌ ${result.error || 'Failed to extract video'}\n`);
    process.exit(1);
  }

  if (args.urlOnly) {
    console.log(`\n${result.videoUrl.url}\n`);
    process.exit(0);
  }

  let defaultExtension = 'mp4';
  if (result.videoUrl.format === 'm3u8') {
    defaultExtension = 'mp4';
  } else if (result.videoUrl.format !== 'unknown') {
    defaultExtension = result.videoUrl.format;
  }

  const basePath = getOutputPath(args.url, args, defaultExtension);
  const isClipping = args.clipFrom || args.clipTo;

  if (args.clipFrom && args.clipTo) {
    const fromSecs = mmssToSeconds(args.clipFrom);
    const toSecs = mmssToSeconds(args.clipTo);
    if (toSecs <= fromSecs) {
      console.error('❌ Error: --to must be after --from');
      process.exit(1);
    }
  }

  const outputPath = isClipping
    ? path.join(path.dirname(basePath), `${path.basename(basePath, path.extname(basePath))}_clip${path.extname(basePath)}`)
    : basePath;

  if (result.videoUrl.format === 'm3u8') {
    const { ensureFfmpegReady } = await import('./installer.ts');
    const ffmpegReady = await ensureFfmpegReady();

    if (!ffmpegReady) {
      console.error('\n❌ ffmpeg is required to download HLS (m3u8) videos.');
      console.error('Please install ffmpeg:');
      console.error('  macOS:   brew install ffmpeg');
      console.error('  Linux:   sudo apt-get install ffmpeg  # or dnf/yum/pacman equivalent');
      console.error('  Windows: winget install ffmpeg');
      console.error(`\nPlaylist URL:\n${result.videoUrl.url}\n`);
      process.exit(1);
    }

    try {
      const fromSecs = args.clipFrom ? mmssToSeconds(args.clipFrom) : undefined;
      const toSecs = args.clipTo ? mmssToSeconds(args.clipTo) : undefined;
      const durationSecs = toSecs !== undefined ? toSecs - (fromSecs ?? 0) : undefined;

      await downloadHlsWithFfmpeg({
        playlistUrl: result.videoUrl.url,
        outputPath,
        clipFromSecs: fromSecs,
        clipDurationSecs: durationSecs,
      });
      console.log(`\n✅ Video saved to: ${outputPath}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write('\r\x1b[K');
      console.error(`❌ HLS download failed: ${message}\n`);
      process.exit(1);
    }
    return;
  }

  if (isClipping) {
    const { ensureFfmpegReady: ensureFfmpegReadyForClip } = await import('./installer.ts');
    const ffmpegReady = await ensureFfmpegReadyForClip();
    if (!ffmpegReady) {
      console.error('\n❌ ffmpeg is required to clip videos.');
      console.error('Please install ffmpeg:');
      console.error('  macOS:   brew install ffmpeg');
      console.error('  Linux:   sudo apt-get install ffmpeg');
      process.exit(1);
    }

    // Download the full video first, then clip locally.
    // ffmpeg can't access X/Twitter direct MP4 URLs (auth headers required).
    const os = await import('node:os');
    const fs = await import('node:fs');
    const tmpPath = path.join(os.tmpdir(), `x-dl-tmp-${Date.now()}.mp4`);

    try {
      await downloadVideo({
        url: result.videoUrl.url,
        outputPath: tmpPath,
        onProgress: (progress, downloaded, total) => {
          process.stdout.write(
            `\r⏳ Downloading: ${progress.toFixed(1)}% (${formatBytes(downloaded)}/${formatBytes(total)})`
          );
        },
      });
      process.stdout.write('\n');

      await clipLocalFile({
        inputPath: tmpPath,
        outputPath,
        clipFrom: args.clipFrom,
        clipTo: args.clipTo,
      });

      console.log(`\n✅ Video saved to: ${outputPath}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write('\r\x1b[K');
      console.error(`❌ Failed: ${message}\n`);
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      process.exit(1);
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
    return;
  }

  try {
    await downloadVideo({
      url: result.videoUrl.url,
      outputPath,
      onProgress: (progress, downloaded, total) => {
        process.stdout.write(
          `\r⏳ Progress: ${progress.toFixed(1)}% (${formatBytes(downloaded)}/${formatBytes(total)})`
        );
      },
    });

    console.log(`\n\n✅ Video saved to: ${outputPath}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write('\r\x1b[K');
    console.error(`❌ Download failed: ${message}\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
