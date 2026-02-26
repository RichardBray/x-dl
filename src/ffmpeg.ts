import { spawn } from 'node:child_process';

export interface DownloadHlsOptions {
  playlistUrl: string;
  outputPath: string;
  timeout?: number;
  clipFromSecs?: number;
  clipDurationSecs?: number;
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
  const { playlistUrl, outputPath, timeout, clipFromSecs, clipDurationSecs } = options;

  console.log('📥 Downloading HLS video via ffmpeg...');

  const fs = await import('node:fs');

  if (fs.existsSync(outputPath)) {
    console.log(`⚠️  File already exists, removing: ${outputPath}`);
    fs.unlinkSync(outputPath);
  }

  const timeoutMs = timeout ?? 120000;
  const noProgressTimeoutMs = 60000;
  let lastFileSize = 0;
  let lastProgressTime = Date.now();
  let rejected = false;

  return new Promise((resolve, reject) => {
    const isClipping = clipFromSecs !== undefined || clipDurationSecs !== undefined;
    const args = [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-i', playlistUrl,
      // Use -ss after -i (slow/accurate seek) — fast seek on HLS produces empty output
      ...(clipFromSecs !== undefined ? ['-ss', String(clipFromSecs)] : []),
      ...(clipDurationSecs !== undefined ? ['-t', String(clipDurationSecs)] : []),
      ...(isClipping
        ? ['-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart']
        : ['-c', 'copy', '-bsf:a', 'aac_adtstoasc']),
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

    const spinnerInterval = setInterval(() => {
      process.stdout.write(`\r${spinnerChars[spinnerIndex]} Downloading HLS...`);
      spinnerIndex = (spinnerIndex + 1) % spinnerChars.length;
    }, 80);

    const pollInterval = setInterval(() => {
      try {
        const now = Date.now();

        if (fs.existsSync(outputPath)) {
          const currentFileSize = fs.statSync(outputPath).size;

          if (currentFileSize > lastFileSize) {
            lastFileSize = currentFileSize;
            lastProgressTime = now;
          }
          else if (now - lastProgressTime > noProgressTimeoutMs) {
            clearInterval(spinnerInterval);
            clearInterval(pollInterval);
            clearTimeout(timeoutHandle);
            rejected = true;
            ffmpeg.kill();
            process.stdout.write('\r\x1b[K');
            reject(new Error(`FFMPEG stuck: no progress for ${noProgressTimeoutMs / 1000} seconds`));
          }
        }
        else if (now - lastProgressTime > noProgressTimeoutMs) {
          clearInterval(spinnerInterval);
          clearInterval(pollInterval);
          clearTimeout(timeoutHandle);
          rejected = true;
          ffmpeg.kill();
          process.stdout.write('\r\x1b[K');
          reject(new Error(`FFMPEG stuck: no progress for ${noProgressTimeoutMs / 1000} seconds`));
        }
      } catch (_err) {
      }
    }, 2000);

    const timeoutHandle = setTimeout(() => {
      clearInterval(spinnerInterval);
      clearInterval(pollInterval);
      rejected = true;
      ffmpeg.kill();
      process.stdout.write('\r\x1b[K');
      reject(new Error(`FFMPEG download timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);

    ffmpeg.on('close', (code) => {
      clearInterval(spinnerInterval);
      clearInterval(pollInterval);
      clearTimeout(timeoutHandle);

      if (code === 0 && !rejected) {
        process.stdout.write('\r✅ HLS download completed\n');
        resolve(outputPath);
      } else if (!rejected) {
        process.stdout.write('\r\x1b[K');
        const error = stderr.trim() || `ffmpeg exited with code ${code ?? 'null (signal)'}`;
        reject(new Error(`Failed to download HLS: ${error}`));
      }
    });

    ffmpeg.on('error', (err) => {
      clearInterval(spinnerInterval);
      clearInterval(pollInterval);
      clearTimeout(timeoutHandle);
      if (!rejected) {
        rejected = true;
        process.stdout.write('\r\x1b[K');
        reject(new Error(`Failed to start ffmpeg: ${err.message}`));
      }
    });
  });
}

export interface ClipLocalFileOptions {
  inputPath: string;
  outputPath: string;
  clipFrom?: string;
  clipTo?: string;
}

export function mmssToSeconds(mmss: string): number {
  const [mm, ss] = mmss.split(':').map(Number);
  return mm * 60 + ss;
}

export async function clipLocalFile(options: ClipLocalFileOptions): Promise<void> {
  const { inputPath, outputPath, clipFrom, clipTo } = options;

  const startSecs = clipFrom ? mmssToSeconds(clipFrom) : 0;
  const duration = clipTo ? mmssToSeconds(clipTo) - startSecs : undefined;

  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      ...(clipFrom ? ['-ss', String(startSecs)] : []),
      '-i', inputPath,
      ...(duration !== undefined ? ['-t', String(duration)] : []),
      '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart',
      outputPath,
    ];

    const ffmpeg = spawn('ffmpeg', args);
    let stderr = '';

    if (ffmpeg.stderr) {
      ffmpeg.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
    }

    const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIndex = 0;
    const spinnerInterval = setInterval(() => {
      process.stdout.write(`\r${spinnerChars[spinnerIndex]} Clipping...`);
      spinnerIndex = (spinnerIndex + 1) % spinnerChars.length;
    }, 80);

    ffmpeg.on('close', (code: number | null) => {
      clearInterval(spinnerInterval);
      if (code === 0) {
        process.stdout.write('\r✅ Clip complete\n');
        resolve();
      } else {
        process.stdout.write('\r\x1b[K');
        reject(new Error(stderr.trim() || `ffmpeg exited with code ${code ?? 'null (signal)'}`));
      }
    });

    ffmpeg.on('error', (err: Error) => {
      clearInterval(spinnerInterval);
      process.stdout.write('\r\x1b[K');
      reject(new Error(`Failed to start ffmpeg: ${err.message}`));
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

export interface DownloadMp4Options {
  videoUrl: string;
  outputPath: string;
  clipFrom?: string;
  clipTo?: string;
  timeout?: number;
}

export async function downloadMp4WithFfmpeg(options: DownloadMp4Options): Promise<string> {
  const { videoUrl, outputPath, clipFrom, clipTo, timeout } = options;

  console.log('📥 Downloading video via ffmpeg...');

  const fs = await import('node:fs');

  if (fs.existsSync(outputPath)) {
    console.log(`⚠️  File already exists, removing: ${outputPath}`);
    fs.unlinkSync(outputPath);
  }

  const timeoutMs = timeout ?? 120000;
  const noProgressTimeoutMs = 60000;
  let lastFileSize = 0;
  let lastProgressTime = Date.now();
  let rejected = false;

  const fromSecs = clipFrom ? mmssToSeconds(clipFrom) : 0;
  const toSecs = clipTo ? mmssToSeconds(clipTo) : undefined;
  const duration = toSecs !== undefined ? toSecs - fromSecs : undefined;

  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      ...(clipFrom ? ['-ss', String(fromSecs)] : []),
      '-i', videoUrl,
      ...(duration !== undefined ? ['-t', String(duration)] : []),
      '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart',
      outputPath,
    ];

    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';

    if (ffmpeg.stderr) {
      ffmpeg.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
    }

    const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIndex = 0;

    const spinnerInterval = setInterval(() => {
      process.stdout.write(`\r${spinnerChars[spinnerIndex]} Downloading...`);
      spinnerIndex = (spinnerIndex + 1) % spinnerChars.length;
    }, 80);

    const pollInterval = setInterval(() => {
      try {
        const now = Date.now();
        if (fs.existsSync(outputPath)) {
          const currentFileSize = fs.statSync(outputPath).size;
          if (currentFileSize > lastFileSize) {
            lastFileSize = currentFileSize;
            lastProgressTime = now;
          } else if (now - lastProgressTime > noProgressTimeoutMs) {
            clearInterval(spinnerInterval);
            clearInterval(pollInterval);
            clearTimeout(timeoutHandle);
            rejected = true;
            ffmpeg.kill();
            process.stdout.write('\r\x1b[K');
            reject(new Error(`FFMPEG stuck: no progress for ${noProgressTimeoutMs / 1000} seconds`));
          }
        } else if (now - lastProgressTime > noProgressTimeoutMs) {
          clearInterval(spinnerInterval);
          clearInterval(pollInterval);
          clearTimeout(timeoutHandle);
          rejected = true;
          ffmpeg.kill();
          process.stdout.write('\r\x1b[K');
          reject(new Error(`FFMPEG stuck: no progress for ${noProgressTimeoutMs / 1000} seconds`));
        }
      } catch (_err) {}
    }, 2000);

    const timeoutHandle = setTimeout(() => {
      clearInterval(spinnerInterval);
      clearInterval(pollInterval);
      rejected = true;
      ffmpeg.kill();
      process.stdout.write('\r\x1b[K');
      reject(new Error(`FFMPEG download timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);

    ffmpeg.on('close', (code: number | null) => {
      clearInterval(spinnerInterval);
      clearInterval(pollInterval);
      clearTimeout(timeoutHandle);

      if (code === 0 && !rejected) {
        process.stdout.write('\r✅ Download completed\n');
        resolve(outputPath);
      } else if (!rejected) {
        process.stdout.write('\r\x1b[K');
        const error = stderr.trim() || `ffmpeg exited with code ${code ?? 'null (signal)'}`;
        reject(new Error(`Failed to download: ${error}`));
      }
    });

    ffmpeg.on('error', (err: Error) => {
      clearInterval(spinnerInterval);
      clearInterval(pollInterval);
      clearTimeout(timeoutHandle);
      if (!rejected) {
        rejected = true;
        process.stdout.write('\r\x1b[K');
        reject(new Error(`Failed to start ffmpeg: ${err.message}`));
      }
    });
  });
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
