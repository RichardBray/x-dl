import { TweetInfo, VideoUrl } from './types.ts';

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

export function getVideoFormat(url: string): string {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname.toLowerCase();

  const extMatch = pathname.match(/\.([a-z0-9]+)$/i);
  if (extMatch) {
    return extMatch[1].toLowerCase();
  }

  if (pathname.includes('twimg.com/tweet_video')) return 'gif';

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


type VideoVariant = { url: string; bitrate?: number; content_type?: string };

function videoVariantsFromMedia(media: unknown): VideoVariant[] | null {
  if (!Array.isArray(media)) return null;
  for (const m of media) {
    if ((m?.type === 'video' || m?.type === 'animated_gif') && Array.isArray(m.video_info?.variants)) {
      return m.video_info.variants;
    }
  }
  return null;
}

// Thread pages also load the replies' videos, so the only reliable way to pick
// the right one is to match the tweet ID in the API JSON (GraphQL or syndication).
export function findTweetVideoVariants(json: unknown, tweetId: string): VideoVariant[] | null {
  const stack: unknown[] = [json];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }

    const obj = node as Record<string, any>;
    if (obj.rest_id === tweetId && obj.legacy) {
      return videoVariantsFromMedia(obj.legacy.extended_entities?.media);
    }
    if (obj.id_str === tweetId && Array.isArray(obj.mediaDetails)) {
      return videoVariantsFromMedia(obj.mediaDetails);
    }

    stack.push(...Object.values(obj));
  }
  return null;
}

export function pickBestMp4Variant(variants: VideoVariant[]): VideoUrl | null {
  const mp4s = variants
    .filter((v) => v.content_type === 'video/mp4' && typeof v.url === 'string')
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  if (mp4s.length > 0) {
    const url = mp4s[0].url;
    const match = url.match(/\/(\d+)x(\d+)\//);
    return {
      url,
      format: 'mp4',
      bitrate: mp4s[0].bitrate,
      width: match ? parseInt(match[1], 10) : undefined,
      height: match ? parseInt(match[2], 10) : undefined,
    };
  }

  const hls = variants.find((v) => v.content_type === 'application/x-mpegURL' && typeof v.url === 'string');
  return hls ? { url: hls.url, format: 'm3u8' } : null;
}

export function syndicationToken(tweetId: string): string {
  return ((Number(tweetId) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}
