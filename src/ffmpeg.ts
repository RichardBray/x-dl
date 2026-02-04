import { spawn } from 'node:child_process';

export interface DownloadHlsOptions {
  playlistUrl: string;
  outputPath: string;
  timeout?: number;
}

export interface FfmpegCapabilities {
  protocols?: string[];
  demuxers?: string[];
  muxers?: string[];
  bsfs?: string[];
}

export interface FfmpegCapabilityCheckResult extends FfmpegCapabilities {
  available: boolean;
  error?: string;
}

export async function downloadHlsWithFfmpeg(options: DownloadHlsOptions): Promise<string> {
  const { playlistUrl, outputPath, timeout } = options;

  console.log('📥 Downloading HLS video via ffmpeg...');

  const fs = await import('node:fs');

  if (fs.existsSync(outputPath)) {
    console.log(`⚠️  File already exists, removing: ${outputPath}`);
    fs.unlinkSync(outputPath);
  }

  const timeoutMs = timeout ?? 120000;
  const noProgressTimeoutMs = 30000;
  let lastFileSize = 0;
  let lastProgressTime = Date.now();
  let rejected = false;

  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-i', playlistUrl,
      '-c', 'copy',
      '-bsf:a', 'aac_adtstoasc',
      outputPath,
    ];

    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';

    if (ffmpeg.stderr) {
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIndex = 0;

    const pollInterval = setInterval(() => {
      process.stdout.write(`\r${spinnerChars[spinnerIndex]} Downloading HLS...`);
      spinnerIndex = (spinnerIndex + 1) % spinnerChars.length;

      try {
        if (fs.existsSync(outputPath)) {
          const currentFileSize = fs.statSync(outputPath).size;
          const now = Date.now();

          if (currentFileSize > lastFileSize) {
            lastFileSize = currentFileSize;
            lastProgressTime = now;
          }
          else if (now - lastProgressTime > noProgressTimeoutMs) {
            clearInterval(pollInterval);
            clearTimeout(timeoutHandle);
            rejected = true;
            ffmpeg.kill('SIGKILL');
            reject(new Error(`FFMPEG stuck: no progress for ${noProgressTimeoutMs / 1000} seconds`));
          }
        }
      } catch (_err) {
      }
    }, 2000);

    const timeoutHandle = setTimeout(() => {
      clearInterval(pollInterval);
      rejected = true;
      ffmpeg.kill('SIGKILL');
      reject(new Error(`FFMPEG download timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);

    ffmpeg.on('close', (code) => {
      clearInterval(pollInterval);
      clearTimeout(timeoutHandle);

      if (code === 0) {
        process.stdout.write('\r✅ HLS download completed\n');
        resolve(outputPath);
      } else if (!rejected) {
        const error = stderr.trim() || `ffmpeg exited with code ${code ?? 'null (signal)'}`;
        reject(new Error(`Failed to download HLS: ${error}`));
      }
    });

    ffmpeg.on('error', (err) => {
      clearInterval(pollInterval);
      clearTimeout(timeoutHandle);
      if (!rejected) {
        rejected = true;
        reject(new Error(`Failed to start ffmpeg: ${err.message}`));
      }
    });
  });
}

export async function checkFfmpegCapabilities(): Promise<FfmpegCapabilityCheckResult> {
  const results: FfmpegCapabilityCheckResult = {
    available: false,
    protocols: [],
    demuxers: [],
    muxers: [],
    bsfs: [],
  };

  try {
    const { promisify } = await import('node:util');
    const { exec } = await import('node:child_process');
    const execAsync = promisify(exec);

    const version = await execAsync('ffmpeg -hide_banner -version');
    if (version.stderr && !version.stdout) {
      results.available = false;
      results.error = 'ffmpeg not found in PATH';
      return results;
    }

    results.available = true;

    const protocols = await execAsync('ffmpeg -hide_banner -protocols');
    const protocolOutput = protocols.stdout || '';
    results.protocols = protocolOutput
      .split('\n')
      .filter(line => line.trim() && !line.includes('Input:') && !line.includes('Output:') && !line.includes('file protocols:'))
      .map(line => line.trim())
      .filter(p => p !== '---');

    const demuxers = await execAsync('ffmpeg -hide_banner -demuxers');
    const demuxerOutput = demuxers.stdout || '';
    results.demuxers = demuxerOutput
      .split('\n')
      .filter(line => line.trim() && !line.includes('Demuxers:') && !line.includes('D..') && !line.includes('..d'))
      .map(line => line.trim().split(/\s+/).slice(1)[0])
      .filter((d): d is string => !!d);

    const muxers = await execAsync('ffmpeg -hide_banner -muxers');
    const muxerOutput = muxers.stdout || '';
    results.muxers = muxerOutput
      .split('\n')
      .filter(line => line.trim() && !line.includes('Muxers:') && !line.includes('D..') && !line.includes('..d'))
      .map(line => line.trim().split(/\s+/).slice(1)[0])
      .filter((m): m is string => !!m);

    const bsfs = await execAsync('ffmpeg -hide_banner -bsfs');
    const bsfOutput = bsfs.stdout || '';
    results.bsfs = bsfOutput
      .split('\n')
      .filter(line => line.trim() && !line.includes('Bitstream filters:'))
      .map(line => line.trim());

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.available = false;
    results.error = message;
  }

  return results;
}

export function hasRequiredFfmpegCapabilities(capabilities: FfmpegCapabilities): { has: boolean; missing: string[] } {
  const required = {
    protocol: 'https',
    demuxer: 'hls',
    muxer: 'mp4',
    bsf: 'aac_adtstoasc',
  };

  const missing: string[] = [];

  if (!capabilities.protocols?.includes(required.protocol)) {
    missing.push(`protocol: ${required.protocol}`);
  }

  if (!capabilities.demuxers?.includes(required.demuxer)) {
    missing.push(`demuxer: ${required.demuxer}`);
  }

  if (!capabilities.muxers?.includes(required.muxer)) {
    missing.push(`muxer: ${required.muxer}`);
  }

  if (!capabilities.bsfs?.includes(required.bsf)) {
    missing.push(`bitstream filter: ${required.bsf}`);
  }

  return {
    has: missing.length === 0,
    missing,
  };
}
