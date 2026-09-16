import { useEffect, useMemo, useRef, useState } from 'react';
import BegPanel from './BegPanel';
import {
  DiamondLoader,
  EndfieldButton,
  HoloCard,
  ScanDivider,
  TacticalBadge,
  TacticalPanel,
} from './reend/ReEnd';

type ResetType = 'regular' | 'banked';
type ResetSource = { type: string; author: string | null; url: string };
type ResetEvent = { id: string; resetType: ResetType; announcedAt: string; text: string; source: ResetSource | null };
type ScheduledReset = ResetEvent & { status: string; scheduledFor: string | null };
type ActiveWatch = {
  level: string;
  chancePercent: number | null;
  forecastWindow: string;
  observedAt: string;
  expiresAt: string;
  text: string;
  source: ResetSource | null;
};
type Snapshot = {
  source: string;
  fetchedAt: string;
  latestReset: ResetEvent | null;
  scheduledReset: ScheduledReset | null;
  activeWatch: ActiveWatch | null;
  stats: { total: number; avgIntervalDays: number | null; longestIntervalDays: number | null };
  resets: ResetEvent[];
};

export default function ResetDashboard() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/resets');
        if (!response.ok) throw new Error('unavailable');
        const next = await response.json() as Snapshot;
        if (!cancelled) {
          setData(next);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    };

    load();
    const refresh = window.setInterval(load, 60_000);
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      cancelled = true;
      clearInterval(refresh);
      clearInterval(clock);
    };
  }, []);

  if (!data) {
    return <TacticalPanel
      title="RESET TELEMETRY"
      status={error ? 'offline' : 'scanning'}
      headerAction={<TacticalBadge variant={error ? 'danger' : 'info'}>{error ? 'LINK ERROR' : 'SYNC'}</TacticalBadge>}
    >
      {error
        ? <div className="re-loader"><span>Unable to load reset telemetry. Please try again later.</span></div>
        : <DiamondLoader label="SYNCING RESET TELEMETRY" />}
    </TacticalPanel>;
  }

  const latest = data.latestReset;
  const watch = activeWatch(data.activeWatch, now);

  return <>
    {(data.scheduledReset || watch) && <WatchCard scheduled={data.scheduledReset} watch={watch} />}

    <section className="latest-grid">
      <TacticalPanel
        title="LATEST RECOVERY"
        status={latest ? 'online' : 'offline'}
        className="reend-latest"
        headerAction={<TacticalBadge variant={latest ? 'online' : 'neutral'}>{latest ? 'CONFIRMED' : 'NO DATA'}</TacticalBadge>}
      >
        <div className="section-eyebrow">quota reset telemetry / most recent event</div>
        <div className="reend-latest__time">{latest ? relativeTime(latest.announcedAt, now) : 'unknown'}</div>
        <div className="reend-latest__date">{latest ? formatUtc(latest.announcedAt) : 'No reset has been recorded yet'}</div>
      </TacticalPanel>
      <BegPanel />
    </section>

    <section className="reend-stat-grid" aria-label="Reset statistics">
      <HoloCard title="TOTAL RESETS" subtitle="all confirmed events" value={String(data.stats.total)} glyph="◆" />
      <HoloCard title="AVERAGE INTERVAL" subtitle="mean recovery cadence" value={formatDays(data.stats.avgIntervalDays)} glyph="▥" />
      <HoloCard title="LONGEST WAIT" subtitle="maximum observed interval" value={formatDays(data.stats.longestIntervalDays)} glyph="◫" />
    </section>

    <History resets={data.resets} now={now} />
    <Announcements resets={data.resets} now={now} />
  </>;
}

function WatchCard({ scheduled, watch }: { scheduled: ScheduledReset | null; watch: ActiveWatch | null }) {
  if (scheduled?.scheduledFor) {
    return <TacticalPanel
      title="SCHEDULED RESET"
      status="warning"
      className="reend-watch"
      headerAction={<TacticalBadge variant="warning">SCHEDULED</TacticalBadge>}
    >
      <h2 className="reend-watch__title">{formatUtc(scheduled.scheduledFor)}</h2>
      {scheduled.text && <p className="reend-watch__copy">{scheduled.text}</p>}
      {scheduled.source && <a className="source-link" href={scheduled.source.url} target="_blank" rel="noreferrer">View source on X →</a>}
    </TacticalPanel>;
  }

  if (!watch) return null;
  return <TacticalPanel
    title="ACTIVE WATCH"
    status="scanning"
    className="reend-watch"
    headerAction={<TacticalBadge variant="info">{watch.level}</TacticalBadge>}
  >
    <h2 className="reend-watch__title">{watch.chancePercent == null ? 'Reset signal detected' : `${Math.round(watch.chancePercent)}% reset probability`}</h2>
    <p className="reend-watch__copy">{watch.forecastWindow}{watch.text ? ` · ${watch.text}` : ''}</p>
    {watch.source && <a className="source-link" href={watch.source.url} target="_blank" rel="noreferrer">View signal on X →</a>}
  </TacticalPanel>;
}

type HeatTooltip = { day: HeatDay; x: number; y: number; below: boolean };

function History({ resets, now }: { resets: ResetEvent[]; now: number }) {
  const weeks = 53;
  const days = useMemo(() => heatmapDays(resets, now, weeks), [resets, now]);
  const months = useMemo(() => monthLabels(days), [days]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const didAutoScroll = useRef(false);
  const [tooltip, setTooltip] = useState<HeatTooltip | null>(null);

  useEffect(() => {
    if (didAutoScroll.current) return;
    const frame = window.requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (!node) return;
      node.scrollLeft = node.scrollWidth - node.clientWidth;
      didAutoScroll.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const showPointerTooltip = (day: HeatDay, x: number, y: number) => {
    const tooltipWidth = 320;
    const safeX = Math.max(tooltipWidth / 2 + 12, Math.min(window.innerWidth - tooltipWidth / 2 - 12, x));
    const below = y < 220;
    setTooltip({ day, x: safeX, y: below ? y + 16 : y - 14, below });
  };

  const showFocusTooltip = (day: HeatDay, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    showPointerTooltip(day, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  return <TacticalPanel
    title="RESET HISTORY // 53W"
    status="online"
    className="reend-section-panel"
    headerAction={<div className="legend" aria-label="Legend">
      <span><i className="regular" />regular reset</span>
      <span><i className="banked" />banked reset</span>
      <span><i />no reset</span>
    </div>}
  >
    <p className="reend-watch__copy">Scroll horizontally for older history · hover a cell for details.</p>
    <ScanDivider label="TIMELINE" />

    <div className="heatmap-frame">
      <div className="day-labels" aria-hidden="true"><span>MON</span><span>WED</span><span>FRI</span></div>
      <div className="heatmap-scroll" ref={scrollRef} onScroll={() => setTooltip(null)}>
        <div className="heatmap-canvas">
          <div className="month-labels" style={{ gridTemplateColumns: `repeat(${weeks}, 20px)` }}>
            {months.map(item => <span key={`${item.label}-${item.week}`} style={{ gridColumn: `${item.week + 1} / span 4` }}>{item.label}</span>)}
          </div>
          <div className="heatmap-grid">
            {days.map(day => <button
              type="button"
              key={day.key}
              className={`heat-day ${day.kind}`}
              aria-label={heatAriaLabel(day)}
              onPointerEnter={event => showPointerTooltip(day, event.clientX, event.clientY)}
              onPointerMove={event => showPointerTooltip(day, event.clientX, event.clientY)}
              onPointerLeave={() => setTooltip(null)}
              onFocus={event => showFocusTooltip(day, event.currentTarget)}
              onBlur={() => setTooltip(null)}
            />)}
          </div>
        </div>
      </div>
    </div>

    {tooltip && <div
      className={`heat-tooltip${tooltip.below ? ' below' : ''}`}
      style={{ left: tooltip.x, top: tooltip.y }}
      role="tooltip"
    >
      <div className="heat-tooltip-date">{formatHeatDate(tooltip.day.date)}</div>
      {tooltip.day.events.length === 0
        ? <div className="heat-tooltip-empty">No reset recorded.</div>
        : tooltip.day.events.map(item => <div className="heat-tooltip-event" key={item.id}>
          <div className="heat-tooltip-event-head">
            <strong>{item.resetType === 'regular' ? 'Regular reset' : 'Banked reset'}</strong>
            <span>{formatHeatTime(item.announcedAt)}</span>
          </div>
          <p>{item.text || 'Reset announcement recorded.'}</p>
        </div>)}
    </div>}
  </TacticalPanel>;
}

function Announcements({ resets, now }: { resets: ResetEvent[]; now: number }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? resets : resets.slice(0, 3);

  return <TacticalPanel
    title="ANNOUNCEMENT FEED"
    status="online"
    className="reend-section-panel"
    headerAction={<TacticalBadge variant="neutral">{resets.length} RECORDS</TacticalBadge>}
  >
    <p className="reend-watch__copy">Original announcement text is preserved for verification.</p>
    <ScanDivider label="DATA STREAM" />

    <div className="announcement-list">
      {shown.map(item => <article className="announcement" key={item.id}>
        <div className="announcement-seal" aria-hidden="true">◆</div>
        <div className="announcement-body">
          <div className="announcement-meta">
            <span>{relativeTime(item.announcedAt, now)}</span>
            <span>·</span>
            <time>{formatUtc(item.announcedAt)}</time>
          </div>
          <p>{item.text || 'Reset announcement recorded'}</p>
          {item.source && <a className="source-link" href={item.source.url} target="_blank" rel="noreferrer">Open original post on X →</a>}
        </div>
      </article>)}
    </div>

    {resets.length > 3 && <EndfieldButton className="show-all" onClick={() => setExpanded(value => !value)}>
      {expanded ? 'COLLAPSE LOG ↑' : `OPEN ALL ${resets.length} RECORDS ↓`}
    </EndfieldButton>}
  </TacticalPanel>;
}

function activeWatch(watch: ActiveWatch | null, now: number) {
  return watch && Date.parse(watch.expiresAt) > now ? watch : null;
}

function formatDays(value: number | null) {
  return value == null ? '—' : `${value.toFixed(1)} days`;
}

function relativeTime(value: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(value)) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))} min ago`;
  if (seconds < 86_400) return `${Math.max(1, Math.floor(seconds / 3600))} hr ago`;
  const days = Math.floor(seconds / 86_400);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

function formatUtc(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(value));
}

function formatHeatDate(date: Date) {
  return `${new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(date)} (UTC)`;
}

function formatHeatTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
  }).format(new Date(value));
}

type HeatDay = {
  key: string;
  kind: 'regular' | 'banked' | 'empty';
  title: string;
  date: Date;
  events: ResetEvent[];
};

function heatmapDays(resets: ResetEvent[], now: number, weeks: number): HeatDay[] {
  const today = new Date(now);
  const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const sundayOffset = utcToday.getUTCDay();
  const start = new Date(utcToday);
  start.setUTCDate(start.getUTCDate() - sundayOffset - (weeks - 1) * 7);

  const byDay = new Map<string, ResetEvent[]>();
  for (const item of resets) {
    const key = item.announcedAt.slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }

  return Array.from({ length: weeks * 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    const events = byDay.get(key) ?? [];
    const types = events.map(item => item.resetType);
    const kind: HeatDay['kind'] = types.includes('regular') ? 'regular' : types.includes('banked') ? 'banked' : 'empty';
    const labels = types.map(type => type === 'regular' ? 'regular reset' : 'banked reset');
    return { key, kind, date, events, title: `${key}: ${labels.length ? labels.join(', ') : 'no reset'}` };
  });
}

function heatAriaLabel(day: HeatDay) {
  const date = formatHeatDate(day.date);
  if (day.events.length === 0) return `${date}: no reset`;
  const kinds = day.events.map(item => item.resetType === 'regular' ? 'regular reset' : 'banked reset').join(', ');
  return `${date}: ${kinds}`;
}

function monthLabels(days: HeatDay[]) {
  const labels: { week: number; label: string }[] = [];
  let previous = -1;
  for (let week = 0; week < Math.floor(days.length / 7); week += 1) {
    const date = days[week * 7].date;
    if (date.getUTCMonth() !== previous) {
      previous = date.getUTCMonth();
      labels.push({ week, label: new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(date).toUpperCase() });
    }
  }
  return labels;
}
