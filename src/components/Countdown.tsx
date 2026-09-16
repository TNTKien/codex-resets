import { useEffect, useMemo, useState } from 'react';

function format(ms: number) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d ? `${d}D ` : ''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

export default function Countdown({ target }: { target: string }) {
  const targetMs = useMemo(() => new Date(target).getTime(), [target]);
  const [left, setLeft] = useState(targetMs - Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setLeft(targetMs - Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);
  return <div className="countdown">{format(left)}</div>;
}
