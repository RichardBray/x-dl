import { spawn } from 'node:child_process';

export interface DownloadHlsOptions {
  playlistUrl: string;
  outputPath: string;
}

export async function downloadHlsWithFfmpeg(options: DownloadHlsOptions): Promise<string> {
  const { playlistUrl, outputPath } = options;

  console.log('📥 Downloading HLS video via ffmpeg...');

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

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log('✅ HLS download completed');
        resolve(outputPath);
      } else {
        const error = stderr.trim() || `ffmpeg exited with code ${code}`;
        reject(new Error(`Failed to download HLS: ${error}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`Failed to start ffmpeg: ${err.message}`));
    });
  });
}

export async function checkFfmpegCapabilities(): Promise<{
  available: boolean;
  protocols?: string[];
  demuxers?: string[];
  muxers?: string[];
  bsfs?: string[];
  error?: string;
}> {
  const results = {
    available: false,
    protocols: [] as string[],
    demuxers: [] as string[],
    muxers: [] as string[],
    bsfs: [] as string[],
    error: undefined as string | undefined,
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
      .filter(d => d);

    const muxers = await execAsync('ffmpeg -hide_banner -muxers');
    const muxerOutput = muxers.stdout || '';
    results.muxers = muxerOutput
      .split('\n')
      .filter(line => line.trim() && !line.includes('Muxers:') && !line.includes('D..') && !line.includes('..d'))
      .map(line => line.trim().split(/\s+/).slice(1)[0])
      .filter(m => m);

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

export function hasRequiredFfmpegCapabilities(capabilities: {
  protocols?: string[];
  demuxers?: string[];
  muxers?: string[];
  bsfs?: string[];
}): { has: boolean; missing: string[] } {
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
