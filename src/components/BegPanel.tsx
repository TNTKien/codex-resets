import { useEffect, useRef, useState } from 'react';
import {
  CountUp,
  DataStream,
  EndfieldButton,
  TacticalBadge,
  TacticalPanel,
  type DataStreamMessage,
} from './reend/ReEnd';

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

function shortId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value;
}

function eventTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export default function BegPanel() {
  const [data, setData] = useState<Snapshot>(EMPTY);
  const [pending, setPending] = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
  const [feed, setFeed] = useState<DataStreamMessage[]>([
    { id: 'boot', text: '[SYS] AIC request terminal initialized', type: 'system' },
    { id: 'load', text: '[DAT] Loading current reset-request cycle...', type: 'data' },
  ]);
  const seenRequests = useRef(new Set<string>());
  const feedSequence = useRef(0);

  const appendFeed = (text: string, type: DataStreamMessage['type'] = 'system') => {
    feedSequence.current += 1;
    const id = `${Date.now()}-${feedSequence.current}`;
    setFeed(current => [...current.slice(-23), { id, text, type }]);
  };

  const rememberSnapshot = (snapshot: Snapshot, announceNew: boolean) => {
    const newEvents = snapshot.events
      .filter(item => !seenRequests.current.has(item.request_id))
      .reverse();

    for (const item of snapshot.events) seenRequests.current.add(item.request_id);
    setData(snapshot);

    if (announceNew) {
      for (const item of newEvents) {
        appendFeed(
          `[RX ${eventTime(item.at)}] Request ${shortId(item.request_id)} received · ${item.country || '??'} · total ${snapshot.count}`,
          'data',
        );
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let retryCount = 0;
    let disposed = false;

    fetch('/api/beg', { signal: controller.signal })
      .then(readSnapshot)
      .then(snapshot => {
        for (const item of snapshot.events) seenRequests.current.add(item.request_id);
        setData(snapshot);
        appendFeed(
          `[DAT] Cycle ${snapshot.cycle_id || 'unresolved'} loaded · ${snapshot.count} request${snapshot.count === 1 ? '' : 's'}`,
          'classified',
        );
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        appendFeed(`[WARN] Snapshot load failed · ${String(error)}`, 'warning');
      });

    const connect = () => {
      if (disposed) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const next = new WebSocket(`${protocol}//${window.location.host}/api/beg/live`);
      socket = next;
      let receivedInitialSnapshot = false;

      next.onopen = () => {
        if (disposed) return;
        retryCount = 0;
        setStreamConnected(true);
        appendFeed('[NET] Hibernating live socket connected', 'classified');
      };

      next.onmessage = event => {
        if (disposed) return;
        try {
          const snapshot = JSON.parse(String(event.data)) as Snapshot;
          rememberSnapshot(snapshot, receivedInitialSnapshot);
          receivedInitialSnapshot = true;
        } catch {
          appendFeed('[WARN] Ignored malformed socket payload', 'warning');
        }
      };

      next.onerror = () => {
        if (disposed) return;
        setStreamConnected(false);
      };

      next.onclose = () => {
        if (disposed) return;
        if (socket === next) socket = null;
        setStreamConnected(false);

        retryCount += 1;
        const delay = Math.min(1_000 * (2 ** (retryCount - 1)), 15_000);
        appendFeed(
          `[WARN] Live socket interrupted · retrying in ${Math.ceil(delay / 1_000)}s`,
          'warning',
        );
        reconnectTimer = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      controller.abort();
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (socket && socket.readyState < WebSocket.CLOSING) {
        socket.close(1000, 'component unmounted');
      }
    };
  }, []);

  async function beg() {
    if (pending) return;
    setPending(true);
    appendFeed('[TX] Submitting quota recovery request...', 'system');

    try {
      const response = await fetch('/api/beg', { method: 'POST' });
      const snapshot = await readSnapshot(response);
      const newEvent = snapshot.events.find(item => !seenRequests.current.has(item.request_id));

      if (newEvent) {
        seenRequests.current.add(newEvent.request_id);
        appendFeed(
          `[ACK ${eventTime(newEvent.at)}] Request ${shortId(newEvent.request_id)} accepted · ${newEvent.country || '??'} · total ${snapshot.count}`,
          'classified',
        );
      } else {
        appendFeed(`[ACK] Request accepted · total ${snapshot.count}`, 'classified');
      }

      rememberSnapshot(snapshot, false);
    } catch (error) {
      appendFeed(`[WARN] Request failed · ${String(error)}`, 'warning');
    } finally {
      setPending(false);
    }
  }

  return <TacticalPanel
    title="AIC REQUEST"
    status={streamConnected ? 'online' : 'warning'}
    className="reend-beg"
    aria-label="Quota recovery request"
    headerAction={<TacticalBadge variant={streamConnected ? 'online' : 'warning'}>
      {streamConnected ? 'LIVE' : 'RECONNECTING'}
    </TacticalBadge>}
  >
    <div className="reend-beg__count">
      <span>requests in current cycle</span>
      <strong><CountUp value={data.count} duration={850} /></strong>
    </div>

    <EndfieldButton disabled={pending} onClick={beg} aria-label="Submit a Codex reset request">
      <span aria-hidden="true">▰</span>
      <span>SUBMIT REQUEST</span>
    </EndfieldButton>

    <div className="reend-beg__sub">quota recovery / manual input / cycle {data.cycle_id || 'unresolved'}</div>

    <DataStream
      messages={feed}
      active={streamConnected}
      label="REQUEST DATA STREAM"
      className="reend-beg__stream"
    />
  </TacticalPanel>;
}
