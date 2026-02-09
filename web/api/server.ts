import { VideoExtractor } from '../../src/extractor.ts';
import { isValidTwitterUrl, parseTweetUrl, generateFilename } from '../../src/utils.ts';
import type { ExtractResult } from '../../src/types.ts';

const PORT = Number(process.env.API_PORT) || 3001;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === '/api/extract' && req.method === 'POST') {
      try {
        const body = await req.json();
        const tweetUrl: string = body.url;

        if (!tweetUrl || !isValidTwitterUrl(tweetUrl)) {
          return Response.json(
            { error: 'Invalid or missing Twitter/X URL' },
            { status: 400, headers: corsHeaders }
          );
        }

        const tweetInfo = parseTweetUrl(tweetUrl);
        const extractor = new VideoExtractor({ timeout: 30000 });
        const result: ExtractResult = await extractor.extract(tweetUrl);

        if (result.error || !result.videoUrl) {
          return Response.json(
            {
              error: result.error || 'Failed to extract video',
              errorClassification: result.errorClassification,
            },
            { status: 422, headers: corsHeaders }
          );
        }

        const filename = tweetInfo ? generateFilename(tweetInfo) : 'video.mp4';

        return Response.json(
          {
            videoUrl: result.videoUrl.url,
            format: result.videoUrl.format,
            filename,
            tweetInfo,
          },
          { headers: corsHeaders }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return Response.json(
          { error: message },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
  },
});

console.log(`API server running on http://localhost:${PORT}`);
