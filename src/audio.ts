import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function extractAudio(videoUrl: string): Promise<string> {
  const outputPath = join(tmpdir(), `x-dl-audio-${randomUUID()}.mp3`);
  const timeoutMs = 60000;

  return new Promise((resolve, reject) => {
    let rejected = false;

    const args = [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-i', videoUrl,
      '-vn',
      '-acodec', 'libmp3lame',
      '-ar', '16000',
      '-ac', '1',
      outputPath,
    ];

    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';

    if (ffmpeg.stderr) {
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    const timeoutHandle = setTimeout(() => {
      rejected = true;
      ffmpeg.kill();
      reject(new Error(`Audio extraction timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);

    ffmpeg.on('close', async (code) => {
      clearTimeout(timeoutHandle);

      if (code === 0 && !rejected) {
        const fs = await import('node:fs');
        const stats = fs.statSync(outputPath);
        if (stats.size > 25 * 1024 * 1024) {
          console.warn(`Warning: Audio file is ${(stats.size / 1024 / 1024).toFixed(1)}MB, exceeds Whisper's 25MB limit`);
        }
        resolve(outputPath);
      } else if (!rejected) {
        const error = stderr.trim() || `ffmpeg exited with code ${code ?? 'null (signal)'}`;
        reject(new Error(`Failed to extract audio: ${error}`));
      }
    });

    ffmpeg.on('error', (err) => {
      clearTimeout(timeoutHandle);
      if (!rejected) {
        rejected = true;
        reject(new Error(`Failed to start ffmpeg: ${err.message}`));
      }
    });
  });
}
