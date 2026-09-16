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

  return <section className="beg-zone" aria-label="Reset request counter">
    <div className="beg-art">
      <div className="pls-stack" aria-hidden="true"><span>pls</span><span>pls</span></div>
      <button className="beg-pill" disabled={pending} onClick={beg}>
        <span aria-hidden="true">🙏</span>
        <b>beg</b>
        <strong>{data.count.toLocaleString()}</strong>
      </button>
    </div>
    <div className="beg-meta">
      <span>since this reset cycle</span>
      <span>{data.since ? formatUtc(data.since) : 'connecting…'}</span>
    </div>
    <div className="live-prayers">
      <div className="section-eyebrow">live requests</div>
      {data.events.length === 0 && <div className="prayer-row"><span>waiting for someone to beg</span><span>—</span></div>}
      {data.events.slice(0, 6).map(event => <div className="prayer-row" key={event.request_id}>
        <span>{flag(event.country)} {event.country}</span>
        <span>{timeAgo(event.at)}</span>
      </div>)}
    </div>
  </section>;
}

function flag(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return '🌐';
  return String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0)));
}

function timeAgo(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

function formatUtc(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
  }).format(new Date(value));
}
