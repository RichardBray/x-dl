import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { VideoExtractor } from '../../src/extractor.ts';
import { withTimeout } from '../test-utils.ts';

describe.skip('VideoExtractor Integration Tests', () => {
  let mockServer: any;
  let mockServerUrl: string;

  beforeAll(async () => {
    // Skip these tests if Playwright Chromium isn't available
    try {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true });
      await browser.close();
    } catch {
      console.log('⚠️  Skipping integration tests: Playwright Chromium not available');
      return;
    }

    // Start a mock HTTP server for testing
    const mockPagePath = import.meta.dir + '/mock-x-page.html';
    const mockPageHtml = await Bun.file(mockPagePath).text();

    // Create a simple HTTP server using Bun.serve
    mockServer = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        
        if (url.pathname.endsWith('/public')) {
          return new Response(mockPageHtml, {
            headers: { 'Content-Type': 'text/html' },
          });
        }
        
        if (url.pathname.endsWith('/private')) {
          return new Response('Log in to follow this account', {
            headers: { 'Content-Type': 'text/html' },
          });
        }
        
        if (url.pathname.endsWith('/no-video')) {
          return new Response('This tweet has no video', {
            headers: { 'Content-Type': 'text/html' },
          });
        }

        if (url.pathname.includes('video.twimg.com')) {
          // Return a small fake video
          return new Response(new Uint8Array([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70]), {
            headers: { 'Content-Type': 'video/mp4' },
          });
        }

        return new Response('Not found', { status: 404 });
      },
    });

    mockServerUrl = `http://localhost:${mockServer.port}`;
  });

  afterAll(() => {
    if (mockServer) {
      mockServer.stop();
    }
  });

  describe('Public Video Extraction', () => {
    it('should extract video URL from public tweet', async () => {
      const extractor = new VideoExtractor({
        url: `${mockServerUrl}/user/status/123/public`,
        timeout: 10000,
      });

      const result = await withTimeout(
        extractor.extract(`${mockServerUrl}/user/status/123/public`),
        15000,
        'Video extraction timed out'
      );

      expect(result.error).toBeUndefined();
      expect(result.videoUrl).not.toBeNull();
      expect(result.videoUrl?.url).toContain('video.twimg.com');
    });

    it('should prefer MP4 format over m3u8', async () => {
      const extractor = new VideoExtractor({
        url: `${mockServerUrl}/user/status/123/public`,
        timeout: 10000,
      });

      const result = await withTimeout(
        extractor.extract(`${mockServerUrl}/user/status/123/public`),
        15000,
        'Video extraction timed out'
      );

      expect(result.videoUrl?.format).toBe('mp4');
    });
  });

  describe('Private Tweet Detection', () => {
    it('should detect and reject private tweets', async () => {
      const extractor = new VideoExtractor({
        url: `${mockServerUrl}/user/status/123/private`,
        timeout: 10000,
      });

      const result = await withTimeout(
        extractor.extract(`${mockServerUrl}/user/status/123/private`),
        15000,
        'Video extraction timed out'
      );

      expect(result.videoUrl).toBeNull();
      expect(result.error).toContain('private');
    });
  });

  describe('No Video Detection', () => {
    it('should return error when no video found', async () => {
      const extractor = new VideoExtractor({
        url: `${mockServerUrl}/user/status/123/no-video`,
        timeout: 10000,
      });

      const result = await withTimeout(
        extractor.extract(`${mockServerUrl}/user/status/123/no-video`),
        15000,
        'Video extraction timed out'
      );

      expect(result.videoUrl).toBeNull();
      expect(result.error).toContain('no video');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid URLs gracefully', async () => {
      const extractor = new VideoExtractor({
        url: 'not-a-valid-url',
        timeout: 5000,
      });

      const result = await extractor.extract('not-a-valid-url');

      expect(result.videoUrl).toBeNull();
      expect(result.error).toContain('Invalid');
    });

    it('should handle connection errors gracefully', async () => {
      const extractor = new VideoExtractor({
        url: 'http://this-domain-does-not-exist-12345.com/tweet/123',
        timeout: 5000,
      });

      const result = await extractor.extract(
        'http://this-domain-does-not-exist-12345.com/tweet/123'
      );

      expect(result.videoUrl).toBeNull();
    });
  });
});

describe.skip('VideoExtractor Real URL Tests', () => {
  // These tests are skipped by default as they require real network calls
  // Uncomment and run manually with: bun test test/integration/ --only

  it.skip('should extract from real X tweet (manual test)', async () => {
    // Replace with a real tweet URL for testing
    const realUrl = 'https://x.com/Remotion/status/2013626968386765291';
    
    const extractor = new VideoExtractor({
      url: realUrl,
      timeout: 30000,
      headed: true, // Show browser for debugging
    });

    const result = await extractor.extract(realUrl);

    console.log('Extract result:', result);
    
    if (result.videoUrl) {
      console.log('Video URL:', result.videoUrl.url);
      console.log('Format:', result.videoUrl.format);
    }
    
    expect(result.error).toBeUndefined();
  });
});
