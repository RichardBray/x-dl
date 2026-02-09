interface Props {
  videoUrl: string;
  filename: string;
  format: string;
}

export function DownloadButton({ videoUrl, filename, format }: Props) {
  return (
    <div className="download-section">
      <p className="video-info">
        Format: <strong>{format.toUpperCase()}</strong> | File: <strong>{filename}</strong>
      </p>
      <a
        href={videoUrl}
        download={filename}
        target="_blank"
        rel="noopener noreferrer"
        className="download-btn"
      >
        Download Video
      </a>
    </div>
  );
}
