import { useEffect, useState } from 'react';

type EventItem = { id: string; country: string; at: string };
type Snapshot = { count: number; events: EventItem[] };

export default function BegPanel() {
  const [data, setData] = useState<Snapshot>({ count: 0, events: [] });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch('/api/beg').then(r => r.json()).then(setData).catch(() => {});
    const stream = new EventSource('/api/beg/live');
    stream.onmessage = event => setData(JSON.parse(event.data));
    return () => stream.close();
  }, []);

  async function beg() {
    setPending(true);
    try {
      const r = await fetch('/api/beg', { method: 'POST' });
      setData(await r.json());
    } finally { setPending(false); }
  }

  return <aside className="card beg">
    <div className="kicker">collective prayer counter</div>
    <div className="beg-count">{data.count.toLocaleString()}</div>
    <div className="kicker">reset requests sent into the void</div>
    <button disabled={pending} onClick={beg}>{pending ? 'sending…' : '🙏  beg for a reset'}</button>
    <div className="events">
      <div className="kicker">live prayers</div>
      {data.events.length === 0 && <div className="event"><span>waiting for a brave soul</span><span>—</span></div>}
      {data.events.map(e => <div className="event" key={e.id}><span>{flag(e.country)} {e.country || '??'}</span><span>{timeAgo(e.at)}</span></div>)}
    </div>
  </aside>;
}

function flag(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return '🌐';
  return String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0)));
}
function timeAgo(value: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}
