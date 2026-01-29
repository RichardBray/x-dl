#!/usr/bin/env bun

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import { VideoExtractor } from './extractor.ts';
import { downloadVideo } from './downloader.ts';
import { ensurePlaywrightReady, runInstall, InstallOptions } from './installer.ts';
import { generateFilename, isValidTwitterUrl, parseTweetUrl } from './utils.ts';
import { downloadHlsWithFfmpeg } from './ffmpeg.ts';

interface CliOptions {
  url?: string;
  output?: string;
  urlOnly?: boolean;
  quality?: 'best' | 'worst';
  timeout?: number;
  headed?: boolean;
  profile?: string;
  login?: boolean;
  verifyAuth?: boolean;
  browserChannel?: 'chrome' | 'chromium' | 'msedge';
  browserExecutablePath?: string;
}

interface InstallCliOptions {
  withDeps?: boolean;
  help?: boolean;
}

const DEFAULT_PROFILE_DIR = path.join(os.homedir(), '.x-dl-profile');

function expandHomeDir(p: string): string {
  if (p.startsWith('~/')) {
    return path.join(os.homedir(), p.slice(2));
  }
  if (p === '~') {
    return os.homedir();
  }
  return p;
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
        options.timeout = parseInt(nextArg, 10) * 1000;
        i++;
        break;
      case '--headed':
        options.headed = true;
        break;
      case '--profile': {
        if (!nextArg || nextArg.startsWith('-')) {
          options.profile = DEFAULT_PROFILE_DIR;
        } else {
          options.profile = nextArg;
          i++;
        }
        break;
      }
      case '--login':
        options.login = true;
        break;
      case '--verify-auth':
        options.verifyAuth = true;
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
  --profile [dir]                   Persistent profile dir for authenticated extraction (default: ~/.x-dl-profile)
  --login                           Open X in a persistent profile and wait for you to log in
  --browser-channel <channel>       Browser channel: chrome, chromium, or msedge (default: chromium)
  --browser-executable-path <path>  Path to browser executable (optional, overrides channel)
  --help, -h                        Show this help message

INSTALL:
  x-dl install               Install Playwright Chromium only
  x-dl install --with-deps   Install Chromium + ffmpeg + Linux deps (may require sudo on Linux)

AUTH EXAMPLES:
  # Create/reuse a persistent login session
  ${commandName} --login --profile ~/.x-dl-profile

  # Extract using the authenticated profile
  ${commandName} --profile ~/.x-dl-profile https://x.com/user/status/123

BROWSER EXAMPLES:
  # Use Chrome instead of Chromium
  ${commandName} --browser-channel chrome https://x.com/user/status/123

  # Use Microsoft Edge
  ${commandName} --browser-channel msedge https://x.com/user/status/123

  # Use custom browser executable
  ${commandName} --browser-executable-path /path/to/browser https://x.com/user/status/123
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

async function waitForEnter(): Promise<void> {
  process.stdin.resume();
  return new Promise((resolve) => {
    process.stdin.once('data', () => resolve());
  });
}

async function runLoginFlow(
  profileDir: string,
  browserOptions?: { browserChannel?: string; browserExecutablePath?: string }
): Promise<void> {
  const { chromium } = await import('playwright');

  console.log(`\n🔐 Login mode`);
  console.log(`📁 Profile: ${profileDir}`);
  console.log('🌐 Opening https://x.com/home ...');
  console.log('\nLog in to X in the opened browser, then press Enter here to close.\n');

  const launchOptions: any = {
    headless: false,
  };

  if (browserOptions?.browserExecutablePath) {
    launchOptions.executablePath = browserOptions.browserExecutablePath;
  } else if (browserOptions?.browserChannel) {
    launchOptions.channel = browserOptions.browserChannel;
  }

  const context = await chromium.launchPersistentContext(profileDir, launchOptions);

  try {
    const page = await context.newPage();
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForEnter();
  } finally {
    await context.close();
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

  console.log('🎬 x-dl - X/Twitter Video Extractor\n');

  const args = parseArgs(argv);

  const installed = await ensurePlaywrightReady();
  if (!installed) {
    console.error('\n❌ Playwright Chromium is required. Try: bunx playwright install chromium\n');
    process.exit(1);
  }

  if (args.login) {
    const profileDir = expandHomeDir(args.profile || DEFAULT_PROFILE_DIR);
    await runLoginFlow(profileDir, {
      browserChannel: args.browserChannel,
      browserExecutablePath: args.browserExecutablePath,
    });
    process.exit(0);
  }

  if (args.verifyAuth) {
    const profileDir = expandHomeDir(args.profile || DEFAULT_PROFILE_DIR);
    const extractor = new VideoExtractor({ 
      profileDir,
      browserChannel: args.browserChannel,
      browserExecutablePath: args.browserExecutablePath,
    });
    const result = await extractor.verifyAuth();
    
    console.log('\nAuth Status:');
    console.log(`- Auth token present: ${result.hasAuthToken ? 'Yes' : 'No'}`);
    console.log(`- Can access X.com/home: ${result.canAccessHome ? 'Yes' : 'No'}`);
    console.log(`- Auth cookies found: ${result.authCookies.join(', ') || 'None'}`);
    console.log(`\n${result.message}\n`);
    
    process.exit(result.canAccessHome && result.hasAuthToken ? 0 : 1);
  }

  if (!args.url) {
    const commandName = getCommandName();
    console.error('❌ Error: No URL provided');
    console.error(`\nUsage: ${commandName} <url> [options]`);
    console.error(`Run: ${commandName} --help for more information\n`);
    process.exit(1);
  }

  if (!isValidTwitterUrl(args.url)) {
    console.error('❌ Error: Invalid X/Twitter URL');
    console.error('Please provide a valid tweet URL like: https://x.com/user/status/123456\n');
    process.exit(1);
  }

  const profileDir = args.profile ? expandHomeDir(args.profile) : undefined;

  const extractor = new VideoExtractor({
    timeout: args.timeout,
    headed: args.headed,
    profileDir,
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

  const outputPath = getOutputPath(args.url, args, defaultExtension);

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
      await downloadHlsWithFfmpeg({
        playlistUrl: result.videoUrl.url,
        outputPath,
      });
      console.log(`\n✅ Video saved to: ${outputPath}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\n\n❌ HLS download failed: ${message}\n`);
      process.exit(1);
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
    const isAuthFailure = message.includes('status: 401') || message.includes('status: 403');

    if (isAuthFailure && profileDir) {
      console.log('\n\n🔐 Direct download was blocked; retrying with authenticated Playwright request...');
      await extractor.downloadAuthenticated(result.videoUrl.url, outputPath);
      console.log(`\n\n✅ Video saved to: ${outputPath}\n`);
      process.exit(0);
    }

    console.error(`\n\n❌ Download failed: ${message}\n`);
    process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

main().catch((error) => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
