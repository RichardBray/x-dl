import { DownloadOptions } from './types.ts';
import { formatBytes, formatTime } from './utils.ts';

export async function downloadVideo(options: DownloadOptions): Promise<string> {
  const { url, outputPath, onProgress } = options;
  
  console.log(`📥 Downloading video from: ${url}`);
  console.log(`📁 Output path: ${outputPath}`);
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    
    if (total > 0) {
      console.log(`📊 Total size: ${formatBytes(total)}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response body reader');
    }
    
    const chunks: Uint8Array[] = [];
    let downloaded = 0;
    let lastProgressUpdate = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        downloaded += value.length;

        if (onProgress && total > 0) {
          const now = Date.now();
          if (now - lastProgressUpdate > 500 || downloaded === total) {
            const progress = (downloaded / total) * 100;
            onProgress(progress, downloaded, total);
            lastProgressUpdate = now;
          }
        }
      }
    } finally {
      reader.cancel().catch(() => {});
    }
    
    const blob = new Blob(chunks);
    await Bun.write(outputPath, blob);
    
    const elapsed = (Date.now() - startTime) / 1000;
    const fileSize = blob.size;
    
    console.log(`✅ Download completed in ${formatTime(elapsed)}`);
    console.log(`📦 Final size: ${formatBytes(fileSize)}`);

    return outputPath;
  } catch (error) {
    console.error('❌ Download failed:', error);
    throw error;
  }
}
