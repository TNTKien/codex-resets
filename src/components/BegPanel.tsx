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
    <div className="pls-stack" aria-hidden="true"><span>pls</span><span>pls</span></div>
    <button className="beg-pill" disabled={pending} onClick={beg} aria-label="Cầu một lần reset Codex">
      <span aria-hidden="true">🙏</span>
      <b>cầu reset</b>
      <strong>{data.count ? data.count.toLocaleString('vi-VN') : '—'}</strong>
    </button>
  </section>;
}
