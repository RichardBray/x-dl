import OpenAI from 'openai';
import { createReadStream } from 'node:fs';

export async function transcribeAudio(filePath: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const openai = new OpenAI({ apiKey });

  const transcription = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file: createReadStream(filePath),
    response_format: 'text',
  });

  return transcription as unknown as string;
}
