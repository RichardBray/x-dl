import Anthropic from '@anthropic-ai/sdk';
import type { TweetInfo } from './types.ts';

export async function generateArticle(transcript: string, tweetInfo: TweetInfo | null): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const client = new Anthropic({ apiKey });

  const authorContext = tweetInfo
    ? `The video is from a tweet by @${tweetInfo.author} (${tweetInfo.url}).`
    : 'No additional context about the source is available.';

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a skilled writer. Based on the following transcript from a video tweet, write a well-structured article in markdown format. The article should capture the key points, be engaging to read, and be well-organized with appropriate headings.

${authorContext}

Transcript:
${transcript}

Write the article now. Output only the markdown article, no preamble.`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return textBlock.text;
}
