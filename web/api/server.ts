import { VideoExtractor } from '../../src/extractor.ts';
import { isValidTwitterUrl, parseTweetUrl, generateFilename } from '../../src/utils.ts';
import { extractAudio } from '../../src/audio.ts';
import { transcribeAudio } from '../../src/transcribe.ts';
import { generateArticle } from '../../src/article.ts';
import type { ExtractResult } from '../../src/types.ts';

const PORT = Number(process.env.API_PORT) || 3001;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Check for API keys at startup
if (!process.env.OPENAI_API_KEY) {
  console.warn('Warning: OPENAI_API_KEY is not set. /api/article endpoint will not work.');
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('Warning: ANTHROPIC_API_KEY is not set. /api/article endpoint will not work.');
}

Bun.serve({
  port: PORT,
  idleTimeout: 120,
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

    if (url.pathname === '/api/article' && req.method === 'POST') {
      if (!process.env.OPENAI_API_KEY) {
        return Response.json(
          { error: 'OPENAI_API_KEY is not configured on the server' },
          { status: 500, headers: corsHeaders }
        );
      }
      if (!process.env.ANTHROPIC_API_KEY) {
        return Response.json(
          { error: 'ANTHROPIC_API_KEY is not configured on the server' },
          { status: 500, headers: corsHeaders }
        );
      }

      const body = await req.json();
      const tweetUrl: string = body.url;

      if (!tweetUrl || !isValidTwitterUrl(tweetUrl)) {
        return Response.json(
          { error: 'Invalid or missing Twitter/X URL' },
          { status: 400, headers: corsHeaders }
        );
      }

      const tweetInfo = parseTweetUrl(tweetUrl);
      let audioPath: string | null = null;

      const stream = new ReadableStream({
        async start(controller) {
          const send = (data: Record<string, unknown>) => {
            controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
          };

          try {
            // Step 1: Extract video
            send({ step: 'extracting' });
            const extractor = new VideoExtractor({ timeout: 30000 });
            const result: ExtractResult = await extractor.extract(tweetUrl);

            if (result.error || !result.videoUrl) {
              send({ step: 'error', error: result.error || 'Failed to extract video' });
              controller.close();
              return;
            }

            // Step 2: Extract audio
            send({ step: 'extracting_audio' });
            audioPath = await extractAudio(result.videoUrl.url);

            // Step 3: Transcribe
            send({ step: 'transcribing' });
            const transcript = await transcribeAudio(audioPath);

            // Step 4: Generate article
            send({ step: 'generating' });
            const article = await generateArticle(transcript, tweetInfo);

            send({ step: 'done', article });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            send({ step: 'error', error: message });
          } finally {
            // Clean up temp files
            if (audioPath) {
              try {
                const fs = await import('node:fs');
                fs.unlinkSync(audioPath);
              } catch {}
            }
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
  },
});

console.log(`API server running on http://localhost:${PORT}`);
