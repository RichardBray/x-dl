import { describe, it, expect } from 'bun:test';
import { 
  isValidTwitterUrl, 
  parseTweetUrl, 
  generateFilename,
  sanitizeFilename,
  isPrivateTweet,
  hasVideo,
  getVideoFormat,
  selectBestMp4,
} from '../../src/utils.ts';
import type { VideoUrl } from '../../src/types.ts';

describe('URL Validation', () => {
  it('should validate valid Twitter URLs', () => {
    expect(isValidTwitterUrl('https://twitter.com/user/status/123456')).toBe(true);
    expect(isValidTwitterUrl('https://www.twitter.com/user/status/123456')).toBe(true);
    expect(isValidTwitterUrl('http://twitter.com/user/status/123456')).toBe(true);
  });

  it('should validate valid X URLs', () => {
    expect(isValidTwitterUrl('https://x.com/user/status/123456')).toBe(true);
    expect(isValidTwitterUrl('https://www.x.com/user/status/123456')).toBe(true);
    expect(isValidTwitterUrl('http://x.com/user/status/123456')).toBe(true);
  });

  it('should reject invalid URLs', () => {
    expect(isValidTwitterUrl('https://google.com')).toBe(false);
    expect(isValidTwitterUrl('https://twitter.com')).toBe(false);
    expect(isValidTwitterUrl('https://twitter.com/user')).toBe(false);
    expect(isValidTwitterUrl('not-a-url')).toBe(false);
    expect(isValidTwitterUrl('')).toBe(false);
  });

  it('should reject URLs with invalid tweet IDs', () => {
    expect(isValidTwitterUrl('https://twitter.com/user/status/abc')).toBe(false);
    expect(isValidTwitterUrl('https://twitter.com/user/status/')).toBe(false);
  });
});

describe('Tweet URL Parsing', () => {
  it('should parse Twitter URLs correctly', () => {
    const result = parseTweetUrl('https://twitter.com/user/status/123456');
    expect(result).toEqual({
      id: '123456',
      author: 'user',
      url: 'https://twitter.com/user/status/123456',
    });
  });

  it('should parse X URLs correctly', () => {
    const result = parseTweetUrl('https://x.com/user/status/789012');
    expect(result).toEqual({
      id: '789012',
      author: 'user',
      url: 'https://x.com/user/status/789012',
    });
  });

  it('should parse URLs with extra query parameters', () => {
    const result = parseTweetUrl('https://twitter.com/user/status/123456?s=20');
    expect(result).toEqual({
      id: '123456',
      author: 'user',
      url: 'https://twitter.com/user/status/123456',
    });
  });

  it('should return null for invalid URLs', () => {
    expect(parseTweetUrl('https://google.com')).toBeNull();
    expect(parseTweetUrl('https://twitter.com/user')).toBeNull();
    expect(parseTweetUrl('invalid-url')).toBeNull();
  });

  it('should handle complex usernames', () => {
    const result = parseTweetUrl('https://x.com/some_user_name/status/123456');
    expect(result).toEqual({
      id: '123456',
      author: 'some_user_name',
      url: 'https://x.com/some_user_name/status/123456',
    });
  });
});

describe('Filename Generation', () => {
  it('should generate filename with default extension', () => {
    const tweetInfo = {
      id: '123456',
      author: 'user',
      url: 'https://x.com/user/status/123456',
    };
    expect(generateFilename(tweetInfo)).toBe('user_123456.mp4');
  });

  it('should generate filename with custom extension', () => {
    const tweetInfo = {
      id: '123456',
      author: 'user',
      url: 'https://x.com/user/status/123456',
    };
    expect(generateFilename(tweetInfo, 'gif')).toBe('user_123456.gif');
  });

  it('should handle usernames with underscores', () => {
    const tweetInfo = {
      id: '123456',
      author: 'some_user',
      url: 'https://x.com/some_user/status/123456',
    };
    expect(generateFilename(tweetInfo)).toBe('some_user_123456.mp4');
  });
});

describe('Filename Sanitization', () => {
  it('should replace invalid characters with underscores', () => {
    expect(sanitizeFilename('file/name.mp4')).toBe('file_name.mp4');
    expect(sanitizeFilename('file@name.mp4')).toBe('file_name.mp4');
    expect(sanitizeFilename('file name.mp4')).toBe('file_name.mp4');
  });

  it('should replace multiple underscores with single', () => {
    expect(sanitizeFilename('file___name')).toBe('file_name');
  });

  it('should limit filename length', () => {
    const longName = 'a'.repeat(300);
    expect(sanitizeFilename(longName).length).toBeLessThanOrEqual(255);
  });
});

describe('Private Tweet Detection', () => {
  it('should detect protected tweet indicators', () => {
    const protectedHtml = 'This tweet is from an account that is protected';
    expect(isPrivateTweet(protectedHtml)).toBe(true);

    const privateHtml = 'These tweets are protected';
    expect(isPrivateTweet(privateHtml)).toBe(true);

    const notAuthorizedHtml = 'You are not authorized to view this tweet';
    expect(isPrivateTweet(notAuthorizedHtml)).toBe(true);
  });

  it('should not flag public tweets as private', () => {
    const publicHtml = 'This is a great tweet with a video';
    expect(isPrivateTweet(publicHtml)).toBe(false);
  });

  it('should be case insensitive', () => {
    expect(isPrivateTweet('PROTECTED TWEETS')).toBe(true);
    expect(isPrivateTweet('YOU ARE NOT AUTHORIZED TO VIEW')).toBe(true);
  });

  it('should not flag login walls as private tweets', () => {
    const loginHtml = 'Log in to follow this account';
    expect(isPrivateTweet(loginHtml)).toBe(false);

    const signUpHtml = 'Sign up to follow';
    expect(isPrivateTweet(signUpHtml)).toBe(false);
  });
});

describe('Video Detection', () => {
  it('should detect video elements', () => {
    const videoHtml = '<video src="video.mp4"></video>';
    expect(hasVideo(videoHtml)).toBe(true);
  });

  it('should detect video.twimg.com URLs', () => {
    const videoHtml = 'src="https://video.twimg.com/tweet_video.mp4"';
    expect(hasVideo(videoHtml)).toBe(true);
  });

  it('should detect tweet_video URLs', () => {
    const videoHtml = 'ext_tw_video/123456.mp4';
    expect(hasVideo(videoHtml)).toBe(true);
  });

  it('should not detect non-video content', () => {
    const noVideoHtml = '<img src="image.jpg"><p>No video here</p>';
    expect(hasVideo(noVideoHtml)).toBe(false);
  });
});

describe('Video Format Detection', () => {
  it('should detect MP4 format', () => {
    expect(getVideoFormat('https://video.twimg.com/tweet_video.mp4')).toBe('mp4');
    expect(getVideoFormat('https://video.twimg.com/tweet_video.MP4')).toBe('mp4');
  });

  it('should detect m3u8 format', () => {
    expect(getVideoFormat('https://video.twimg.com/playlist.m3u8')).toBe('m3u8');
  });

  it('should detect GIF format', () => {
    expect(getVideoFormat('https://video.twimg.com/tweet_video.gif')).toBe('gif');
  });

  it('should detect webm format', () => {
    expect(getVideoFormat('https://example.com/video.webm')).toBe('webm');
    expect(getVideoFormat('https://example.com/video.WEBM')).toBe('webm');
  });

  it('should detect other extensions', () => {
    expect(getVideoFormat('https://example.com/video.mov')).toBe('mov');
    expect(getVideoFormat('https://example.com/video.mkv')).toBe('mkv');
  });

  it('should return unknown for tweet_video URLs without extension', () => {
    expect(getVideoFormat('https://pbs.twimg.com/tweet_video_thumb')).toBe('unknown');
  });

  it('should parse extension from URL with query parameters', () => {
    expect(getVideoFormat('https://video.twimg.com/video.mp4?tag=12')).toBe('mp4');
  });

  it('should parse extension from URL with hash fragment', () => {
    expect(getVideoFormat('https://video.twimg.com/video.mp4#t=10')).toBe('mp4');
  });

  it('should detect HLS segment file extensions (m4s)', () => {
    expect(getVideoFormat('https://video.twimg.com/segment.m4s')).toBe('m4s');
  });

  it('should detect HLS segment file extensions (m4a)', () => {
    expect(getVideoFormat('https://video.twimg.com/audio.m4a')).toBe('m4a');
  });

  it('should detect HLS segment file extensions (ts)', () => {
    expect(getVideoFormat('https://video.twimg.com/segment.ts')).toBe('ts');
  });
});

describe('MP4 Selection', () => {
  it('should select the best MP4 from mixed formats', () => {
    const videos: Array<{url: string; format: VideoUrl['format']}> = [
      { url: 'video1.m3u8', format: 'm3u8' },
      { url: 'video2.mp4', format: 'mp4' },
      { url: 'video3.gif', format: 'gif' },
    ];
    expect(selectBestMp4(videos)).toBe('video2.mp4');
  });

  it('should select from multiple MP4 options', () => {
    const videos: Array<{url: string; format: VideoUrl['format']}> = [
      { url: 'video1.mp4', format: 'mp4' },
      { url: 'video2.mp4', format: 'mp4' },
    ];
    expect(selectBestMp4(videos)).toBe('video1.mp4');
  });

  it('should return null when no MP4 is available', () => {
    const videos: Array<{url: string; format: VideoUrl['format']}> = [
      { url: 'video1.m3u8', format: 'm3u8' },
      { url: 'video2.gif', format: 'gif' },
    ];
    expect(selectBestMp4(videos)).toBeNull();
  });

  it('should return null for empty array', () => {
    expect(selectBestMp4([])).toBeNull();
  });
});
