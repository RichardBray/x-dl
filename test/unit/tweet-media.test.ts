import { describe, it, expect } from 'bun:test';
import { findTweetVideoVariants, pickBestMp4Variant, syndicationToken } from '../../src/utils.ts';

const videoMedia = (mediaId: string, res: string) => ({
  type: 'video',
  video_info: {
    variants: [
      { content_type: 'application/x-mpegURL', url: `https://video.twimg.com/amplify_video/${mediaId}/pl/x.m3u8` },
      { content_type: 'video/mp4', bitrate: 256000, url: `https://video.twimg.com/amplify_video/${mediaId}/vid/avc1/480x270/a.mp4` },
      { content_type: 'video/mp4', bitrate: 10368000, url: `https://video.twimg.com/amplify_video/${mediaId}/vid/avc1/${res}/b.mp4?tag=21` },
    ],
  },
});

const tweet = (id: string, media: unknown[]) => ({
  __typename: 'Tweet',
  rest_id: id,
  legacy: { id_str: id, extended_entities: { media } },
});

const threadDetail = {
  data: {
    threaded_conversation_with_injections_v2: {
      instructions: [
        {
          entries: [
            { content: { itemContent: { tweet_results: { result: tweet('111', [videoMedia('main', '1920x1080')]) } } } },
            {
              content: {
                items: [
                  {
                    item: {
                      itemContent: {
                        tweet_results: {
                          result: { __typename: 'TweetWithVisibilityResults', tweet: tweet('222', [videoMedia('reply', '3840x2160')]) },
                        },
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  },
};

describe('findTweetVideoVariants', () => {
  it('picks the requested tweet video, not a higher-res one from the thread', () => {
    const best = pickBestMp4Variant(findTweetVideoVariants(threadDetail, '111')!);
    expect(best?.url).toBe('https://video.twimg.com/amplify_video/main/vid/avc1/1920x1080/b.mp4?tag=21');
    expect(best?.width).toBe(1920);
    expect(best?.height).toBe(1080);
  });

  it('finds tweets nested inside visibility wrappers', () => {
    const best = pickBestMp4Variant(findTweetVideoVariants(threadDetail, '222')!);
    expect(best?.url).toContain('/amplify_video/reply/');
  });

  it('returns null when the tweet has no video', () => {
    expect(findTweetVideoVariants({ data: tweet('333', [{ type: 'photo' }]) }, '333')).toBeNull();
    expect(findTweetVideoVariants(threadDetail, '999')).toBeNull();
  });

  it('reads the syndication tweet-result shape', () => {
    const syndication = { id_str: '111', mediaDetails: [videoMedia('main', '1280x720')] };
    expect(pickBestMp4Variant(findTweetVideoVariants(syndication, '111')!)?.url).toContain('/1280x720/');
  });
});

describe('pickBestMp4Variant', () => {
  it('falls back to HLS when there is no mp4 variant', () => {
    const best = pickBestMp4Variant([{ content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/x.m3u8' }]);
    expect(best).toEqual({ url: 'https://video.twimg.com/x.m3u8', format: 'm3u8' });
  });
});

describe('syndicationToken', () => {
  it('produces a non-empty base36 token', () => {
    expect(syndicationToken('2107573382229188645')).toMatch(/^[0-9a-z]+$/);
  });
});
