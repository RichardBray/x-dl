import type { Browser, BrowserContext, Page } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

import { ExtractOptions, ExtractResult, VideoUrl, ErrorClassification } from './types.ts';
import {
  extractBitrate,
  generateFilename,
  getVideoFormat,
  hasLoginWall,
  isPrivateTweet,
  isValidTwitterUrl,
  parseTweetUrl,
} from './utils.ts';

type ExtractCandidate = {
  url: string;
  format: VideoUrl['format'];
  width?: number;
  height?: number;
  score?: number;
  audioOnly?: boolean;
};

export class VideoExtractor {
  private timeout: number;
  private headed: boolean;
  private profileDir?: string;
  private debugArtifactsDir?: string;
  private browserChannel?: 'chrome' | 'chromium' | 'msedge';
  private browserExecutablePath?: string;

  constructor(options: ExtractOptions) {
    this.timeout = options.timeout || 30000;
    this.headed = options.headed || false;
    this.profileDir = options.profileDir;
    this.debugArtifactsDir = options.debugArtifactsDir;
    this.browserChannel = options.browserChannel;
    this.browserExecutablePath = options.browserExecutablePath;
  }

  async extract(url: string): Promise<ExtractResult> {
    console.log(`\ud83c\udfac Extracting video from: ${url}`);

    if (!isValidTwitterUrl(url)) {
      return {
        videoUrl: null,
        error: 'Invalid X/Twitter URL. Please provide a valid tweet URL.',
        errorClassification: ErrorClassification.INVALID_URL,
      };
    }

    const tweetInfo = parseTweetUrl(url);
    if (!tweetInfo) {
      return {
        videoUrl: null,
        error: 'Failed to parse tweet URL.',
        errorClassification: ErrorClassification.PARSE_ERROR,
      };
    }

    console.log(`\ud83d\udcdd Tweet: @${tweetInfo.author} (ID: ${tweetInfo.id})`);

    const { chromium } = await import('playwright');

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      ({ browser, context, page } = await this.createContextAndPage(chromium));

      const candidates = new Set<string>();
      page.on('response', async (resp) => {
        const u = resp.url();
        if (!u.includes('video.twimg.com')) return;
        candidates.add(u);
      });

      console.log('\ud83c\udf10 Opening tweet in browser...');
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.timeout });

      // Give X a moment to hydrate
      await page.waitForTimeout(1500);

      const pageHtml = await page.content();

      if (isPrivateTweet(pageHtml)) {
        const debugInfo = await this.saveDebugArtifacts(page, pageHtml, 'protected-account');
        return {
          videoUrl: null,
          error: 'This tweet is private or protected. Only public tweets can be extracted.',
          errorClassification: ErrorClassification.PROTECTED_ACCOUNT,
          debugInfo,
        };
      }

      const loginWall = hasLoginWall(pageHtml);
      if (loginWall) {
        console.log('\u26a0\ufe0f  Login wall detected; trying to extract anyway (use --login/--profile for best results)...');
      }

      // Try to trigger media loading.
      await this.tryTriggerPlayback(page);

      // Wait a bounded time for video requests.
      await this.waitForNetworkCandidates(candidates, 8000);

      const videoUrl = await this.selectBestVideoUrl({
        page,
        networkCandidates: [...candidates],
      });

      if (!videoUrl) {
        const debugInfo = await this.saveDebugArtifacts(page, pageHtml, loginWall ? 'login-wall' : 'no-video-found');
        return {
          videoUrl: null,
          error: loginWall
            ? 'No video URL found. This tweet likely requires authentication. Run: x-dl --login --profile ~/.x-dl-profile'
            : 'Failed to extract video URL.',
          errorClassification: loginWall ? ErrorClassification.LOGIN_WALL : ErrorClassification.NO_VIDEO_FOUND,
          debugInfo,
        };
      }

      const filename = generateFilename(tweetInfo);
      console.log(`\u2705 Video extracted: ${videoUrl.url}`);
      console.log(`\ud83d\udccb Suggested filename: ${filename}`);

      return { videoUrl };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const debugInfo = page ? await this.saveDebugArtifacts(page, null, 'extraction-error') : undefined;
      return {
        videoUrl: null,
        error: errorMessage,
        errorClassification: ErrorClassification.EXTRACTION_ERROR,
        debugInfo,
      };
    } finally {
      await this.safeClose({ browser, context });
    }
  }

  async downloadAuthenticated(videoUrl: string, outputPath: string): Promise<string> {
    if (!this.profileDir) {
      throw new Error('Authenticated download requested but no profileDir provided');
    }

    const { chromium } = await import('playwright');

    console.log(`\ud83d\udd10 Authenticated download via Playwright: ${videoUrl}`);
    const startTime = Date.now();

    let context: BrowserContext | null = null;

    try {
      const launchOptions = {
        headless: true,
      };

      if (this.browserExecutablePath) {
        launchOptions.executablePath = this.browserExecutablePath;
      } else if (this.browserChannel) {
        launchOptions.channel = this.browserChannel;
      }

      context = await chromium.launchPersistentContext(this.profileDir, launchOptions);

      const resp = await context.request.get(videoUrl);
      if (!resp.ok()) {
        throw new Error(`HTTP error! status: ${resp.status()}`);
      }

      const bytes = await resp.body();
      await Bun.write(outputPath, bytes);

      const elapsedSec = (Date.now() - startTime) / 1000;
      console.log(`\u2705 Download completed in ${elapsedSec.toFixed(1)}s`);

      return outputPath;
    } finally {
      if (context) {
        await context.close().catch(() => undefined);
      }
    }
  }

  private async createContextAndPage(
    chromium: typeof import('playwright').chromium
  ): Promise<{ browser: Browser | null; context: BrowserContext; page: Page }> {
    if (this.profileDir) {
      const launchOptions: any = {
        headless: !this.headed,
      };

      if (this.browserExecutablePath) {
        launchOptions.executablePath = this.browserExecutablePath;
      } else if (this.browserChannel) {
        launchOptions.channel = this.browserChannel;
      }

      const context = await chromium.launchPersistentContext(this.profileDir, launchOptions);
      const page = await context.newPage();
      return { browser: null, context, page };
    }

    const launchOptions: any = { headless: !this.headed };

    if (this.browserExecutablePath) {
      launchOptions.executablePath = this.browserExecutablePath;
    } else if (this.browserChannel) {
      launchOptions.channel = this.browserChannel;
    }

    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext();
    const page = await context.newPage();
    return { browser, context, page };
  }

  private async safeClose({
    browser,
    context,
  }: {
    browser: Browser | null;
    context: BrowserContext | null;
  }): Promise<void> {
    // Persistent contexts are closed via context.close(); non-persistent needs browser.close().
    if (context) {
      await context.close().catch(() => undefined);
    }
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }

  private async saveDebugArtifacts(
    page: Page,
    pageHtml: string | null,
    errorType: string
  ): Promise<{ htmlPath?: string; screenshotPath?: string; tracePath?: string } | undefined> {
    if (!this.debugArtifactsDir) {
      return undefined;
    }

    try {
      // Create debug directory if it doesn't exist
      fs.mkdirSync(this.debugArtifactsDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const prefix = `${errorType}_${timestamp}`;
      const debugInfo: { htmlPath?: string; screenshotPath?: string; tracePath?: string } = {};

      // Save HTML content
      if (pageHtml) {
        const htmlPath = path.join(this.debugArtifactsDir, `${prefix}.html`);
        fs.writeFileSync(htmlPath, pageHtml, 'utf-8');
        debugInfo.htmlPath = htmlPath;
        console.log(`\ud83d\udcc3 HTML saved to: ${htmlPath}`);
      }

      // Save screenshot
      try {
        const screenshotPath = path.join(this.debugArtifactsDir, `${prefix}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        debugInfo.screenshotPath = screenshotPath;
        console.log(`\ud83d\udcf7 Screenshot saved to: ${screenshotPath}`);
      } catch {
        // Screenshot failed, continue without it
      }

      return debugInfo;
    } catch (error) {
      console.warn(
        `\u26a0\ufe0f  Failed to save debug artifacts: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return undefined;
    }
  }

  private async tryTriggerPlayback(page: Page): Promise<void> {
    try {
      await page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[];
        for (const v of videos) {
          try {
            v.muted = true;
            const p = v.play?.();
            (p as any)?.catch?.(() => undefined);
          } catch {
            // ignore
          }
        }
      });
    } catch {
      // ignore
    }

    // Best-effort click targets.
    const clickSelectors = [
      '[data-testid="videoPlayer"]',
      'video',
      'div[role="button"][aria-label*="Play"]',
      'div[role="button"][aria-label*="play"]',
    ];

    for (const selector of clickSelectors) {
      try {
        const locator = page.locator(selector).first();
        if ((await locator.count()) === 0) continue;
        await locator.click({ timeout: 750 });
        break;
      } catch {
        // try next
      }
    }
  }

  private async waitForNetworkCandidates(candidates: Set<string>, maxWaitMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      for (const u of candidates) {
        const format = getVideoFormat(u);
        if (format === 'mp4' || format === 'm3u8' || format === 'webm' || format === 'gif') return;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  private async selectBestVideoUrl({
    page,
    networkCandidates,
  }: {
    page: Page;
    networkCandidates: string[];
  }): Promise<VideoUrl | null> {
    console.log('\ud83d\udd0d Looking for video...');

    const perfCandidates = await this.getPerformanceCandidates(page);
    const domCandidates = await this.getDomCandidates(page);

    const allUrls = [...networkCandidates, ...perfCandidates, ...domCandidates];
    const unique = [...new Set(allUrls)];

    const parsed = unique
      .map((u) => this.toCandidate(u))
      .filter((c): c is ExtractCandidate => Boolean(c));

    const m3u8s = parsed
      .filter((c) => c.format === 'm3u8')
      .sort((a, b) => (b.score || 0) - (a.score || 0));
    const bestM3U8 = m3u8s.length > 0 ? m3u8s[0] : null;

    const progressiveVideos = parsed.filter((c) => {
      if (c.audioOnly) return false;
      if (c.format === 'm4s' || c.format === 'm4a' || c.format === 'ts') return false;
      if (c.format === 'mp4' || c.format === 'webm') return true;
      return c.format !== 'm3u8';
    });

    if (progressiveVideos.length > 0) {
      const best = await this.pickBestProgressiveCandidate(progressiveVideos);
      const size = await this.getContentLength(best.url);

      // Some X videos only expose HLS (m3u8) + tiny init MP4 segments.
      // If the selected file is suspiciously small and we have an HLS playlist,
      // prefer returning the playlist.
      if (size && size < 100 * 1024 && bestM3U8) {
        return {
          url: bestM3U8.url,
          format: 'm3u8',
        };
      }

      return {
        url: best.url,
        format: best.format,
        bitrate: extractBitrate(best.url),
        width: best.width,
        height: best.height,
      };
    }

    if (bestM3U8) {
      return {
        url: bestM3U8.url,
        format: 'm3u8',
      };
    }

    const audioOnly = parsed.filter((c) => c.format === 'mp4');
    if (audioOnly.length > 0) {
      return {
        url: audioOnly[0].url,
        format: audioOnly[0].format,
      };
    }

    return null;
  }

  private async getPerformanceCandidates(page: Page): Promise<string[]> {
    try {
      const entries = await page.evaluate(() =>
        performance
          .getEntriesByType('resource')
          .map((r: any) => String(r.name))
      );

      if (!Array.isArray(entries)) return [];

      return entries.filter(
        (u) => typeof u === 'string' && u.includes('video.twimg.com')
      );
    } catch {
      return [];
    }
  }

  private async getDomCandidates(page: Page): Promise<string[]> {
    try {
      const result = await page.evaluate(() => {
        const urls: string[] = [];

        const videos = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[];
        for (const v of videos) {
          if (v.currentSrc) urls.push(v.currentSrc);
          if (v.src) urls.push(v.src);
        }

        const sources = Array.from(document.querySelectorAll('video source')) as HTMLSourceElement[];
        for (const s of sources) {
          if (s.src) urls.push(s.src);
        }

        return urls;
      });

      if (!Array.isArray(result)) return [];
      return result.filter(
        (u) => typeof u === 'string' && u.includes('video.twimg.com')
      );
    } catch {
      return [];
    }
  }

  private toCandidate(url: string): ExtractCandidate | null {
    const format = getVideoFormat(url);

    const cleanUrl = url.split('#')[0];

    const audioOnly =
      cleanUrl.includes('/aud/') ||
      cleanUrl.includes('/mp4a/') ||
      cleanUrl.includes('mp4a');

    let width: number | undefined;
    let height: number | undefined;
    let score = 0;

    const match = cleanUrl.match(/\/(\d+)x(\d+)\//);
    if (match) {
      width = parseInt(match[1], 10);
      height = parseInt(match[2], 10);
      score = width * height;
    }

    // Prefer MP4/webm over m3u8 even if no resolution parsed.
    if ((format === 'mp4' || format === 'webm') && !audioOnly) {
      score += 1_000_000_000;
    }

    // Prefer master playlists over variant playlists when available.
    if (format === 'm3u8' && !audioOnly && cleanUrl.includes('variant_version')) {
      score += 2_000_000_000;
    }

    return { url: cleanUrl, format, width, height, score, audioOnly };
  }

  private async pickBestProgressiveCandidate(candidates: ExtractCandidate[]): Promise<ExtractCandidate> {
    // Prefer progressive endpoints (commonly include /pu/vid/).
    const sorted = [...candidates].sort((a, b) => (b.score || 0) - (a.score || 0));
    const withProgressiveBoost = sorted.sort((a, b) => {
      const ap = a.url.includes('/pu/vid/') ? 1 : 0;
      const bp = b.url.includes('/pu/vid/') ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return (b.score || 0) - (a.score || 0);
    });

    // If multiple candidates exist, prefer the one with the largest Content-Length.
    // This helps avoid selecting tiny init segments from adaptive streams.
    let best = withProgressiveBoost[0];
    let bestSize = 0;

    for (const c of withProgressiveBoost.slice(0, 6)) {
      const size = await this.getContentLength(c.url);
      if (!size) continue;
      if (size < 100 * 1024) continue;
      if (size > bestSize) {
        best = c;
        bestSize = size;
      }
    }

    return best;
  }

  private async getContentLength(url: string): Promise<number | undefined> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);

    try {
      const resp = await fetch(url, { method: 'HEAD', signal: ctrl.signal });
      if (!resp.ok) return undefined;
      const len = resp.headers.get('content-length');
      if (!len) return undefined;
      const parsed = parseInt(len, 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  }

  async verifyAuth(): Promise<{
    hasAuthToken: boolean;
    canAccessHome: boolean;
    authCookies: string[];
    message: string;
  }> {
    if (!this.profileDir) {
      return {
        hasAuthToken: false,
        canAccessHome: false,
        authCookies: [],
        message: 'No profile directory specified',
      };
    }

    const { chromium } = await import('playwright');

    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      context = await chromium.launchPersistentContext(this.profileDir, {
        headless: true,
      });

      // Check for auth cookies
      const cookies = await context.cookies();
      const authTokenCookie = cookies.find(c => c.name === 'auth_token');
      const authCookieNames = cookies
        .filter(c => ['auth_token', 'auth_multi_select', 'personalization_id', 'ct0'].includes(c.name))
        .map(c => c.name);

      const hasAuthToken = !!authTokenCookie;

      // Try to load X.com/home
      page = await context.newPage();
      let canAccessHome = false;
      let message = '';

      try {
        await page.goto('https://x.com/home', {
          waitUntil: 'domcontentloaded',
          timeout: this.timeout,
        });

        const pageHtml = await page.content();
        const loginWallDetected = hasLoginWall(pageHtml);

        if (loginWallDetected) {
          canAccessHome = false;
          message = 'Login wall detected at X.com/home - authentication may be invalid or expired';
        } else if (pageHtml.includes('Home') && hasAuthToken) {
          canAccessHome = true;
          message = 'Authentication is valid and X.com/home is accessible';
        } else if (!loginWallDetected && pageHtml.includes('Home')) {
          canAccessHome = true;
          message = 'X.com/home loaded successfully (page loaded but no auth token present)';
        } else if (!loginWallDetected) {
          canAccessHome = true;
          message = 'X.com/home loaded (no login wall detected, but auth token not present)';
        } else {
          canAccessHome = false;
          message = 'Unable to verify access status';
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        canAccessHome = false;
        message = `Failed to access X.com/home: ${errorMsg}`;
      }

      return {
        hasAuthToken,
        canAccessHome,
        authCookies: authCookieNames,
        message,
      };
    } finally {
      if (page) {
        await page.close().catch(() => undefined);
      }
      if (context) {
        await context.close().catch(() => undefined);
      }
    }
  }
}
