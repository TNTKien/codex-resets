import { useEffect, useState } from 'react';

type EventItem = { request_id: string; country: string; at: string };
type Snapshot = {
  type: 'reset-request-count';
  cycle_id: string;
  since: string;
  count: number;
  events: EventItem[];
};

const EMPTY: Snapshot = {
  type: 'reset-request-count',
  cycle_id: 'unresolved',
  since: '',
  count: 0,
  events: [],
};

async function readSnapshot(response: Response): Promise<Snapshot> {
  if (!response.ok) throw new Error(`beg unavailable (${response.status})`);
  return await response.json() as Snapshot;
}

export default function BegPanel() {
  const [data, setData] = useState<Snapshot>(EMPTY);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/beg', { signal: controller.signal })
      .then(readSnapshot)
      .then(snapshot => setData(snapshot))
      .catch(() => {});

    const stream = new EventSource('/api/beg/live');
    stream.onmessage = event => {
      try { setData(JSON.parse(event.data) as Snapshot); } catch { /* ignore malformed events */ }
    };

    return () => {
      controller.abort();
      stream.close();
    };
  }, []);

  async function beg() {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch('/api/beg', { method: 'POST' });
      setData(await readSnapshot(response));
    } finally {
      setPending(false);
    }
  }

  return <section className="beg-zone" aria-label="Bộ đếm cầu reset">
    <div className="beg-plaque" aria-hidden="true">
      <span>STAND BY</span>
      <small>quota đang bị quan sát</small>
    </div>

    <div className="beg-count">
      <span>ý chí cầu reset trong kỳ này</span>
      <strong>{data.count ? data.count.toLocaleString('vi-VN') : '0'}</strong>
    </div>

    <button className="beg-pill" disabled={pending} onClick={beg} aria-label="Cầu một lần reset Codex">
      <span className="beg-pill-flower" aria-hidden="true">✦</span>
      <span className="beg-pill-main">CẦU RESET!</span>
      <span className="beg-pill-sub">+1 resolve · +1 hy vọng</span>
    </button>
  </section>;
}
