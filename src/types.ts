export interface VideoUrl {
  url: string;
  format: 'mp4' | 'm3u8' | 'gif' | 'unknown';
  bitrate?: number;
  width?: number;
  height?: number;
}

export interface ExtractResult {
  videoUrl: VideoUrl | null;
  error?: string;
}

export interface DownloadOptions {
  url: string;
  outputPath: string;
  onProgress?: (progress: number, downloaded: number, total: number) => void;
}

export interface ExtractOptions {
  url?: string;
  timeout?: number;
  headed?: boolean;
  profileDir?: string;
}

export interface TweetInfo {
  id: string;
  author: string;
  url: string;
}
