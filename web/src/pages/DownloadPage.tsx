import { useState } from 'react';
import { TweetInputForm } from '../components/TweetInputForm';
import { StatusDisplay } from '../components/StatusDisplay';
import { DownloadButton } from '../components/DownloadButton';

interface ExtractResponse {
  videoUrl: string;
  format: string;
  filename: string;
  tweetInfo: { id: string; author: string; url: string } | null;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export function DownloadPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<ExtractResponse | null>(null);

  const handleExtract = async (url: string) => {
    setStatus('loading');
    setMessage('Extracting video... This may take a moment.');
    setResult(null);

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Extraction failed');
        return;
      }

      setResult(data);
      setStatus('success');
      setMessage('Video extracted successfully!');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Network error');
    }
  };

  return (
    <>
      <header>
        <h1>x-dl</h1>
        <p className="subtitle">Twitter/X Video Downloader</p>
      </header>

      <main>
        <TweetInputForm onSubmit={handleExtract} isLoading={status === 'loading'} />
        <StatusDisplay status={status} message={message} />
        {result && (
          <DownloadButton
            videoUrl={result.videoUrl}
            filename={result.filename}
            format={result.format}
          />
        )}
      </main>
    </>
  );
}
