import { useEffect, useState } from 'react';
import { EndfieldButton, TacticalBadge, TacticalPanel } from './reend/ReEnd';

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

  return <TacticalPanel
    title="AIC REQUEST"
    status={pending ? 'scanning' : 'online'}
    className="reend-beg"
    aria-label="Yêu cầu phục hồi quota"
    headerAction={<TacticalBadge variant={pending ? 'warning' : 'online'}>{pending ? 'TRANSMITTING' : 'READY'}</TacticalBadge>}
  >
    <div className="reend-beg__count">
      <span>requests in current cycle</span>
      <strong>{data.count ? data.count.toLocaleString('vi-VN') : '0'}</strong>
    </div>

    <EndfieldButton loading={pending} onClick={beg} aria-label="Gửi một yêu cầu reset Codex">
      <span aria-hidden="true">▰</span>
      <span>SUBMIT REQUEST</span>
    </EndfieldButton>

    <div className="reend-beg__sub">quota recovery / manual input / cycle {data.cycle_id || 'unresolved'}</div>
  </TacticalPanel>;
}
