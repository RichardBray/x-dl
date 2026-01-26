export interface VideoUrl {
  url: string;
  format: string;
  bitrate?: number;
  width?: number;
  height?: number;
}

export enum ErrorClassification {
  LOGIN_WALL = 'login_wall',
  PROTECTED_ACCOUNT = 'protected_account',
  NO_VIDEO_FOUND = 'no_video_found',
  INVALID_URL = 'invalid_url',
  PARSE_ERROR = 'parse_error',
  EXTRACTION_ERROR = 'extraction_error',
  UNKNOWN = 'unknown',
}

export interface ExtractResult {
  videoUrl: VideoUrl | null;
  error?: string;
  errorClassification?: ErrorClassification;
  debugInfo?: {
    htmlPath?: string;
    screenshotPath?: string;
    tracePath?: string;
  };
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
  browserChannel?: 'chrome' | 'chromium' | 'msedge';
  browserExecutablePath?: string;
  debugArtifactsDir?: string;
}

export interface TweetInfo {
  id: string;
  author: string;
  url: string;
}
