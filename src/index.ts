#!/usr/bin/env bun

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import { VideoExtractor } from './extractor.ts';
import { downloadVideo } from './downloader.ts';
import { ensurePlaywrightReady, runInstall, InstallOptions } from './installer.ts';
import { generateFilename, isValidTwitterUrl, parseTweetUrl } from './utils.ts';

interface CliOptions {
  url?: string;
  output?: string;
  urlOnly?: boolean;
  quality?: 'best' | 'worst';
  timeout?: number;
  headed?: boolean;
  profile?: string;
  login?: boolean;
}

interface InstallCliOptions {
  withDeps?: boolean;
  help?: boolean;
}

const DEFAULT_PROFILE_DIR = path.join(os.homedir(), '.x-dl-profile');
const LEGACY_PROFILE_DIR = path.join(os.homedir(), '.x-video-profile');

function getDefaultProfileDir(): string {
  // Preserve existing users' sessions if they already logged in with x-video.
  if (fs.existsSync(LEGACY_PROFILE_DIR) && !fs.existsSync(DEFAULT_PROFILE_DIR)) {
    return LEGACY_PROFILE_DIR;
  }
  return DEFAULT_PROFILE_DIR;
}

function expandHomeDir(p: string): string {
  if (p.startsWith('~/')) {
    return path.join(os.homedir(), p.slice(2));
  }
  if (p === '~') {
    return os.homedir();
  }
  return p;
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
          options.profile = getDefaultProfileDir();
        } else {
          options.profile = nextArg;
          i++;
        }
        break;
      }
      case '--login':
        options.login = true;
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

function showHelp(): void {
  console.log(`
x-dl - Download videos from X/Twitter tweets

USAGE:
  x-dl [OPTIONS] <URL>
  x-dl install [OPTIONS]

OPTIONS:
  --url, -u <url>           Tweet URL to extract from
  --output, -o <path>       Output directory or file path (default: current directory)
  --url-only                Only print the video URL, don't download
  --quality <best|worst>    Video quality preference (default: best)
  --timeout <seconds>       Page load timeout in seconds (default: 30)
  --headed                  Show browser window for debugging
  --profile [dir]           Persistent profile dir for authenticated extraction (default: ~/.x-dl-profile)
  --login                   Open X in a persistent profile and wait for you to log in
  --help, -h                Show this help message

INSTALL:
  x-dl install               Install Playwright Chromium only
  x-dl install --with-deps   Install Chromium + ffmpeg + Linux deps (may require sudo on Linux)

AUTH EXAMPLES:
  # Create/reuse a persistent login session
  x-dl --login --profile ~/.x-dl-profile

  # Extract using the authenticated profile
  x-dl --profile ~/.x-dl-profile https://x.com/user/status/123
  `);
}

function showInstallHelp(): void {
  console.log(`
x-dl install - Install Playwright Chromium and optional dependencies

USAGE:
  x-dl install [OPTIONS]

OPTIONS:
  --with-deps               Install ffmpeg and Linux system dependencies (may require sudo)
  --help, -h                Show this help message

EXAMPLES:
  x-dl install              Install Playwright Chromium only
  x-dl install --with-deps  Install Chromium + ffmpeg + Linux deps

NOTE:
  --with-deps may require sudo on Linux to install system packages.
  On macOS, Homebrew (brew) is used for ffmpeg installation.
  `);
}

function getOutputPath(tweetUrl: string, options: CliOptions): string {
  const tweetInfo = parseTweetUrl(tweetUrl);
  if (!tweetInfo) {
    return 'video.mp4';
  }

  const filename = generateFilename(tweetInfo, 'mp4');

  if (!options.output) {
    return filename;
  }

  if (options.output.endsWith('.mp4')) {
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

async function runLoginFlow(profileDir: string): Promise<void> {
  const { chromium } = await import('playwright');

  console.log(`\n\ud83d\udd10 Login mode`);
  console.log(`\ud83d\udcc1 Profile: ${profileDir}`);
  console.log('\ud83c\udf10 Opening https://x.com/home ...');
  console.log('\nLog in to X in the opened browser, then press Enter here to close.\n');

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
  });

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

  console.log('\ud83c\udfac x-dl - X/Twitter Video Extractor\n');

  const args = parseArgs(argv);

  const installed = await ensurePlaywrightReady();
  if (!installed) {
    console.error('\n\u274c Playwright Chromium is required. Try: bunx playwright install chromium\n');
    process.exit(1);
  }

  if (args.login) {
    const profileDir = expandHomeDir(args.profile || getDefaultProfileDir());
    await runLoginFlow(profileDir);
    process.exit(0);
  }

  if (!args.url) {
    console.error('\u274c Error: No URL provided');
    console.error('\nUsage: x-dl <url> [options]');
    console.error('Run: x-dl --help for more information\n');
    process.exit(1);
  }

  if (!isValidTwitterUrl(args.url)) {
    console.error('\u274c Error: Invalid X/Twitter URL');
    console.error('Please provide a valid tweet URL like: https://x.com/user/status/123456\n');
    process.exit(1);
  }

  const profileDir = args.profile ? expandHomeDir(args.profile) : undefined;

  const extractor = new VideoExtractor({
    timeout: args.timeout,
    headed: args.headed,
    profileDir,
  });

  const result = await extractor.extract(args.url);

  if (result.error || !result.videoUrl) {
    console.error(`\n\u274c ${result.error || 'Failed to extract video'}\n`);
    process.exit(1);
  }

  if (args.urlOnly) {
    console.log(`\n${result.videoUrl.url}\n`);
    process.exit(0);
  }

  if (result.videoUrl.format === 'm3u8') {
    console.error('\n❌ This tweet only exposes an HLS playlist (m3u8).');
    console.error('Use --url-only and download with a tool like yt-dlp or ffmpeg.');
    console.error(`\nPlaylist URL:\n${result.videoUrl.url}\n`);
    process.exit(1);
  }

  const outputPath = getOutputPath(args.url, args);

  try {
    await downloadVideo({
      url: result.videoUrl.url,
      outputPath,
      onProgress: (progress, downloaded, total) => {
        process.stdout.write(
          `\r\u23f3 Progress: ${progress.toFixed(1)}% (${formatBytes(downloaded)}/${formatBytes(total)})`
        );
      },
    });

    console.log(`\n\n\u2705 Video saved to: ${outputPath}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isAuthFailure = message.includes('status: 401') || message.includes('status: 403');

    if (isAuthFailure && profileDir) {
      console.log('\n\n\ud83d\udd10 Direct download was blocked; retrying with authenticated Playwright request...');
      await extractor.downloadAuthenticated(result.videoUrl.url, outputPath);
      console.log(`\n\n\u2705 Video saved to: ${outputPath}\n`);
      process.exit(0);
    }

    console.error(`\n\n\u274c Download failed: ${message}\n`);
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
  console.error('\n\u274c Unexpected error:', error);
  process.exit(1);
});
