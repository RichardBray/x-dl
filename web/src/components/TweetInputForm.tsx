import { useState, type FormEvent } from 'react';

interface Props {
  onSubmit: (url: string) => void;
  isLoading: boolean;
  placeholder?: string;
  buttonText?: string;
}

export function TweetInputForm({ onSubmit, isLoading, placeholder, buttonText }: Props) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="input-form">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={placeholder || "Paste a Twitter/X video URL..."}
        disabled={isLoading}
        required
      />
      <button type="submit" disabled={isLoading || !url.trim()}>
        {isLoading ? 'Processing...' : (buttonText || 'Extract Video')}
      </button>
    </form>
  );
}
