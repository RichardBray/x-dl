interface Props {
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
}

export function StatusDisplay({ status, message }: Props) {
  if (status === 'idle') return null;

  const className = `status status-${status}`;

  return (
    <div className={className}>
      {status === 'loading' && <span className="spinner" />}
      <p>{message}</p>
    </div>
  );
}
