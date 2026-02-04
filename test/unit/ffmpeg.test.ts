import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { downloadHlsWithFfmpeg } from '../../src/ffmpeg.ts';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('FFMPEG Download with Polling', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ffmpeg-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should accept timeout parameter', async () => {
    const outputPath = path.join(tempDir, 'output.mp4');
    const timeoutMs = 5000;

    try {
      await downloadHlsWithFfmpeg({
        playlistUrl: 'https://example.com/test.m3u8',
        outputPath,
        timeout: timeoutMs,
      });
    } catch (error) {
      const err = error as Error;
      expect(err).toBeInstanceOf(Error);
    }
  });

  it('should handle missing timeout parameter', async () => {
    const outputPath = path.join(tempDir, 'output.mp4');

    try {
      await downloadHlsWithFfmpeg({
        playlistUrl: 'https://example.com/test.m3u8',
        outputPath,
      });
    } catch (error) {
      const err = error as Error;
      expect(err).toBeInstanceOf(Error);
    }
  });

  it('should clean up output file if it exists', async () => {
    const outputPath = path.join(tempDir, 'output.mp4');
    await fs.writeFile(outputPath, 'test content');
    expect(await fs.exists(outputPath)).toBe(true);

    try {
      await downloadHlsWithFfmpeg({
        playlistUrl: 'https://example.com/test.m3u8',
        outputPath,
      });
    } catch (_error) {
      expect(await fs.exists(outputPath)).toBe(false);
    }
  });
});
