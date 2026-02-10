import { useState, useRef } from 'react';
import { TweetInputForm } from '../components/TweetInputForm';
import { ProgressSteps } from '../components/ProgressSteps';
import { ArticleDisplay } from '../components/ArticleDisplay';
type ArticleStep = 'extracting' | 'extracting_audio' | 'transcribing' | 'generating' | 'done' | 'error';
type PageStep = ArticleStep | 'idle';

export function ArticlePage() {
  const [step, setStep] = useState<PageStep>('idle');
  const [article, setArticle] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = async (url: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStep('extracting');
    setArticle('');
    setError('');

    try {
      const res = await fetch('/api/article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Request failed');
        setStep('error');
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError('No response stream');
        setStep('error');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.step === 'done') {
              setArticle(event.article);
              setStep('done');
            } else if (event.step === 'error') {
              setError(event.error);
              setStep('error');
            } else {
              setStep(event.step);
            }
          } catch {}
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Network error');
      setStep('error');
    }
  };

  const isProcessing = step !== 'idle' && step !== 'done' && step !== 'error';

  return (
    <>
      <header>
        <h1>x-dl</h1>
        <p className="subtitle">Video to Article</p>
      </header>

      <main>
        <TweetInputForm
          onSubmit={handleSubmit}
          isLoading={isProcessing}
          placeholder="Paste a video tweet URL..."
          buttonText="Generate"
        />

        {step !== 'idle' && step !== 'error' && (
          <ProgressSteps currentStep={step === 'done' ? 'done' : step as ArticleStep} />
        )}

        {step === 'error' && (
          <div className="status status-error">
            <p>{error}</p>
          </div>
        )}

        {step === 'done' && article && <ArticleDisplay article={article} />}
      </main>
    </>
  );
}
