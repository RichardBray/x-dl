export const MOCK_TWEETS = {
  publicVideo: {
    url: 'https://x.com/TestUser/status/123456',
    author: 'TestUser',
    id: '123456',
    hasVideo: true,
    isPrivate: false,
  },
  publicGif: {
    url: 'https://x.com/GifUser/status/789012',
    author: 'GifUser',
    id: '789012',
    hasVideo: true,
    isPrivate: false,
  },
  noVideo: {
    url: 'https://x.com/NoVideoUser/status/345678',
    author: 'NoVideoUser',
    id: '345678',
    hasVideo: false,
    isPrivate: false,
  },
  private: {
    url: 'https://x.com/PrivateUser/status/456789',
    author: 'PrivateUser',
    id: '456789',
    hasVideo: true,
    isPrivate: true,
  },
  multiQuality: {
    url: 'https://x.com/MultiQualityUser/status/111111',
    author: 'MultiQualityUser',
    id: '111111',
    hasVideo: true,
    isPrivate: false,
  },
};

export function getMockPageHtml(tweetKey: keyof typeof MOCK_TWEETS): string {
  const mockPagePath = import.meta.dir + '/mock-x-page.html';
  try {
    const file = Bun.file(mockPagePath);
    return file.text();
  } catch (error) {
    console.error('Failed to load mock page:', error);
    return '';
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeout]);
}

export function createTempDir(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `/tmp/x-dl-test-${timestamp}-${random}`;
}

export async function cleanupTempDir(dir: string): Promise<void> {
  try {
    const rmProcess = Bun.spawn(['rm', '-rf', dir], {
      stdout: 'inherit',
      stderr: 'inherit',
    });
    await rmProcess.exited;
  } catch (error) {
    console.warn(`Failed to cleanup temp directory ${dir}:`, error);
  }
}

export function mockNetworkRequests(tweetKey: keyof typeof MOCK_TWEETS) {
  const mockRequests: Record<string, string[]> = {
    publicVideo: [
      'https://video.twimg.com/tweet_video/123456.mp4',
      'https://video.twimg.com/tweet_video/123456_720x1280.m3u8',
    ],
    publicGif: [
      'https://video.twimg.com/tweet_video/789012.gif',
    ],
    multiQuality: [
      'https://video.twimg.com/ext_tw_video/111111/pu/vid/720x1280/best.mp4',
      'https://video.twimg.com/ext_tw_video/111111/pu/vid/480x854/medium.mp4',
      'https://video.twimg.com/ext_tw_video/111111/pu/vid/360x640/low.mp4',
    ],
  };

  return mockRequests[tweetKey] || [];
}
