import { TweetInfo } from './types.ts';

export function isValidTwitterUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?twitter\.com\/[\w]+\/status\/[\d]+/i,
    /^https?:\/\/(www\.)?x\.com\/[\w]+\/status\/[\d]+/i,
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/[\w]+\/status\/[\d]+/i,
  ];
  return patterns.some(pattern => pattern.test(url));
}

export function parseTweetUrl(url: string): TweetInfo | null {
  if (!isValidTwitterUrl(url)) {
    return null;
  }

  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');
  
  const authorIndex = pathParts.indexOf('status') - 1;
  const statusIndex = pathParts.indexOf('status');
  
  if (authorIndex < 0 || statusIndex < 0) {
    return null;
  }

  const author = pathParts[authorIndex];
  const id = pathParts[statusIndex + 1];

  if (!author || !id || !/^\d+$/.test(id)) {
    return null;
  }

  return {
    id,
    author,
    url: urlObj.origin + urlObj.pathname,
  };
}

export function generateFilename(tweetInfo: TweetInfo, extension: string = 'mp4'): string {
  const author = tweetInfo.author;
  const id = tweetInfo.id;
  return `${author}_${id}.${extension}`;
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
}

export function getVideoFormat(url: string): VideoUrl['format'] {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('.mp4')) return 'mp4';
  if (lowerUrl.includes('.m3u8')) return 'm3u8';
  if (lowerUrl.includes('.gif') || lowerUrl.includes('twimg.com/tweet_video')) return 'gif';
  return 'unknown';
}

export async function commandExists(command: string): Promise<boolean> {
  try {
    const process = Bun.spawn(['which', command], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await process.exited;
    return process.exitCode === 0;
  } catch {
    return false;
  }
}

export function isPrivateTweet(html: string): boolean {
  const privateIndicators = [
    'this tweet is from an account that is',
    'protected tweets',
    'you are not authorized to view',
    'these tweets are protected',
    'only followers can see',
    'this tweet is protected',
  ];

  const lowerHtml = html.toLowerCase();
  return privateIndicators.some(indicator =>
    lowerHtml.includes(indicator.toLowerCase())
  );
}

export function hasLoginWall(html: string): boolean {
  const loginIndicators = [
    'log in',
    'sign up',
    'join the conversation',
    'sign in to view',
  ];

  const lowerHtml = html.toLowerCase();
  const hasLogin = loginIndicators.some(indicator =>
    lowerHtml.includes(indicator.toLowerCase())
  );

  const hasAuthRequired = html.includes('Sign in') || 
                        html.includes('Log in');
  
  return hasLogin && hasAuthRequired;
}

export function hasVideo(html: string): boolean {
  const videoIndicators = [
    '<video',
    'video.twimg.com',
    'tweet_video',
    'ext_tw_video',
  ];

  return videoIndicators.some(indicator => html.includes(indicator));
}

export function extractVideoUrlsFromHtml(html: string): string[] {
  const urls: string[] = [];
  
  const videoSrcRegex = /https?:\/\/video\.twimg\.com\/[^\s"'<>]+/gi;
  const matches = html.match(videoSrcRegex);
  
  if (matches) {
    urls.push(...matches);
  }

  return [...new Set(urls)];
}

export function selectBestMp4(videos: Array<{url: string; format: VideoUrl['format']}>): string | null {
  const mp4Videos = videos.filter(v => v.format === 'mp4');
  
  if (mp4Videos.length === 0) {
    return null;
  }

  if (mp4Videos.length === 1) {
    return mp4Videos[0].url;
  }

  return mp4Videos[0].url;
}

export function extractBitrate(url: string): number | undefined {
  const match = url.match(/\/(\d+)x(\d+)\//);
  if (match) {
    const width = parseInt(match[1], 10);
    const height = parseInt(match[2], 10);
    return width * height;
  }
  return undefined;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
